# backend/app/tasks/notifications.py
import os
from celery import shared_task
from app.tasks.celery_app import celery
from app.services.notification_service import notification_service
from app.db.supabase import get_supabase
from app.utils.logger import log_event

@celery.task(bind=True, name="tasks.send_notification", max_retries=3, default_retry_delay=60)
def send_notification_task(self, recipient_id: str, event_type: str, channels: list, payload: dict):
    """
    Generic Celery task to send notifications.
    channels: list of 'email' and/or 'push'
    """
    results = {}
    
    # 1. Fetch recipient data from Supabase 'profiles' table safely
    supabase = get_supabase()
    try:
        res = supabase.table("profiles").select("email, fcm_token").eq("id", recipient_id).execute()
        
        if not res.data:
            log_event(level="WARN", action="NOTIFICATION_PROFILE_MISSING", actor_id=recipient_id)
            return {"status": "skipped", "message": f"Profile for {recipient_id} not found. Sync FCM token first."}
        
        user_profile = res.data[0]
        target_email = user_profile.get("email")
        target_fcm = user_profile.get("fcm_token")
        
    except Exception as e:
        log_event(level="ERROR", action="NOTIFICATION_DB_ERROR", actor_id=recipient_id, metadata={"error": str(e)})
        return {"status": "error", "message": f"Database error: {str(e)}"}

    # 2. Loop through requested channels
    for channel in channels:
        try:
            if channel == "email" and target_email:
                res = notification_service.send_email(
                    to=target_email,
                    subject=payload.get("subject", "ThyroVision Notification"),
                    html_content=payload.get("html", "<p>Notification from ThyroVision</p>")
                )
                notification_service.log_notification(recipient_id, event_type, "email", "sent", payload.get("patient_id"))
                results["email"] = "success"

            elif channel == "push" and target_fcm:
                res = notification_service.send_push(
                    token=target_fcm,
                    title=payload.get("title", "ThyroVision Alert"),
                    body=payload.get("body", "You have a new alert in ThyroVision")
                )
                notification_service.log_notification(recipient_id, event_type, "push", "sent", payload.get("patient_id"))
                results["push"] = "success"
                
            else:
                results[channel] = "skipped_missing_info"

        except Exception as exc:
            # Retry mechanism for temporary API failures
            notification_service.log_notification(recipient_id, event_type, channel, "failed", payload.get("patient_id"), {"error": str(exc)})
            raise self.retry(exc=exc)

    return {"status": "completed", "results": results}

@celery.task(name="tasks.check_followups")
def check_followups_task():
    """
    Scheduled task (Cron) to check for follow-ups due in 7 days.
    """
    from datetime import datetime, timedelta
    supabase = get_supabase()
    
    # Logic: Find patients where followup_date == today + 7 days
    target_date = (datetime.now() + timedelta(days=7)).date().isoformat()
    
    # Query patients due for follow-up
    response = supabase.table("patients").select("id, name, doctor_id").eq("followup_date", target_date).execute()
    
    for patient in (response.data or []):
        patient_name = patient["name"]
        doctor_id = patient["doctor_id"]
        
        payload = {
            "title": "Upcoming Follow-up",
            "body": f"Patient {patient_name} is due for a follow-up scan in 7 days.",
            "subject": f"Follow-up Reminder: {patient_name}",
            "html": f"<h3>Follow-up Reminder</h3><p>Patient <b>{patient_name}</b> is scheduled for a scan on {target_date}.</p>",
            "patient_id": patient["id"]
        }
        
        # Dispatch to the worker
        send_notification_task.delay(doctor_id, "FOLLOWUP_REMINDER", ["email", "push"], payload)

    return {"status": "processed", "count": len(response.data or [])}
