# backend/app/api/profiles.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.db.supabase import get_supabase
from app.db.auth import verify_user
from app.utils.logger import log_event
from datetime import datetime

router = APIRouter(prefix="/profiles", tags=["Profiles"])

class FCMUpdate(BaseModel):
    fcm_token: str
    email: str = None

@router.put("/fcm-token")
async def update_fcm_token(
    data: FCMUpdate,
    user=Depends(verify_user)
):
    """
    Updates or creates a profile with the user's FCM token.
    """
    supabase = get_supabase()
    user_id = str(user.id)

    try:
        # Upsert profile record
        res = supabase.table("profiles").upsert({
            "id": user_id,
            "email": data.email or user.email,
            "fcm_token": data.fcm_token,
            "last_seen_at": datetime.utcnow().isoformat()
        }).execute()

        log_event(
            level="INFO",
            action="FCM_TOKEN_UPDATED",
            actor_id=user_id,
            metadata={"email": data.email}
        )

        return {"status": "success", "message": "FCM token updated"}
    except Exception as e:
        print(f"❌ PROFILE_SYNC_ERROR: {str(e)}")
        log_event(
            level="ERROR",
            action="FCM_TOKEN_UPDATE_FAILED",
            actor_id=user_id,
            error_message=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))
