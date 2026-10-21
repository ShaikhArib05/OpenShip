from supabase import Client

from app.core.access import get_project_for_member
from app.core.auth import get_member_role
from app.core.errors import AppError, NotFound
from app.services import activity
from app.services.notifications import notify

POSITION_STEP = 1000.0
NON_NULLABLE = ("title", "status", "priority", "labels")


def _check_assignee(db: Client, workspace_id: str, assignee_id: str | None) -> None:
    if assignee_id and get_member_role(db, workspace_id, assignee_id) is None:
        raise AppError(400, "Assignee must be a member of this workspace")


def get_task_for_member(db: Client, task_id: str, user_id: str) -> tuple[dict, dict]:
    rows = db.table("tasks").select("*").eq("id", task_id).limit(1).execute().data
    if not rows:
        raise NotFound("Task")
    task = rows[0]
    project = get_project_for_member(db, task["project_id"], user_id)
    return task, project


def list_tasks(
    db: Client,
    project_id: str,
    user_id: str,
    *,
    status: str | None = None,
    assignee_id: str | None = None,
    priority: str | None = None,
    due_before: str | None = None,
    due_after: str | None = None,
    q: str | None = None,
) -> list[dict]:
    get_project_for_member(db, project_id, user_id)
    query = db.table("tasks").select("*").eq("project_id", project_id)
    if status:
        query = query.eq("status", status)
    if assignee_id:
        query = query.is_("assignee_id", "null") if assignee_id == "none" else query.eq("assignee_id", assignee_id)
    if priority:
        query = query.eq("priority", priority)
    if due_before:
        query = query.lte("due_date", due_before)
    if due_after:
        query = query.gte("due_date", due_after)
    if q:
        safe = q.replace("%", r"\%").replace("_", r"\_")
        query = query.ilike("title", f"%{safe}%")
    return query.order("position").order("created_at").execute().data


def create_task(db: Client, project_id: str, user_id: str, data: dict) -> dict:
    project = get_project_for_member(db, project_id, user_id)
    _check_assignee(db, project["workspace_id"], data.get("assignee_id"))
    last = (
        db.table("tasks")
        .select("position")
        .eq("project_id", project_id)
        .eq("status", data["status"])
        .order("position", desc=True)
        .limit(1)
        .execute()
        .data
    )
    row = {
        **data,
        "project_id": project_id,
        "creator_id": user_id,
        "position": (last[0]["position"] if last else 0) + POSITION_STEP,
        "due_date": data["due_date"].isoformat() if data.get("due_date") else None,
    }
    task = db.table("tasks").insert(row).execute().data[0]
    activity.log(db, project_id, user_id, "created task", task["id"], title=task["title"])
    notify(db, {task["assignee_id"]}, user_id, "assignment", "{actor} assigned you “{title}”", task)
    return task


def update_task(db: Client, task_id: str, user_id: str, changes: dict) -> dict:
    task, project = get_task_for_member(db, task_id, user_id)
    changes = {k: v for k, v in changes.items() if not (v is None and k in NON_NULLABLE)}
    if not changes:
        raise AppError(400, "Nothing to update")
    if "assignee_id" in changes:
        _check_assignee(db, project["workspace_id"], changes["assignee_id"])
    if changes.get("due_date"):
        changes["due_date"] = changes["due_date"].isoformat()

    updated = db.table("tasks").update(changes).eq("id", task_id).execute().data[0]

    if changes.get("status") and changes["status"] != task["status"]:
        activity.log(db, task["project_id"], user_id, "moved task", task_id,
                     title=task["title"], **{"from": task["status"], "to": changes["status"]})
    if "assignee_id" in changes and changes["assignee_id"] != task["assignee_id"]:
        activity.log(db, task["project_id"], user_id, "assigned task", task_id,
                     title=task["title"], assignee_id=changes["assignee_id"])
    if "assignee_id" in changes and changes["assignee_id"] != task["assignee_id"]:
        notify(db, {changes["assignee_id"]}, user_id, "assignment", "{actor} assigned you “{title}”", updated)
    if changes.get("status") and changes["status"] != task["status"]:
        label = changes["status"].replace("_", " ")
        notify(
            db,
            {updated["assignee_id"], task["creator_id"]},
            user_id,
            "status_change",
            "{actor} moved “{title}” to " + label,
            updated,
        )
    if set(changes) - {"status", "assignee_id", "position"}:
        activity.log(db, task["project_id"], user_id, "updated task", task_id, title=task["title"])
    return updated


def delete_task(db: Client, task_id: str, user_id: str) -> None:
    task, _ = get_task_for_member(db, task_id, user_id)
    db.table("tasks").delete().eq("id", task_id).execute()
    activity.log(db, task["project_id"], user_id, "deleted task", None, title=task["title"])
