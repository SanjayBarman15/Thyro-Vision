# app/services/admin/export_history_service.py
from app.db.supabase import get_supabase

class ExportHistoryService:
    def get_history(self):
        supabase = get_supabase()

        res = supabase.table("dataset_exports") \
            .select("*") \
            .order("exported_at", desc=True) \
            .execute()

        return {
            "exports": res.data or [],
            "total":   len(res.data or []),
        }

# Global singleton
export_history_service = ExportHistoryService()
