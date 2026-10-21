from supabase import Client

from app.core.access import get_project_for_member
from app.core.auth import require_member, require_owner
from app.core.errors import AppError


def _task_counts(db: Client, project_ids: list[str]) -> dict[str, dict[str, int]]:
    counts = {pid: {"total": 0, "done": 0} for pid in project_ids}
    if not project_ids:
        return counts
    rows = db.table("tasks").select("project_id, status").in_("project_id", project_ids).execute().data
    for r in rows:
        c = counts[r["project_id"]]
        c["total"] += 1
        c["done"] += r["status"] == "done"
    return counts


def list_projects(db: Client, workspace_id: str, user_id: str) -> list[dict]:
    require_member(db, workspace_id, user_id)
    projects = (
        db.table("projects")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    counts = _task_counts(db, [p["id"] for p in projects])
    return [{**p, "task_count": counts[p["id"]]["total"], "done_count": counts[p["id"]]["done"]} for p in projects]


def create_project(db: Client, workspace_id: str, user_id: str, name: str, description: str | None) -> dict:
    require_member(db, workspace_id, user_id)
    return (
        db.table("projects")
        .insert(
            {"workspace_id": workspace_id, "name": name, "description": description, "created_by": user_id}
        )
        .execute()
        .data[0]
    )


def get_project(db: Client, project_id: str, user_id: str) -> dict:
    return get_project_for_member(db, project_id, user_id)


def update_project(db: Client, project_id: str, user_id: str, changes: dict) -> dict:
    get_project_for_member(db, project_id, user_id)
    if not changes:
        raise AppError(400, "Nothing to update")
    return db.table("projects").update(changes).eq("id", project_id).execute().data[0]


def delete_project(db: Client, project_id: str, user_id: str) -> None:
    project = get_project_for_member(db, project_id, user_id)
    require_owner(db, project["workspace_id"], user_id)
    db.table("projects").delete().eq("id", project_id).execute()
