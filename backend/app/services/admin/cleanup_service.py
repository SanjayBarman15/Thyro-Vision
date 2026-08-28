# app/services/admin/cleanup_service.py
from app.db.supabase import get_supabase

class CleanupService:
    def release_expired_claims(self):
        """Releases claims older than 30 minutes via database RPC."""
        supabase = get_supabase()
        result   = supabase.rpc("release_expired_claims").execute()
        return result.data

# Global singleton
cleanup_service = CleanupService()
