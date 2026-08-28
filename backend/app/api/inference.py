# backend/app/api/inference.py

from fastapi import APIRouter, Depends, HTTPException, Body, Request
import uuid

from app.db.auth import verify_user
from app.services.inference.inference_service import inference_service

router = APIRouter(prefix="/inference", tags=["Inference"])

# ─────────────────────────────────────────────
# PRIMARY INFERENCE ENDPOINT (FAST - NO LLM)
# ─────────────────────────────────────────────

@router.post("/run")
async def run_inference(
    request: Request,
    image_id: uuid.UUID = Body(..., embed=True),
    user=Depends(verify_user)
):
    """
    Run ML inference pipeline on an uploaded raw image.
    Delegates all orchestration to InferenceService.
    """
    try:
        result = await inference_service.run_inference(
            image_id=image_id,
            user_id=user.id,
            request_id=request.state.request_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


# ─────────────────────────────────────────────
# ON-DEMAND AI EXPLANATION ENDPOINT
# ─────────────────────────────────────────────

@router.post("/{prediction_id}/explain")
async def generate_prediction_explanation(
    request: Request,
    prediction_id: uuid.UUID,
    use_llm: bool = Body(True, embed=True),
    user=Depends(verify_user)
):
    """
    Generate AI explanation for an existing prediction.
    Delegates orchestration to InferenceService.
    """
    try:
        result = await inference_service.generate_explanation(
            prediction_id=prediction_id,
            user_id=user.id,
            request_id=request.state.request_id,
            use_llm=use_llm
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation generation failed: {str(e)}")
