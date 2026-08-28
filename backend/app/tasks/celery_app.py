# backend/app/tasks/celery_app.py
import os
from dotenv import load_dotenv
from celery import Celery

load_dotenv(override=True)
REDIS_BROKER_URL = os.getenv("REDIS_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0"))

celery = Celery(
    "thyrovision",
    broker=REDIS_BROKER_URL,
    backend=REDIS_BROKER_URL,
    include=["app.tasks.benchmark", "app.tasks.notifications"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,          # don't ack until task completes
    worker_prefetch_multiplier=1, # one task at a time per worker (ML models are heavy)
    broker_connection_retry_on_startup=True,
    
    # ── Multi-Queue Routing ──────────────────────────────────
    task_default_queue="default",
    task_queues={
        "default": {
            "exchange": "default",
            "routing_key": "default",
        },
        "ml_tasks": {
            "exchange": "ml_tasks",
            "routing_key": "ml_tasks",
        },
        "notifications": {
            "exchange": "notifications",
            "routing_key": "notifications",
        },
    },
    task_routes={
        "tasks.run_benchmark": {"queue": "ml_tasks"},
        "tasks.send_notification": {"queue": "notifications"},
        "tasks.check_followups": {"queue": "notifications"},
    },
)

# ── Celery Beat Schedule ──────────────────────────────────
from celery.schedules import crontab

celery.conf.beat_schedule = {
    "daily-followup-reminder": {
        "task": "tasks.check_followups",
        "schedule": crontab(hour=8, minute=0), # Daily at 8:00 AM
    },
}
