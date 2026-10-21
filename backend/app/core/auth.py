from dataclasses import dataclass

import httpx
from fastapi import Header
from supabase import Client

from app.core.config import get_settings
from app.core.errors import AppError, Forbidden


@dataclass
class CurrentUser:
    id: str
    email: str


_auth_http = httpx.Client(timeout=10)  # httpx clients are thread-safe


def _fetch_user(token: str) -> httpx.Response:
    s = get_settings()
    return _auth_http.get(
        f"{s.supabase_url}/auth/v1/user",
        headers={"apikey": s.supabase_service_role_key, "Authorization": f"Bearer {token}"},
    )


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    """Verify the Supabase access token by asking Supabase Auth.

    Only a rejection from Supabase counts as 401; network trouble is a 503 so the client
    does not mistake a hiccup for a bad login.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    res = None
    for attempt in range(2):
        try:
            res = _fetch_user(token)
            break
        except httpx.HTTPError:
            if attempt == 1:
                raise AppError(503, "Authentication service unavailable. Please try again.")
    if res.status_code in (400, 401, 403):
        raise AppError(401, "Invalid or expired token")
    if res.status_code != 200:
        raise AppError(503, "Authentication service unavailable. Please try again.")
    user = res.json()
    return CurrentUser(id=user["id"], email=user.get("email") or "")


def get_member_role(db: Client, workspace_id: str, user_id: str) -> str | None:
    r = (
        db.table("workspace_members")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return r.data[0]["role"] if r.data else None


def require_member(db: Client, workspace_id: str, user_id: str) -> str:
    role = get_member_role(db, workspace_id, user_id)
    if role is None:
        raise Forbidden()
    return role


def require_owner(db: Client, workspace_id: str, user_id: str) -> None:
    if require_member(db, workspace_id, user_id) != "owner":
        raise Forbidden("Only workspace owners can do this")
