from __future__ import annotations

from pathlib import Path
from threading import Lock
import io
import json
import re
from typing import Any

try:
    import numpy as np
    import soundfile as sf
    import librosa
    from scipy.signal import lfilter
    import torch
    from huggingface_hub import hf_hub_download
    from kokoro import KPipeline
    LOCAL_DEPS_OK = True
except Exception:
    np = None
    sf = None
    librosa = None
    lfilter = None
    torch = None
    hf_hub_download = None
    KPipeline = None
    LOCAL_DEPS_OK = False

ROOT = Path(__file__).resolve().parents[1]
RECIPE = json.loads((ROOT / "config" / "voice_recipe.json").read_text(encoding="utf-8"))
PRON = json.loads((ROOT / "config" / "pronunciation.json").read_text(encoding="utf-8"))
SR = int(RECIPE["sample_rate"])


class JordanTTSEngine:
    """JORDAN Spark V2.

    A identidade vocal é original. Na V0.12 a Spark V2 funciona em modo local
    com Kokoro + embeddings próprios e pós-processamento de prosódia. O cérebro
    Manual Core roda separadamente no navegador e não depende de API.
    """

    def __init__(self):
        # V0.12: a voz é deliberadamente local. Mesmo que um .env antigo ainda
        # exista no PC, ele não volta a ativar serviços de IA/cloud por acidente.
        self.provider_mode = "local"
        self.pipeline = None
        self._voice_cache: dict[str, Any] = {}
        self._build_lock = Lock()
        self._base_voice_cache: dict[str, Any] = {}
        self.last_provider = None
        self.last_error = None

    @property
    def local_available(self) -> bool:
        return bool(LOCAL_DEPS_OK and KPipeline is not None)

    def _ensure_local_pipeline(self):
        if not self.local_available:
            raise RuntimeError("Dependências do JORDAN Spark Local não estão disponíveis. Rode SETUP_WINDOWS.bat.")
        if self.pipeline is None:
            self.pipeline = KPipeline(lang_code="p")
        return self.pipeline

    def _load_base_voice(self, name: str):
        if name not in self._base_voice_cache:
            if not self.local_available:
                raise RuntimeError("Voice Core local indisponível.")
            voice_path = Path(hf_hub_download(
                repo_id=RECIPE["base_repo"],
                filename=f"voices/{name}.pt"
            ))
            self._base_voice_cache[name] = torch.load(
                voice_path, map_location="cpu", weights_only=True
            ).float()
        return self._base_voice_cache[name]

    def _build_voice(self, emotion: str, path: Path):
        weights = RECIPE["emotion_mix"].get(emotion) or RECIPE["emotion_mix"]["neutral"]
        total = sum(float(value) for value in weights.values())
        if total <= 0:
            raise ValueError("Voice recipe inválida: pesos zerados.")

        mixed = None
        for name, weight in weights.items():
            weight = float(weight)
            if weight <= 0:
                continue
            tensor = self._load_base_voice(name)
            term = tensor * (weight / total)
            mixed = term if mixed is None else mixed + term

        if mixed is None:
            raise RuntimeError("Não consegui construir a identidade vocal local da JORDAN.")

        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(mixed.contiguous(), path)
        return mixed.contiguous()

    def _voice(self, emotion: str):
        emotion = emotion if emotion in RECIPE["emotion_mix"] else "neutral"
        if emotion not in self._voice_cache:
            path = ROOT / "model" / f"jordan_spark_v2_{emotion}.pt"
            with self._build_lock:
                if emotion in self._voice_cache:
                    return self._voice_cache[emotion]
                if path.exists():
                    voice = torch.load(path, map_location="cpu", weights_only=True).float()
                else:
                    voice = self._build_voice(emotion, path)
                self._voice_cache[emotion] = voice
        return self._voice_cache[emotion]

    def status(self):
        emotions = list(RECIPE["emotion_mix"].keys())
        missing = [
            emotion for emotion in emotions
            if not (ROOT / "model" / f"jordan_spark_v2_{emotion}.pt").exists()
        ]
        selected = "local"
        ready = self.local_available
        return {
            "ready": bool(ready),
            "name": RECIPE.get("name", "JORDAN Spark V2"),
            "provider_mode": self.provider_mode,
            "provider": selected,
            "local_available": self.local_available,
            "missing_emotions": missing,
            "auto_repair": self.local_available,
            "cached_emotions": sorted(self._voice_cache.keys()),
            "last_provider": self.last_provider,
            "last_error": self.last_error,
        }

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
    def _presence(audio, amount: float):
        if abs(amount) < 1e-5:
            return audio
        if amount > 0:
            emphasized = lfilter([1.0, -0.72], [1.0], audio)
            return audio * (1.0 - amount) + emphasized * amount
        smooth = lfilter([0.18, 0.18, 0.18, 0.18, 0.18], [1.0], audio)
        a = min(1.0, abs(amount) * 3.0)
        return audio * (1.0 - a) + smooth * a

    def _post(self, audio, emotion: str, punctuation: str = "", tuning: dict | None = None):
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
            tail = librosa.effects.pitch_shift(y[cut:], sr=SR, n_steps=0.62 * expressiveness).astype(np.float32)
            y = np.concatenate([y[:cut], tail])

        if "!" in punctuation:
            y *= 1.0 + (0.035 * expressiveness)

        if emotion == "whisper":
            rng = np.random.default_rng(2406)
            noise = rng.normal(0.0, 0.0035, size=y.shape).astype(np.float32)
            y = y * 0.91 + noise

        peak = float(np.max(np.abs(y))) if y.size else 0.0
        if peak > 0.97:
            y = y * (0.97 / peak)
        return np.tanh(y * 1.02).astype(np.float32)

    @staticmethod
    def _split(text: str):
        chunks = re.findall(r".+?(?:[.!?…]+|$)", text)
        return [c.strip() for c in chunks if c.strip()]

    def synthesize(self, text: str, emotion: str = "auto", tuning: dict | None = None):
        self._ensure_local_pipeline()
        tuning = tuning or {}
        text = self._pronounce(self._clean(text))
        if not text:
            return SR, np.zeros(1, dtype=np.float32)

        pieces = []
        for chunk in self._split(text):
            emo = self._auto_emotion(chunk, emotion)
            if emo not in RECIPE["prosody"]:
                emo = "neutral"
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

            pause_ms = 62
            if chunk.endswith("?"):
                pause_ms = 88
            elif chunk.endswith("!"):
                pause_ms = 68
            elif chunk.endswith(("...", "…")):
                pause_ms = 165
            elif chunk.endswith("."):
                pause_ms = 95
            pieces.append(np.zeros(int(SR * pause_ms / 1000), dtype=np.float32))

        if not pieces:
            return SR, np.zeros(1, dtype=np.float32)
        return SR, np.concatenate(pieces)

    def _local_wav_bytes(self, text: str, emotion: str = "auto", tuning: dict | None = None) -> bytes:
        sr, audio = self.synthesize(text, emotion, tuning)
        out = io.BytesIO()
        sf.write(out, audio, sr, format="WAV", subtype="PCM_16")
        return out.getvalue()

    def wav_bytes(self, text: str, emotion: str = "auto", tuning: dict | None = None) -> bytes:
        self.last_error = None
        try:
            audio = self._local_wav_bytes(text, emotion, tuning)
            self.last_provider = "local"
            return audio
        except Exception as exc:
            self.last_error = f"Local TTS: {exc}"
            raise RuntimeError(self.last_error) from exc
