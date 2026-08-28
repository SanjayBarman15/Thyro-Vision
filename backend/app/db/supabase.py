# app/db/supabase.py
from supabase import create_client, ClientOptions
import os
from dotenv import load_dotenv

# 🔑 Load env vars BEFORE reading them
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not ANON_KEY or not SERVICE_KEY:
    raise RuntimeError("Supabase env vars not set")

# 🔐 Used ONLY for auth verification
supabase_auth = create_client(
    SUPABASE_URL,
    ANON_KEY,
    options=ClientOptions(
        postgrest_client_timeout=60,
        storage_client_timeout=60
    )
)

# 🔑 Used for DB + storage + ML (bypasses RLS)
supabase_admin = create_client(
    SUPABASE_URL,
    SERVICE_KEY,
    options=ClientOptions(
        postgrest_client_timeout=60,
        storage_client_timeout=60
    )
)

# 📦 Storage Constants
STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "thyrovision-images")


def get_supabase():
    """
    Returns the admin Supabase client (service role key).
    Bypasses RLS — use only in trusted server-side contexts.
    Never expose this client to frontend or untrusted callers.
    """
    return supabase_admin