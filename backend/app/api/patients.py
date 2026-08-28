#backend/app/api/patients.py
from fastapi import APIRouter, Depends, HTTPException
from app.db.supabase import supabase_admin
from app.db.auth import verify_user
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from app.utils.logger import log_event

router = APIRouter(prefix="/patients", tags=["Patients"])

class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    dob: str
    gender: str
    past_medical_data: Optional[str] = None

@router.post("/")
async def create_patient(
    patient: PatientCreate,
    request: Request,
    user=Depends(verify_user)
):
    doctor_id = user.id

    res = supabase_admin.table("patients").insert({
        "doctor_id": doctor_id,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "dob": patient.dob,
        "gender": patient.gender,
        "past_medical_data": patient.past_medical_data
    }).execute()

    new_patient = res.data[0]

    # 3️⃣ Log event
    log_event(
        level="INFO",
        action="CREATE_PATIENT",
        request_id=request.state.request_id,
        actor_id=user.id,
        actor_role="doctor",
        resource_type="patient",
        resource_id=new_patient["id"],
        metadata={
            "first_name": patient.first_name,
            "last_name": patient.last_name
        },
        error_code="PATIENT_CREATED"
    )

    return {"success": True, "patient": new_patient}


@router.get("/{id}/compare")
async def compare_patient_scans(
    id: str,
    id_a: str,
    id_b: str,
    user=Depends(verify_user)
):
    """
    Returns an AI-generated comparison between two specific scans (predictions) for a patient.
    """
    from app.services.explainability.comparison.comparison_service import compare_scans
    
    # 1. Verify predictions belong to this patient
    # We check if both predictions' raw images are linked to this patient_id
    res = supabase_admin.table("predictions").select(
        "id, raw_images!inner(patient_id)"
    ).in_("id", [id_a, id_b]).execute()
    
    if len(res.data) < 2:
        raise HTTPException(status_code=404, detail="One or both scans not found")
    
    for item in res.data:
        if str(item["raw_images"]["patient_id"]) != id:
            raise HTTPException(status_code=403, detail="Scan does not belong to this patient")

    # 2. Get AI Comparison
    try:
        summary = await compare_scans(id_a, id_b)
        return {
            "success": True,
            "comparison": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
