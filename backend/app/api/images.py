#backend/app/api/images.py

from app.db.auth import verify_user
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Request
from app.utils.logger import log_event
from app.db.supabase import supabase_admin, STORAGE_BUCKET
from app.utils.path_utils import get_raw_image_path
import uuid

router = APIRouter(prefix="/images", tags=["Images"])


@router.post("/upload-raw")
async def upload_raw_image(
    request: Request,
    patient_id: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(verify_user)
):
    doctor_id = user.id

    # Validate image
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")

    image_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    
    file_path = get_raw_image_path(
        doctor_id=doctor_id,
        patient_id=patient_id,
        image_id=image_id,
        extension=ext
    )
    file_bytes = await file.read()

    try:
        supabase_admin.storage.from_(STORAGE_BUCKET).upload(
            file_path,
            file_bytes,
            {"content-type": file.content_type}
        )

        # No more signed URL generation here.
        # Frontend will generate its own signed URLs dynamically.
        pass

    except Exception as e:
        error_msg = str(e)
        log_event(
            level="ERROR",
            action="UPLOAD_IMAGE_ERROR",
            request_id=request.state.request_id,
            actor_id=user.id,
            actor_role="doctor",
            resource_type="patient",
            resource_id=patient_id,
            error_message=error_msg
        )
        raise HTTPException(status_code=500, detail=f"Storage failed: {error_msg}")

    supabase_admin.table("raw_images").insert({
        "id": image_id,
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "file_path": file_path,
        "file_url": file_path # Keep as fallback path, not a signed URL
    }).execute()

    # 4️⃣ Log success
    log_event(
        level="INFO",
        action="UPLOAD_RAW_IMAGE",
        request_id=request.state.request_id,
        actor_id=user.id,
        actor_role="doctor",
        resource_type="raw_image",
        resource_id=image_id,
        metadata={
            "patient_id": patient_id,
            "filename": file.filename
        },
        error_code="UPLOAD_OK"
    )

    return {
        "success": True,
        "image_id": image_id,
        "image_path": file_path
    }
