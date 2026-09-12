"""
TTS API route for Kutumb Bhojan.
"""
import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from backend.app.tts.adapter import tts_service
from backend.app.infrastructure.supabase import supabase_client

router = APIRouter(tags=["tts"])


class TTSSpeakRequest(BaseModel):
    text: str = Field(..., min_length=1)
    language: str = "mr-IN"


async def require_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        user = await supabase_client.aget_user_from_token(token, http_client=http_client)
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return token


@router.post("/api/tts/speak")
async def tts_speak(req: TTSSpeakRequest, authorization: str | None = Header(default=None)):
    await require_bearer_token(authorization)
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Valid text is required")
    result = await tts_service.speak(req.text, req.language)
    return result
