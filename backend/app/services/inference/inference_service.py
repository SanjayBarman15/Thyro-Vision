# backend/app/services/inference/inference_service.py

import uuid
import os
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool

from app.db.supabase import supabase_admin, STORAGE_BUCKET
from app.services.inference.inference_pipeline import InferencePipeline
from app.utils.logger import log_event
from app.services.explainability.common.response_generator import ResponseGenerator
from app.utils.image_processing import generate_gradcam_overlay, convert_to_grayscale
from app.utils.path_utils import get_processed_image_path
from app.tasks.notifications import send_notification_task

class InferenceService:
    def __init__(self):
        self.pipeline = InferencePipeline()
        self.supabase = supabase_admin
        self.storage_bucket = STORAGE_BUCKET

    async def run_inference(
        self, 
        image_id: uuid.UUID, 
        user_id: str, 
        request_id: str
    ) -> Dict[str, Any]:
        """
        Orchestrates the full inference flow:
        load image -> call pipeline -> handle storage/uploads -> persist DB records -> trigger notifications.
        """
        # 1️⃣ Fetch raw image record
        res = (
            self.supabase.table("raw_images")
            .select("*")
            .eq("id", str(image_id))
            .single()
            .execute()
        )

        raw_image = res.data
        if not raw_image:
            raise ValueError("Raw image not found")

        # 2️⃣ Download raw image bytes from Supabase Storage
        bucket = self.supabase.storage.from_(self.storage_bucket)
        try:
            raw_bytes = bucket.download(raw_image["file_path"])
        except Exception as e:
            raise RuntimeError(f"Failed to download image: {str(e)}")

        # 3️⃣ Run inference pipeline (Pure ML offloaded to threadpool)
        # We now handle the async/threadpool wrap here in the service layer.
        inference = await run_in_threadpool(self.pipeline.run, raw_bytes)

        # 4️⃣ Preprocessing (grayscale)
        try:
            processed_bytes = convert_to_grayscale(raw_bytes)
        except Exception as e:
            print(f"Warning: Preprocessing failed: {e}")
            processed_bytes = raw_bytes # Fallback

        # 5️⃣ Build processed image storage path
        processed_path = get_processed_image_path(
            version=inference['pipeline_version'],
            tirads=inference['tirads'],
            doctor_id=raw_image['doctor_id'],
            patient_id=raw_image['patient_id'],
            image_id=str(image_id)
        )

        # 6️⃣ Upload processed image
        try:
            bucket.upload(
                processed_path,
                processed_bytes,
                {"content-type": "image/jpeg"}
            )
        except Exception as e:
            if "already exists" not in str(e).lower():
                print(f"Warning: Processed storage upload failed: {e}")

        # 7️⃣ Process Grad-CAM Overlay & Prepare DB metadata
        grad_cam_data = inference.get("grad_cam_data", {})
        
        # Extract the upsampled heatmap for overlay generation (in-memory only)
        heatmap_299 = grad_cam_data.get("_heatmap_upsampled_memory_only")
        
        gradcam_path = None
        if heatmap_299:
            try:
                gradcam_bytes = generate_gradcam_overlay(
                    raw_bytes, 
                    heatmap_299, 
                    inference["bounding_box"]
                )
                
                gradcam_path = get_processed_image_path(
                    version=inference['pipeline_version'],
                    tirads=inference['tirads'],
                    doctor_id=raw_image['doctor_id'],
                    patient_id=raw_image['patient_id'],
                    image_id=str(image_id),
                    prefix="gradcam"
                )
                
                bucket.upload(
                    gradcam_path,
                    gradcam_bytes,
                    {"content-type": "image/jpeg"}
                )
            except Exception as gc_err:
                print(f"Failed to process/upload Grad-CAM: {gc_err}")

        # 8️⃣ Format Grad-CAM metadata for Database
        # We nest the technical Grad-CAM fields under 'grad_cam_data' to match frontend expectations
        # while keeping 'gradcam_available' at the top level for easy checking.
        explanation_metadata = {
            "gradcam_available": grad_cam_data.get("gradcam_available", False),
            "grad_cam_data": {
                "target_layer":  grad_cam_data.get("target_layer"),
                "target_class":  grad_cam_data.get("target_class"),
                "heatmap_shape": grad_cam_data.get("heatmap_shape"),
                "heatmap":       grad_cam_data.get("heatmap"),       # 10x10 compact
                "color_mapping": grad_cam_data.get("color_mapping"),
                "top_features":  grad_cam_data.get("top_features"),
                "gradcam_image_path": gradcam_path,
                "gradcam_image_url": gradcam_path
            }
        }

        # 9️⃣ Insert processed_images record
        processed_image_id = str(uuid.uuid4())
        self.supabase.table("processed_images").insert({
            "id": processed_image_id,
            "raw_image_id": str(image_id),
            "file_path": processed_path,
            "file_url": processed_path # Dynamic URLs handled by frontend
        }).execute()

        # 🔟 Insert prediction record
        pred_res = self.supabase.table("predictions").insert({
            "raw_image_id": str(image_id),
            "predicted_class": inference["predicted_class"],
            "tirads": inference["tirads"],
            "confidence": inference["confidence"],
            "tirads_confidences": inference["tirads_confidences"],
            "model_version": inference["pipeline_version"],
            "model_metadata": inference["models"],
            "explanation_metadata": explanation_metadata,
            "inference_time_ms": inference["inference_time_ms"],
            "features": inference["features"],
            "bounding_box": inference["bounding_box"],
            "processed_image_id": processed_image_id,
            "training_candidate": False
        }).execute()

        if not pred_res.data:
            raise RuntimeError("Failed to save prediction")

        prediction = pred_res.data[0]

        # 1️⃣1️⃣ System logging
        log_event(
            level="INFO",
            action="MODEL_INFERENCE",
            request_id=request_id,
            actor_id=user_id,
            actor_role="doctor",
            resource_type="prediction",
            resource_id=prediction["id"],
            metadata={
                "tirads": inference["tirads"],
                "confidence": inference["confidence"],
                "roi_score": inference.get("roi_score", 0.0),
                "inference_time_ms": inference["inference_time_ms"]
            },
            error_code="INFERENCE_OK"
        )
        
        # 1️⃣2️⃣ Dispatch Real-time Notification
        try:
            self._dispatch_notification(prediction, raw_image, user_id, inference['tirads'])
        except Exception as e:
            print(f"Failed to dispatch notification: {e}")

        return {
            "success": True,
            "prediction": prediction,
            "bounding_box": inference["bounding_box"]
        }

    async def generate_explanation(
        self,
        prediction_id: uuid.UUID,
        user_id: str,
        request_id: str,
        use_llm: bool = True
    ) -> Dict[str, Any]:
        """
        Orchestrates AI explanation generation and persistence.
        """
        # 1️⃣ Fetch prediction
        res = (
            self.supabase.table("predictions")
            .select("*")
            .eq("id", str(prediction_id))
            .single()
            .execute()
        )

        prediction = res.data
        if not prediction:
            raise ValueError("Prediction not found")

        # 2️⃣ Return cached explanation if exists
        if prediction.get("ai_explanation"):
            return {
                "success": True,
                "prediction_id": str(prediction_id),
                "ai_explanation": prediction["ai_explanation"],
                "explanation_metadata": prediction.get("explanation_metadata")
            }

        # 3️⃣ Generate explanation via LLM or fallback
        result = await ResponseGenerator.generate(
            features=prediction["features"],
            tirads=prediction["tirads"],
            confidence=prediction["confidence"],
            use_llm=use_llm
        )

        # 4️⃣ Store explanation in DB
        existing_metadata = prediction.get("explanation_metadata") or {}
        updated_metadata = {
            **existing_metadata,
            **result["explanation_metadata"]
        }

        self.supabase.table("predictions").update({
            "ai_explanation": result["ai_explanation"],
            "explanation_metadata": updated_metadata
        }).eq("id", str(prediction_id)).execute()

        # 5️⃣ Log explanation event
        log_event(
            level="INFO",
            action="GENERATE_EXPLANATION",
            request_id=request_id,
            actor_id=user_id,
            actor_role="doctor",
            resource_type="prediction",
            resource_id=str(prediction_id),
            metadata={
                "engine": result["explanation_metadata"]["engine"],
                "is_fallback": result["explanation_metadata"]["is_fallback"]
            },
            error_code="EXPLANATION_OK"
        )

        return {
            "success": True,
            "prediction_id": str(prediction_id),
            **result
        }

    def _dispatch_notification(self, prediction, raw_image, user_id, tirads):
        patient_res = self.supabase.table("patients").select("first_name, last_name").eq("id", str(raw_image["patient_id"])).single().execute()
        patient_name = "Patient"
        if patient_res.data:
            patient_name = f"{patient_res.data['first_name']} {patient_res.data['last_name']}"

        is_high_risk = int(tirads) >= 5
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        subject = f"Analysis Ready: {patient_name} (TR{tirads})"
        
        if is_high_risk:
            subject = f"🚨 [URGENT] High Risk Detected: {patient_name} (TR5)"

        notification_payload = {
            "title": "Analysis Ready",
            "body": f"{patient_name}'s scan (TI-RADS {tirads}) is complete.",
            "subject": subject,
            "prediction_id": str(prediction["id"]),
            "patient_id": str(raw_image["patient_id"]),
            "html": f"<h3>ThyroVision Analysis Complete</h3><p>Patient: <b>{patient_name}</b></p><p>Result: <b>TI-RADS {tirads}</b></p><p><a href='{frontend_url}/dashboard/analysis/{prediction['id']}'>View Full Report</a></p>"
        }
        
        send_notification_task.delay(
            user_id, 
            "INFERENCE_COMPLETE", 
            ["push", "email"], 
            notification_payload
        )

# Global singleton
inference_service = InferenceService()