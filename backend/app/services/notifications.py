from supabase import Client

from app.core.errors import NotFound


def _actor_name(db: Client, actor_id: str) -> str:
    try:
        rows = db.table("profiles").select("full_name, email").eq("id", actor_id).limit(1).execute().data
        return (rows[0]["full_name"] or rows[0]["email"]) if rows else "Someone"
    except Exception:
        return "Someone"


def notify(
    db: Client,
    recipients: set[str | None],
    actor_id: str,
    type_: str,
    template: str,
    task: dict,
) -> None:
    """Create one notification per recipient (never the actor). Best-effort: never fails the caller.

    `template` may use {actor} and {title}.
    """
    targets = {r for r in recipients if r and r != actor_id}
    if not targets:
        return
    try:
        message = template.format(actor=_actor_name(db, actor_id), title=task["title"])
        db.table("notifications").insert(
            [{"user_id": r, "type": type_, "message": message, "task_id": task["id"]} for r in targets]
        ).execute()
    except Exception:
        pass


def list_for_user(db: Client, user_id: str, limit: int = 30) -> dict:
    items = (
        db.table("notifications")
        .select("id, type, message, task_id, read, created_at, tasks(project_id)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    unread = db.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("read", False).execute()
    return {"items": items, "unread": unread.count or 0}


def mark_read(db: Client, notification_id: str, user_id: str) -> None:
    rows = (
        db.table("notifications").update({"read": True}).eq("id", notification_id).eq("user_id", user_id).execute().data
    )
    if not rows:
        raise NotFound("Notification")


def mark_all_read(db: Client, user_id: str) -> None:
    db.table("notifications").update({"read": True}).eq("user_id", user_id).eq("read", False).execute()
