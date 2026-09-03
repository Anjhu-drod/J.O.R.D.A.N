from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import soundfile as sf
from server.tts_engine import JordanTTSEngine

TESTS = {
    "neutral": "Oi. Eu sou a JORDAN. Estou pronta para começar.",
    "happy": "Bom dia! Que bom te ver por aqui.",
    "excited": "Consegui! Isso ficou muito melhor!",
    "curious": "Hmm... quer que eu pesquise isso para você?",
    "playful": "Tá, essa foi boa. Agora me conta a próxima!",
    "serious": "Atenção. Eu encontrei uma informação importante.",
    "soft": "Tudo bem. Eu posso falar mais baixo.",
    "surprised": "Espera! Você viu isso?",
}

def main():
    out = ROOT / "samples"
    out.mkdir(exist_ok=True)
    tts = JordanTTSEngine()
    for emotion, text in TESTS.items():
        sr, audio = tts.synthesize(text, emotion)
        path = out / f"jordan_{emotion}.wav"
        sf.write(path, audio, sr, subtype="PCM_16")
        print("OK:", path)

if __name__ == "__main__":
    main()
