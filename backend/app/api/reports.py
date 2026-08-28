# backend/app/api/reports.py
from fastapi import APIRouter, HTTPException, Response, Depends, Request
from app.db.supabase import supabase_admin, STORAGE_BUCKET
from app.services.reports.pdf_generator import PDFReportGenerator
from app.db.auth import verify_user
from app.utils.logger import log_event

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/pdf/{prediction_id}")
async def export_pdf(
    prediction_id: str,
    request: Request,
    user=Depends(verify_user)
):
    try:
        # 1️⃣ Fetch prediction
        res = (
            supabase_admin.table("predictions")
            .select("*")
            .eq("id", prediction_id)
            .single()
            .execute()
        )

        if not res.data:
            raise HTTPException(404, "Prediction not found")

        pred = res.data

        # 2️⃣ Fetch raw image record
        raw_res = (
            supabase_admin.table("raw_images")
            .select("*")
            .eq("id", pred["raw_image_id"])
            .single()
            .execute()
        )

        if not raw_res.data:
            raise HTTPException(404, "Raw image not found")
            
        raw_image = raw_res.data

        # 3️⃣ Fetch Patient details
        patient_res = (
            supabase_admin.table("patients")
            .select("*")
            .eq("id", raw_image["patient_id"])
            .single()
            .execute()
        )
        
        patient = patient_res.data if patient_res.data else {}
        name = f"{patient.get('first_name', 'Unknown')} {patient.get('last_name', '')}".strip() or "N/A"

        # 4️⃣ Download raw image bytes
        try:
            bucket = supabase_admin.storage.from_(STORAGE_BUCKET)
            image_bytes = bucket.download(raw_image["file_path"])
        except Exception as e:
            raise HTTPException(500, f"Failed to download image: {str(e)}")

        # 4.5️⃣ Download Grad-CAM bytes (if available)
        gradcam_bytes = None
        gradcam_path = pred.get("explanation_metadata", {}).get("gradcam_image_path")
        print(f"DEBUG: Fetching PDF for {prediction_id}. Grad-CAM path in DB: {gradcam_path}")
        if gradcam_path:
            try:
                gradcam_bytes = bucket.download(gradcam_path)
                print(f"DEBUG: Successfully downloaded {len(gradcam_bytes)} bytes for Grad-CAM report.")
            except Exception as e:
                print(f"ERROR: Failed to download Grad-CAM from {gradcam_path}: {e}")

        # 5️⃣ Generate PDF
        pdf_bytes = PDFReportGenerator.generate_pdf(
            data={
                "patient": {
                    "name": name,
                    "age": str(patient.get("age", "N/A")),
                    "gender": patient.get("gender", "N/A"),
                    "date": raw_image.get("created_at", "").split("T")[0]
                },
                "prediction": pred
            },
            raw_image_bytes=image_bytes,
            gradcam_bytes=gradcam_bytes
        )

        # 6️⃣ Log success to system logs
        log_event(
            level="INFO",
            action="EXPORT_PDF",
            request_id=request.state.request_id,
            actor_id=user.id,
            actor_role="doctor",
            resource_type="prediction",
            resource_id=prediction_id,
            error_code="EXPORT_PDF_OK"
        )

        # 6.5️⃣ Record export event in report_exports table for longitudinal tracking
        try:
            supabase_admin.table("report_exports").insert({
                "prediction_id": prediction_id,
                "patient_id": raw_image["patient_id"],
                "doctor_id": user.id,
                "report_id": pred.get("report_id"),
                "tirads_at_export": pred.get("tirads"),
                "pipeline_version": pred.get("model_version")
            }).execute()
        except Exception as export_err:
            # We log but don't fail the request if logging to report_exports fails, 
            # as the user still needs their PDF.
            print(f"CRITICAL: Failed to record report_export for {prediction_id}: {export_err}")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={pred.get('report_id', prediction_id)}.pdf"
            }
        )
    except Exception as e:
        # 7️⃣ Log error
        log_event(
            level="ERROR",
            action="EXPORT_PDF_ERROR",
            request_id=request.state.request_id,
            actor_id=user.id if user else None,
            actor_role="doctor",
            resource_type="prediction",
            resource_id=prediction_id,
            exception=e
        )
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
