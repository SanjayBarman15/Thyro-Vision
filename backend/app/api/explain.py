# backend/app/api/explain.py

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from app.db.auth import verify_user
from pydantic import BaseModel
from typing import Optional, Dict
from app.services.explainability.chatbot.chat_service import chat_service

router = APIRouter(prefix="/explain", tags=["Explainability"])


class ChatRequest(BaseModel):
    prediction_id: Optional[str] = None          # Scan-linked mode (real scan)
    message: str
    simulation_modifications: Optional[Dict] = None
    features_input: Optional[Dict[str, str]] = None  # Standalone mode (no scan)


@router.post("/chat")
async def clinical_chat(
    payload: ChatRequest,
    user=Depends(verify_user)
):
    """
    SSE endpoint for verified clinical diagnostic assistance.

    Supports two modes:
    1. Scan-linked: prediction_id required — analyses a real stored scan.
    2. Standalone: features_input provided — scores a hypothetical feature set.
    """
    if not payload.prediction_id and not payload.features_input:
        raise HTTPException(
            status_code=422,
            detail="Either prediction_id or features_input must be provided."
        )

    try:
        return StreamingResponse(
            chat_service.generate_chat_stream(
                prediction_id=payload.prediction_id,
                user_message=payload.message,
                simulation_modifications=payload.simulation_modifications,
                features_input=payload.features_input,
            ),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
