from dataclasses import dataclass

from fastapi import Depends, Header
from supabase import Client

from app.core.db import get_db
from app.core.errors import AppError, Forbidden


@dataclass
class CurrentUser:
    id: str
    email: str


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Client = Depends(get_db),
) -> CurrentUser:
    """Verify the Supabase access token by asking Supabase Auth."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        res = db.auth.get_user(token)
    except Exception:
        raise AppError(401, "Invalid or expired token")
    if not res or not res.user:
        raise AppError(401, "Invalid or expired token")
    return CurrentUser(id=res.user.id, email=res.user.email or "")


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
