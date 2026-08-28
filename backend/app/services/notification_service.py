# backend/app/services/notification_service.py
import os
import json
import resend
import firebase_admin
from firebase_admin import credentials, messaging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.db.supabase import get_supabase
from app.utils.logger import log_event

class NotificationService:
    def __init__(self):
        # ── Initialize Resend ──────────────────────────────────
        self.resend_api_key = os.getenv("RESEND_API_KEY")
        if self.resend_api_key:
            resend.api_key = self.resend_api_key
        else:
            print("⚠️ RESEND_API_KEY not found in environment")
        self.email_address = os.getenv("EMAIL_ADDRESS")

        # ── Initialize Firebase ────────────────────────────────
        self.fcm_initialized = False
        service_account_path = os.getenv("GOOGLE_FIREBASE_FCM")
        
        if service_account_path and os.path.exists(service_account_path):
            try:
                # Check if app is already initialized to avoid DuplicateAppError
                if not firebase_admin._apps:
                    cred = credentials.Certificate(service_account_path)
                    firebase_admin.initialize_app(cred)
                self.fcm_initialized = True
            except Exception as e:
                print(f"❌ Failed to initialize Firebase: {e}")
        else:
            print(f"⚠️ FCM Service Account not found at: {service_account_path}")

    def send_email(self, to: str, subject: str, html_content: str, from_email: Optional[str] = None) -> Dict[Any, Any]:
        """Sends a transactional email via Resend."""
        if not from_email:
            # Use the environment variable if available, otherwise default to a placeholder
            from_name = "ThyroVision"
            from_email = f"{from_name} <{self.email_address}>" if self.email_address else f"{from_name} <notifications@thyrovision.ai>"
        if not self.resend_api_key:
            return {"error": "Resend API key missing"}
        
        try:
            params = {
                "from": from_email,
                "to": [to],
                "subject": subject,
                "html": html_content,
            }
            email = resend.Emails.send(params)
            return email
        except Exception as e:
            log_event(level="ERROR", action="EMAIL_SEND_FAILED", metadata={"error": str(e), "to": to})
            raise

    def send_push(self, token: str, title: str, body: str, data: Optional[Dict[str, str]] = None) -> str:
        """Sends a high-priority push notification via FCM."""
        if not self.fcm_initialized:
            return "FCM not initialized"

        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data,
                token=token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound='default')
                    )
                )
            )
            response = messaging.send(message)
            return response
        except Exception as e:
            log_event(level="ERROR", action="PUSH_SEND_FAILED", metadata={"error": str(e), "token": token})
            raise

    def log_notification(self, 
                       recipient_id: str, 
                       event_type: str, 
                       channel: str, 
                       status: str, 
                       patient_id: Optional[str] = None,
                       metadata: Optional[Dict] = None):
        """Logs the notification attempt in Supabase reminder_logs."""
        supabase = get_supabase()
        try:
            log_data = {
                "recipient_id": recipient_id,
                "patient_id": patient_id,
                "event_type": event_type,
                "channel": channel,
                "status": status,
                "metadata": metadata,
                "sent_at": datetime.now(timezone.utc).isoformat()
            }
            supabase.table("reminder_logs").insert(log_data).execute()
        except Exception as e:
            print(f"⚠️ Failed to log notification to Supabase: {e}")

# Global singleton
notification_service = NotificationService()
