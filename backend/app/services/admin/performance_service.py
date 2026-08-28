# app/services/admin/performance_service.py
import os
from app.db.supabase import get_supabase
from app.utils.logger import log_event

class PerformanceService:
    def record_snapshot(self, admin_id: str):
        supabase = get_supabase()

        pipeline_version = os.getenv("PIPELINE_VERSION")
        roi_version      = os.getenv("ROI_DETECTOR_VERSION")
        xception_version = os.getenv("FEATURE_CLASSIFIER_VERSION")
        rule_engine_ver  = os.getenv("RULE_ENGINE_VERSION")

        model_metadata = {
            "roi_detector":       roi_version,
            "feature_classifier": xception_version,
            "rule_engine":        rule_engine_ver,
        }

        predictions = supabase.table("predictions") \
            .select("tirads, confidence, inference_time_ms, model_version") \
            .execute()

        feedback = supabase.table("prediction_feedback") \
            .select("is_correct, prediction_id") \
            .execute()

        rows    = predictions.data or []
        fb_rows = feedback.data or []
        total   = len(rows)
        correct   = sum(1 for f in fb_rows if f["is_correct"])
        incorrect = sum(1 for f in fb_rows if not f["is_correct"])

        accuracy = round(
            (correct / len(fb_rows) * 100), 1
        ) if fb_rows else None

        avg_confidence = round(
            sum(r["confidence"] for r in rows) / total, 4
        ) if total else None

        avg_inference = round(
            sum(r["inference_time_ms"] for r in rows) / total, 0
        ) if total else None

        feedback_rate = round(
            len(fb_rows) / total * 100, 1
        ) if total else 0

        tirads_dist = {}
        for row in rows:
            key = f"TR{row['tirads']}"
            tirads_dist[key] = tirads_dist.get(key, 0) + 1

        supabase.table("model_performance").insert({
            "model_version":         pipeline_version,
            "pipeline_version":      pipeline_version,
            "model_metadata":        model_metadata,
            "total_predictions":     total,
            "correct_predictions":   correct,
            "incorrect_predictions": incorrect,
            "accuracy":              accuracy,
            "avg_confidence":        avg_confidence,
            "avg_inference_time_ms": avg_inference,
            "tirads_distribution":   tirads_dist,
            "feedback_rate":         feedback_rate,
            "recorded_by":           admin_id,
        }).execute()

        # 📝 System Log
        log_event(
            level="INFO",
            action="PERFORMANCE_SNAPSHOT_RECORDED",
            actor_id=str(admin_id),
            actor_role="admin",
            resource_type="model_performance",
            metadata={
                "pipeline_version": pipeline_version,
                "accuracy": accuracy,
                "total_predictions": total
            }
        )

        return {
            "status":            "snapshot recorded",
            "pipeline_version":  pipeline_version,
            "model_metadata":    model_metadata,
            "total_predictions": total,
            "accuracy":          accuracy,
        }

# Global singleton
performance_service = PerformanceService()
