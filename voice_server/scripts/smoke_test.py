from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from server.tts_engine import JordanTTSEngine

tts = JordanTTSEngine()
sr, audio = tts.synthesize("Oi Jhuan! Eu sou a JORDAN. Pronta?", "auto")
print("sample_rate:", sr, "samples:", len(audio))
