# app/api/feedback.py
from fastapi import APIRouter, Depends, HTTPException
from app.db.supabase import supabase_admin
from app.db.auth import verify_user
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from fastapi import Request
from app.utils.logger import log_event

router = APIRouter(prefix="/predictions", tags=["Feedback"])


# ============================
# Pydantic Schema
# ============================
class FeedbackSubmit(BaseModel):
    is_correct: bool
    corrected_tirads: Optional[int] = Field(None, ge=1, le=5)
    corrected_features: Optional[Dict[str, Any]] = None
    comments: Optional[str] = None


# ============================
# Auto-trigger: Create draft training label
# Called automatically when doctor marks prediction as incorrect
# ============================
def create_draft_training_label(
    prediction_id: str,
    raw_image_id: str,
    feedback_data: dict,
    prediction: dict,
):
    """
    Automatically creates a draft training_label when:
    1. Doctor marks prediction as incorrect
    2. No existing draft label for this image
    3. Prediction confidence > 0.3 (filters junk predictions)

    This feeds the curation queue without any manual admin trigger.
    """
    try:
        # ── Quality filter: skip low confidence predictions ──
        confidence = prediction.get("confidence", 0)
        if confidence < 0.3:
            print(f"Skipping training label — low confidence: {confidence}")
            return None

        # ── Check no existing draft label for this image ────
        existing_label = supabase_admin.table("training_labels") \
            .select("id") \
            .eq("raw_image_id", raw_image_id) \
            .eq("status", "draft") \
            .execute()

        if existing_label.data:
            print(f"Draft label already exists for image {raw_image_id}")
            return None

        # ── Determine what needs correction ─────────────────
        corrected_features = feedback_data.get("corrected_features") or {}
        bbox_correct = corrected_features.get("bbox_correct", True)
        tirads_correct = feedback_data.get("is_correct", True)

        needs_bbox_correction   = not bbox_correct
        needs_tirads_correction = not tirads_correct

        # ── Build metadata for admin context ────────────────
        metadata = {
            "needs_bbox_correction":   needs_bbox_correction,
            "needs_tirads_correction":  needs_tirads_correction,
            "bbox_issue":              corrected_features.get("bbox_issue"),
            "ai_bbox":                 prediction.get("bounding_box"),
            "ai_tirads":               prediction.get("tirads"),
            "ai_confidence":           confidence,
            "feedback_id":             feedback_data.get("id"),
        }

        # ── Create draft training label ──────────────────────
        label_data = {
            "raw_image_id":  raw_image_id,
            "labeled_by":    "doctor",
            "tirads":        feedback_data.get("corrected_tirads")
                             or prediction.get("tirads"),
            "bounding_boxes": prediction.get("bounding_box"),
            "notes":         feedback_data.get("comments"),
            "approved":      False,
            "status":        "draft",
            "metadata":      metadata,
        }

        result = supabase_admin.table("training_labels") \
            .insert(label_data) \
            .execute()

        if result.data:
            print(f"✅ Draft training label created: {result.data[0]['id']}")
            return result.data[0]

        return None

    except Exception as e:
        # Non-fatal — log warning but don't fail the feedback submission
        print(f"⚠️  Warning: Failed to create training label: {e}")
        return None


