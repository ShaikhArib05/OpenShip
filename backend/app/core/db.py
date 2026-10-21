from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_db() -> Client:
    """Service-role client. Server-side only: every route must authorize explicitly."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)
