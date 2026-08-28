# backend/app/api/explain.py

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from app.db.auth import verify_user
from pydantic import BaseModel
from typing import Optional, Dict
from app.services.explainability.chatbot.chat_service import chat_service

router = APIRouter(prefix="/explain", tags=["Explainability"])

class ChatRequest(BaseModel):
    prediction_id: str
    message: str
    simulation_modifications: Optional[Dict] = None

@router.post("/chat")
async def clinical_chat(
    payload: ChatRequest,
    user=Depends(verify_user)
):
    """
    SSE endpoint for verified clinical diagnostic assistance.
    """
    try:
        # We use a streaming response to handle long-running AI generations
        return StreamingResponse(
            chat_service.generate_chat_stream(
                prediction_id=payload.prediction_id,
                user_message=payload.message,
                simulation_modifications=payload.simulation_modifications
            ),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
