from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from .tts_engine import JordanTTSEngine

app = FastAPI(title="JORDAN Voice Core", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

engine = JordanTTSEngine()

class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1600)
    emotion: str = "auto"

@app.get("/health")
def health():
    return {"ok": True, "voice": "JORDAN Spark V1", "language": "pt-BR"}

@app.post("/speak")
def speak(req: SpeakRequest):
    try:
        audio = engine.wav_bytes(req.text, req.emotion)
        return Response(content=audio, media_type="audio/wav")
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {e}")