# ============================
# Submit Feedback
# ============================
@router.post("/{prediction_id}/feedback")
async def submit_feedback(
    prediction_id: str,
    feedback: FeedbackSubmit,
    request: Request,
    user=Depends(verify_user)
):
    # 1️⃣ Ensure prediction exists — fetch full prediction for auto-trigger
    pred_res = supabase_admin.table("predictions") \
        .select("id, raw_image_id, tirads, confidence, bounding_box") \
        .eq("id", prediction_id) \
        .single() \
        .execute()

    prediction = pred_res.data
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    # 2️⃣ Ownership check
    raw_res = supabase_admin.table("raw_images") \
        .select("doctor_id") \
        .eq("id", prediction["raw_image_id"]) \
        .single() \
        .execute()

    if not raw_res.data or raw_res.data["doctor_id"] != user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to submit feedback"
        )

    # 3️⃣ Prevent duplicate feedback
    existing = supabase_admin.table("prediction_feedback") \
        .select("id") \
        .eq("prediction_id", prediction_id) \
        .execute()

    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="Feedback already submitted for this prediction"
        )

    # 4️⃣ Insert feedback
    feedback_data = {
        "prediction_id":      prediction_id,
        "doctor_id":          user.id,
        "is_correct":         feedback.is_correct,
        "corrected_tirads":   feedback.corrected_tirads,
        "corrected_features": feedback.corrected_features,
        "comments":           feedback.comments,
    }

    try:
        res = supabase_admin.table("prediction_feedback") \
            .insert(feedback_data) \
            .execute()
    except Exception as e:
        log_event(
            level="ERROR",
            action="SUBMIT_FEEDBACK_ERROR",
            request_id=request.state.request_id,
            actor_id=user.id,
            actor_role="doctor",
            resource_type="prediction",
            resource_id=prediction_id,
            error_message=str(e)
        )
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save feedback")

    saved_feedback = res.data[0]

    # 4.5️⃣ Log success
    log_event(
        level="INFO",
        action="SUBMIT_FEEDBACK",
        request_id=request.state.request_id,
        actor_id=user.id,
        actor_role="doctor",
        resource_type="prediction",
        resource_id=prediction_id,
        metadata={
            "is_correct":   feedback.is_correct,
            "tirads":       feedback.corrected_tirads,
        },
        error_code="FEEDBACK_OK"
    )

    # 5️⃣ If incorrect — flag prediction + auto-create draft training label
    training_label = None
    if not feedback.is_correct:
        try:
            # Flag prediction as training candidate
            supabase_admin.table("predictions") \
                .update({"training_candidate": True}) \
                .eq("id", prediction_id) \
                .execute()

            # ── AUTO-TRIGGER: create draft training label ──
            training_label = create_draft_training_label(
                prediction_id=prediction_id,
                raw_image_id=prediction["raw_image_id"],
                feedback_data={
                    **saved_feedback,
                    "corrected_features": feedback.corrected_features,
                },
                prediction=prediction,
            )

            # Log training label creation
            if training_label:
                log_event(
                    level="INFO",
                    action="TRAINING_LABEL_CREATED",
                    request_id=request.state.request_id,
                    actor_id=user.id,
                    actor_role="doctor",
                    resource_type="training_label",
                    resource_id=training_label["id"],
                    metadata={
                        "prediction_id": prediction_id,
                        "auto_triggered": True,
                    },
                    error_code="LABEL_CREATED"
                )

        except Exception as e:
            # Non-fatal — feedback already saved successfully
            print(f"⚠️  Warning: Failed to flag training candidate: {e}")

    return {
        "success": True,
        "feedback": saved_feedback,
        "training_label_created": training_label is not None,
        "training_label_id": training_label["id"] if training_label else None,
    }


# ============================
# Get Feedback
# ============================
@router.get("/{prediction_id}/feedback")
async def get_feedback(
    prediction_id: str,
    user=Depends(verify_user)
):
    # 1️⃣ Check prediction exists
    pred_res = supabase_admin.table("predictions") \
        .select("id, raw_image_id") \
        .eq("id", prediction_id) \
        .single() \
        .execute()

    prediction = pred_res.data
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    # 2️⃣ Ownership check
    raw_res = supabase_admin.table("raw_images") \
        .select("doctor_id") \
        .eq("id", prediction["raw_image_id"]) \
        .single() \
        .execute()

    if not raw_res.data or raw_res.data["doctor_id"] != user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view feedback"
        )

    # 3️⃣ Fetch feedback
    res = supabase_admin.table("prediction_feedback") \
        .select("*") \
        .eq("prediction_id", prediction_id) \
        .execute()

    if not res.data:
        return {"success": True, "feedback": None}

    return {
        "success": True,
        "feedback": res.data[0]
    }