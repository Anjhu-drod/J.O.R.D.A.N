from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .tts_engine import JordanTTSEngine

app = FastAPI(title="JORDAN Voice Core", version="1.4")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

voice_engine = JordanTTSEngine()


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1800)
    emotion: str = "auto"
    tuning: dict = Field(default_factory=dict)


@app.get("/health")
def health():
    status = voice_engine.status()
    return {
        "ok": True,
        "core": "JORDAN Voice Core",
        "voice": status.get("name", "JORDAN Spark V2"),
        "language": "pt-BR",
        "voice_ready": status["ready"],
        "voice_provider": "local",
        "voice_local_available": status.get("local_available"),
        "voice_auto_repair": status["auto_repair"],
        "missing_voice_emotions": status["missing_emotions"],
        "voice_last_provider": status.get("last_provider"),
        "voice_last_error": status.get("last_error"),
        "manual_core": "browser-local",
        "manual_core_requires_server": False,
    }


@app.post("/speak")
def speak(req: SpeakRequest):
    try:
        audio = voice_engine.wav_bytes(req.text, req.emotion, req.tuning)
        return Response(content=audio, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {e}")
