# backend/app/tasks/benchmark.py
"""
Celery task for running the benchmark.

Redis keys used:
  benchmark:lock              — prevents multiple simultaneous runs
  benchmark:progress:{job_id} — progress updates for frontend polling
  benchmark:last_run          — 6hr cooldown after each run
"""
import os
import json
import redis
from dotenv import load_dotenv
from datetime import datetime, timezone
from celery import Task

load_dotenv(override=True)

from app.tasks.celery_app import celery
from app.db.supabase import supabase_admin
from app.services.inference.roi_detector import FasterRCNNDetector
from app.services.inference.feature_classifier import FeatureClassifier
from app.services.benchmark_service import run_benchmark_images
from app.utils.logger import log_event
from app.tasks.notifications import send_notification_task

# ── Redis client (Role: Cache/App Logic) ──────────────────
r = redis.from_url(
    os.getenv("REDIS_CACHE_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0")),
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
)

LOCK_KEY          = "benchmark:lock"
LAST_RUN_KEY      = "benchmark:last_run"
LOCK_TTL          = 10 * 60      # 10 min — auto-release if worker crashes
COOLDOWN_TTL      = 5 * 60       # 5 minutes (reduced from 6h for easier testing)
PROGRESS_TTL      = 30 * 60      # 30 min after completion


# ── Helpers ───────────────────────────────────────────────
def set_progress(job_id: str, current: int, total: int, status: str = "running"):
    try:
        key = f"benchmark:progress:{job_id}"
        r.setex(key, PROGRESS_TTL, json.dumps({
            "current":  current,
            "total":    total,
            "percent":  round((current / total) * 100) if total > 0 else 0,
            "status":   status,
            "job_id":   job_id,
        }))
    except redis.exceptions.RedisError as e:
        print(f"⚠️ Failed to update Redis progress: {e}")


# ── Celery task ───────────────────────────────────────────
@celery.task(bind=True, name="tasks.run_benchmark", max_retries=0)
def run_benchmark(self, admin_id: str, admin_name: str):
    """
    Main benchmark Celery task.
    Loads models once, runs all benchmark images, updates Redis progress.
    Lock is always released in finally block even on crash.
    """
    job_id = self.request.id

    # ── Set lock ──────────────────────────────────────────
    lock_data = json.dumps({
        "admin_id":   admin_id,
        "admin_name": admin_name,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "job_id":     job_id,
    })
    try:
        r.setex(LOCK_KEY, LOCK_TTL, lock_data)
    except redis.exceptions.RedisError as e:
        print(f"⚠️ Failed to set Redis benchmark lock: {e}")

    set_progress(job_id, 0, 20, "starting")

    try:
        # ── Load models once for entire benchmark run ─────
        # Models are already in memory if the worker shares
        # the same process as FastAPI — otherwise loaded fresh here
        

        roi_detector       = FasterRCNNDetector()
        feature_classifier = FeatureClassifier()

        print(f"🚀 Benchmark started — job_id={job_id}, admin={admin_name}")

        # ── Run all images ────────────────────────────────
        run_id = None
        for current, total, result in run_benchmark_images(
            admin_id=admin_id,
            roi_detector=roi_detector,
            feature_classifier=feature_classifier,
        ):
            if not run_id and "benchmark_run_id" in result:
                run_id = result["benchmark_run_id"]
            set_progress(job_id, current, total, "running")
            print(f"   Image {current}/{total} done")

        # ── Mark complete ─────────────────────────────────
        set_progress(job_id, 20, 20, "complete")
        print(f"✅ Benchmark complete — job_id={job_id}")

        # 📝 System Log
        log_event(
            level="INFO",
            action="BENCHMARK_COMPLETED",
            actor_id=admin_id,
            actor_role="admin",
            resource_type="benchmark_run",
            resource_id=str(run_id) if run_id else None,
            metadata={
                "admin_name": admin_name,
                "job_id": job_id,
                "dataset_size": 20
            }
        )

        # 🔔 Notify Admin (Success)
        send_notification_task.delay(
            recipient_id=admin_id,
            event_type="BENCHMARK_COMPLETED",
            channels=["email", "push"],
            payload={
                "title": "Benchmark Success ✅",
                "body": f"Benchmark run completed for your request (Job: {job_id[:8]}).",
                "subject": "ThyroVision: Benchmark Complete",
                "html": f"<h2>Benchmark Success</h2><p>The benchmark run triggered by <b>{admin_name}</b> has finished successfully.</p>"
            }
        )

    except Exception as e:
        print(f"❌ Benchmark task failed: {e}")
        set_progress(job_id, 0, 20, "error")

        # 📝 System Log
        log_event(
            level="ERROR",
            action="BENCHMARK_FAILED",
            actor_id=admin_id,
            actor_role="admin",
            error_message=str(e),
            metadata={
                "admin_name": admin_name,
                "job_id": job_id
            }
        )

        # 🔔 Notify Admin (Failure)
        send_notification_task.delay(
            recipient_id=admin_id,
            event_type="BENCHMARK_FAILED",
            channels=["email", "push"],
            payload={
                "title": "Benchmark Failed ❌",
                "body": f"The benchmark run failed (Job: {job_id[:8]}). Check logs for details.",
                "subject": "ThyroVision Alert: Benchmark Failed",
                "html": f"<h2>Benchmark Failure</h2><p>A benchmark attempt by <b>{admin_name}</b> failed with the following error: <pre>{str(e)}</pre></p>"
            }
        )
        raise

    finally:
        # ── Always release lock ───────────────────────────
        try:
            r.delete(LOCK_KEY)
        except redis.exceptions.RedisError as e:
            print(f"⚠️ Failed to delete Redis lock: {e}")

        # ── Set cooldown ──────────────────────────────────
        try:
            r.setex(LAST_RUN_KEY, COOLDOWN_TTL, json.dumps({
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "triggered_by": admin_id,
                "admin_name":   admin_name,
                "job_id":       job_id,
            }))
        except redis.exceptions.RedisError as e:
            print(f"⚠️ Failed to set Redis cooldown: {e}")
