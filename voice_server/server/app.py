from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .agent_engine import JordanAgentEngine
from .tts_engine import JordanTTSEngine

app = FastAPI(title="JORDAN Core", version="1.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

voice_engine = JordanTTSEngine()
agent_engine = JordanAgentEngine()


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1600)
    emotion: str = "auto"
    tuning: dict = Field(default_factory=dict)


class ToolOutput(BaseModel):
    call_id: str
    output: object


class AgentTurnRequest(BaseModel):
    message: str = ""
    previous_response_id: str | None = None
    tool_outputs: list[ToolOutput] | None = None
    context: dict = Field(default_factory=dict)


@app.get("/health")
def health():
    status = voice_engine.status()
    return {
        "ok": True,
        "core": "JORDAN Core",
        "voice": "JORDAN Spark V1",
        "language": "pt-BR",
        "voice_ready": status["ready"],
        "voice_auto_repair": status["auto_repair"],
        "missing_voice_emotions": status["missing_emotions"],
        "agent_available": agent_engine.available,
        "agent_model": agent_engine.model,
    }


@app.post("/speak")
def speak(req: SpeakRequest):
    try:
        audio = voice_engine.wav_bytes(req.text, req.emotion, req.tuning)
        return Response(content=audio, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {e}")


@app.get("/agent/health")
def agent_health():
    return {
        "ok": True,
        "available": agent_engine.available,
        "model": agent_engine.model,
        "reason": agent_engine.availability_reason,
    }


@app.post("/agent/turn")
def agent_turn(req: AgentTurnRequest):
    if not agent_engine.available:
        raise HTTPException(
            status_code=503,
            detail="Agent Core sem OPENAI_API_KEY. A JORDAN continuará usando o cérebro local legado até a chave ser configurada.",
        )

    try:
        return agent_engine.turn(
            message=req.message,
            previous_response_id=req.previous_response_id,
            tool_outputs=[item.model_dump() for item in req.tool_outputs] if req.tool_outputs else None,
            context=req.context,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent Core error: {e}")
