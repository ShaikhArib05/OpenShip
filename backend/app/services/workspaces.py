from datetime import datetime, timezone

from supabase import Client

from app.core.auth import require_member, require_owner
from app.core.errors import AppError, NotFound


def list_for_user(db: Client, user_id: str) -> list[dict]:
    rows = (
        db.table("workspace_members")
        .select("role, workspaces(id, name, owner_id, created_at)")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    return [{**r["workspaces"], "role": r["role"]} for r in rows if r.get("workspaces")]


def create(db: Client, user_id: str, name: str) -> dict:
    # DB trigger adds the owner as a member.
    return db.table("workspaces").insert({"name": name, "owner_id": user_id}).execute().data[0]


def list_members(db: Client, workspace_id: str, user_id: str) -> list[dict]:
    require_member(db, workspace_id, user_id)
    rows = (
        db.table("workspace_members")
        .select("role, profiles(id, email, full_name, avatar_url)")
        .eq("workspace_id", workspace_id)
        .execute()
        .data
    )
    return [{**r["profiles"], "role": r["role"]} for r in rows if r.get("profiles")]


def create_invite(db: Client, workspace_id: str, user_id: str, email: str | None) -> dict:
    require_owner(db, workspace_id, user_id)
    return (
        db.table("workspace_invites")
        .insert({"workspace_id": workspace_id, "email": email, "created_by": user_id})
        .execute()
        .data[0]
    )


def accept_invite(db: Client, token: str, user_id: str) -> dict:
    rows = db.table("workspace_invites").select("*").eq("token", token).limit(1).execute().data
    if not rows:
        raise NotFound("Invite")
    inv = rows[0]
    if inv["accepted_at"] and inv["email"]:
        raise AppError(410, "Invite already used")
    if datetime.fromisoformat(inv["expires_at"]) < datetime.now(timezone.utc):
        raise AppError(410, "Invite expired")
    db.table("workspace_members").upsert(
        {"workspace_id": inv["workspace_id"], "user_id": user_id, "role": "member"},
        on_conflict="workspace_id,user_id",
        ignore_duplicates=True,
    ).execute()
    if inv["email"]:  # email invites are single-use; link invites (no email) stay reusable until expiry
        db.table("workspace_invites").update(
            {"accepted_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", inv["id"]).execute()
    return {"workspace_id": inv["workspace_id"]}


def remove_member(db: Client, workspace_id: str, actor_id: str, target_id: str) -> None:
    require_owner(db, workspace_id, actor_id)
    if target_id == actor_id:
        raise AppError(400, "Owners cannot remove themselves")
    db.table("workspace_members").delete().eq("workspace_id", workspace_id).eq(
        "user_id", target_id
    ).execute()
