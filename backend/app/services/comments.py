import re

from supabase import Client

from app.core.auth import require_owner
from app.core.errors import Forbidden, NotFound
from app.services import activity
from app.services.tasks import get_task_for_member

MENTION_RE = re.compile(r"@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)")


def mentioned_ids(body: str) -> set[str]:
    return {m.lower() for m in MENTION_RE.findall(body)}


def list_comments(db: Client, task_id: str, user_id: str) -> list[dict]:
    get_task_for_member(db, task_id, user_id)
    return (
        db.table("comments")
        .select("id, task_id, author_id, body, created_at, profiles(id, full_name, email)")
        .eq("task_id", task_id)
        .order("created_at")
        .execute()
        .data
    )


def add_comment(db: Client, task_id: str, user_id: str, body: str) -> dict:
    task, _ = get_task_for_member(db, task_id, user_id)
    row = db.table("comments").insert({"task_id": task_id, "author_id": user_id, "body": body}).execute().data[0]
    activity.log(db, task["project_id"], user_id, "commented on task", task_id, title=task["title"])
    return row


def delete_comment(db: Client, comment_id: str, user_id: str) -> None:
    rows = db.table("comments").select("id, task_id, author_id").eq("id", comment_id).limit(1).execute().data
    if not rows:
        raise NotFound("Comment")
    comment = rows[0]
    _, project = get_task_for_member(db, comment["task_id"], user_id)
    if comment["author_id"] != user_id:
        try:
            require_owner(db, project["workspace_id"], user_id)
        except Exception:
            raise Forbidden("You can only delete your own comments")
    db.table("comments").delete().eq("id", comment_id).execute()


def task_activity(db: Client, task_id: str, user_id: str) -> list[dict]:
    get_task_for_member(db, task_id, user_id)
    return (
        db.table("activity_logs")
        .select("id, action, details, created_at, profiles(id, full_name, email)")
        .eq("task_id", task_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
        .data
    )
