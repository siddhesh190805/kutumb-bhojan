"""
TTS API route for Kutumb Bhojan.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.app.tts.adapter import tts_service

router = APIRouter(tags=["tts"])


class TTSSpeakRequest(BaseModel):
    text: str = Field(..., min_length=1)
    language: str = "mr-IN"


@router.post("/api/tts/speak")
async def tts_speak(req: TTSSpeakRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Valid text is required")
    result = await tts_service.speak(req.text, req.language)
    return result
