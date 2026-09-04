from __future__ import annotations
from pathlib import Path
import io, json, re
import numpy as np
import soundfile as sf
import librosa
from scipy.signal import lfilter
import torch
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parents[1]
RECIPE = json.loads((ROOT/"config"/"voice_recipe.json").read_text(encoding="utf-8"))
PRON = json.loads((ROOT/"config"/"pronunciation.json").read_text(encoding="utf-8"))
SR = int(RECIPE["sample_rate"])

class JordanTTSEngine:
    def __init__(self):
        self.pipeline = KPipeline(lang_code="p")
        self._voice_cache = {}

    def _voice(self, emotion: str):
        emotion = emotion if emotion in RECIPE["emotion_mix"] else "neutral"
        if emotion not in self._voice_cache:
            path = ROOT/"model"/f"jordan_spark_v1_{emotion}.pt"
            if not path.exists():
                raise FileNotFoundError(
                    f"{path.name} não existe. Execute scripts/build_voice.py primeiro."
                )
            self._voice_cache[emotion] = torch.load(path, map_location="cpu", weights_only=True).float()
        return self._voice_cache[emotion]

    @staticmethod
    def _clean(text: str) -> str:
        text = re.sub(r"https?://\S+", " link ", text)
        text = re.sub(r"[#*_`>|]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _pronounce(self, text: str) -> str:
        for src, dst in sorted(PRON.items(), key=lambda kv: len(kv[0]), reverse=True):
            text = re.sub(rf"\b{re.escape(src)}\b", dst, text, flags=re.I)
        return text

    @staticmethod
    def _auto_emotion(text: str, requested: str | None):
        if requested and requested != "auto":
            return requested
        t = text.strip()
        if "!" in t:
            return "excited"
        if "?" in t:
            return "curious"
        if "..." in t or "…" in t:
            return "soft"
        return "neutral"

    @staticmethod
    def _presence(audio: np.ndarray, amount: float) -> np.ndarray:
        if abs(amount) < 1e-5:
            return audio
        # pre-emphasis/de-emphasis leve para brilho/escurecimento
        if amount > 0:
            emphasized = lfilter([1.0, -0.72], [1.0], audio)
            return audio * (1.0 - amount) + emphasized * amount
        # suavização simples quando amount < 0
        smooth = lfilter([0.18, 0.18, 0.18, 0.18, 0.18], [1.0], audio)
        a = min(1.0, abs(amount) * 3.0)
        return audio * (1.0-a) + smooth * a

    def _post(self, audio: np.ndarray, emotion: str, punctuation: str = "", tuning: dict | None = None) -> np.ndarray:
        p = RECIPE["prosody"][emotion]
        tuning = tuning or {}
        y = np.asarray(audio, dtype=np.float32)
        semitones = float(p["pitch_semitones"]) + float(tuning.get("pitch", 0.0) or 0.0)
        if abs(semitones) > 0.01 and y.size > 1024:
            y = librosa.effects.pitch_shift(y, sr=SR, n_steps=semitones).astype(np.float32)

        brightness = float(p.get("brightness", 0.0)) + float(tuning.get("brightness", 0.0) or 0.0)
        y = self._presence(y, max(-0.35, min(0.45, brightness)))
        y *= float(p.get("gain", 1.0)) * max(0.65, min(1.35, float(tuning.get("energy", 1.0) or 1.0)))

        expressiveness = max(0.55, min(1.50, float(tuning.get("expressiveness", 1.0) or 1.0)))
        if "?" in punctuation and len(y) > SR // 2:
            cut = int(len(y) * max(0.68, min(0.80, 0.76 - 0.02 * expressiveness)))
            tail = librosa.effects.pitch_shift(y[cut:], sr=SR, n_steps=0.70 * expressiveness).astype(np.float32)
            y = np.concatenate([y[:cut], tail])

        if "!" in punctuation:
            y *= 1.0 + (0.035 * expressiveness)

        # whisper: ar sintético sutil, ainda mantendo inteligibilidade
        if emotion == "whisper":
            rng = np.random.default_rng(2406)
            noise = rng.normal(0.0, 0.004, size=y.shape).astype(np.float32)
            y = y * 0.90 + noise

        peak = float(np.max(np.abs(y))) if y.size else 0.0
        if peak > 0.97:
            y = y * (0.97 / peak)
        return np.tanh(y * 1.02).astype(np.float32)

    @staticmethod
    def _split(text: str):
        chunks = re.findall(r".+?(?:[.!?…]+|$)", text)
        return [c.strip() for c in chunks if c.strip()]

    def synthesize(self, text: str, emotion: str = "auto", tuning: dict | None = None) -> tuple[int, np.ndarray]:
        tuning = tuning or {}
        text = self._pronounce(self._clean(text))
        if not text:
            return SR, np.zeros(1, dtype=np.float32)

        pieces = []
        for chunk in self._split(text):
            emo = self._auto_emotion(chunk, emotion)
            prosody = RECIPE["prosody"][emo]
            voice = self._voice(emo)
            generated = self.pipeline(
                chunk,
                voice=voice,
                speed=float(prosody["speed"]) * max(0.80, min(1.35, float(tuning.get("speed", 1.0) or 1.0))),
                split_pattern=r"\n+"
            )
            local = []
            for result in generated:
                if result.audio is not None:
                    local.append(np.asarray(result.audio, dtype=np.float32))
            if not local:
                continue
            y = np.concatenate(local)
            y = self._post(y, emo, chunk[-3:], tuning)
            pieces.append(y)

            pause_ms = 70
            if chunk.endswith("?"):
                pause_ms = 95
            elif chunk.endswith("!"):
                pause_ms = 75
            elif chunk.endswith(("...", "…")):
                pause_ms = 180
            elif chunk.endswith("."):
                pause_ms = 110
            pieces.append(np.zeros(int(SR * pause_ms / 1000), dtype=np.float32))

        if not pieces:
            return SR, np.zeros(1, dtype=np.float32)
        return SR, np.concatenate(pieces)

    def wav_bytes(self, text: str, emotion: str = "auto", tuning: dict | None = None) -> bytes:
        sr, audio = self.synthesize(text, emotion, tuning)
        out = io.BytesIO()
        sf.write(out, audio, sr, format="WAV", subtype="PCM_16")
        return out.getvalue()
