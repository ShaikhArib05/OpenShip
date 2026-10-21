import threading

from supabase import Client, create_client

from app.core.config import get_settings

# The supabase-py client is not safe to share between threads (FastAPI runs sync routes in a
# thread pool), so every worker thread gets its own service-role client.
_local = threading.local()


def get_db() -> Client:
    """Service-role client. Server-side only: every route must authorize explicitly."""
    client = getattr(_local, "client", None)
    if client is None:
        s = get_settings()
        client = _local.client = create_client(s.supabase_url, s.supabase_service_role_key)
    return client
