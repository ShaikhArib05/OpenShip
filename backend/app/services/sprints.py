from supabase import Client

from app.core.access import get_project_for_member
from app.core.auth import require_member
from app.core.errors import AppError, NotFound

# Allowed status moves: a sprint is planned, then started, then completed.
TRANSITIONS = {"planned": {"active"}, "active": {"completed"}, "completed": set()}


def _get_sprint(db: Client, sprint_id: str, user_id: str) -> tuple[dict, dict]:
    rows = db.table("sprints").select("*").eq("id", sprint_id).limit(1).execute().data
    if not rows:
        raise NotFound("Sprint")
    sprint = rows[0]
    return sprint, get_project_for_member(db, sprint["project_id"], user_id)


def _decorate(db: Client, sprints: list[dict]) -> list[dict]:
    """Attach task_ids and progress numbers (task count and story points) to each sprint."""
    ids = [s["id"] for s in sprints]
    links = db.table("sprint_tasks").select("sprint_id, task_id").in_("sprint_id", ids).execute().data if ids else []
    task_ids = list({link["task_id"] for link in links})
    tasks = (
        {t["id"]: t for t in db.table("tasks").select("id, status, estimate").in_("id", task_ids).execute().data}
        if task_ids
        else {}
    )
    out = []
    for s in sprints:
        ts = [tasks[link["task_id"]] for link in links if link["sprint_id"] == s["id"] and link["task_id"] in tasks]
        out.append(
            {
                **s,
                "task_ids": [t["id"] for t in ts],
                "total": len(ts),
                "done": sum(t["status"] == "done" for t in ts),
                "points_total": sum(t["estimate"] or 0 for t in ts),
                "points_done": sum(t["estimate"] or 0 for t in ts if t["status"] == "done"),
            }
        )
    return out


def list_for_project(db: Client, project_id: str, user_id: str) -> list[dict]:
    get_project_for_member(db, project_id, user_id)
    sprints = db.table("sprints").select("*").eq("project_id", project_id).order("start_date", desc=True).execute().data
    return _decorate(db, sprints)


def list_for_workspace(db: Client, workspace_id: str, user_id: str) -> list[dict]:
    require_member(db, workspace_id, user_id)
    projects = db.table("projects").select("id, name").eq("workspace_id", workspace_id).eq("archived", False).execute().data
    names = {p["id"]: p["name"] for p in projects}
    if not names:
        return []
    sprints = (
        db.table("sprints")
        .select("*")
        .in_("project_id", list(names))
        .neq("status", "completed")
        .order("start_date")
        .execute()
        .data
    )
    return [{**s, "project_name": names[s["project_id"]]} for s in _decorate(db, sprints)]


def create(db: Client, project_id: str, user_id: str, data: dict) -> dict:
    get_project_for_member(db, project_id, user_id)
    row = {
        **data,
        "project_id": project_id,
        "start_date": data["start_date"].isoformat(),
        "end_date": data["end_date"].isoformat(),
    }
    return _decorate(db, db.table("sprints").insert(row).execute().data)[0]


def update(db: Client, sprint_id: str, user_id: str, changes: dict) -> dict:
    sprint, _ = _get_sprint(db, sprint_id, user_id)
    changes = {k: v for k, v in changes.items() if v is not None or k == "goal"}
    if not changes:
        raise AppError(400, "Nothing to update")
    if sprint["status"] == "completed":
        raise AppError(409, "Completed sprints cannot be edited")

    for k in ("start_date", "end_date"):
        if k in changes:
            changes[k] = changes[k].isoformat()
    start = changes.get("start_date", sprint["start_date"])
    end = changes.get("end_date", sprint["end_date"])
    if end < start:
        raise AppError(422, "end_date must be on or after start_date")

    new_status = changes.get("status")
    if new_status and new_status != sprint["status"]:
        if new_status not in TRANSITIONS[sprint["status"]]:
            raise AppError(409, f"Cannot move a {sprint['status']} sprint to {new_status}")
        if new_status == "active":
            other = (
                db.table("sprints").select("id").eq("project_id", sprint["project_id"]).eq("status", "active").execute().data
            )
            if other:
                raise AppError(409, "This project already has an active sprint. Complete it first.")
        if new_status == "completed":
            # unfinished work goes back to the backlog; finished work stays for history and burndown
            links = db.table("sprint_tasks").select("task_id").eq("sprint_id", sprint_id).execute().data
            ids = [link["task_id"] for link in links]
            if ids:
                open_ids = [
                    t["id"] for t in db.table("tasks").select("id").in_("id", ids).neq("status", "done").execute().data
                ]
                if open_ids:
                    db.table("sprint_tasks").delete().eq("sprint_id", sprint_id).in_("task_id", open_ids).execute()

    updated = db.table("sprints").update(changes).eq("id", sprint_id).execute().data
    return _decorate(db, updated)[0]


def delete(db: Client, sprint_id: str, user_id: str) -> None:
    _get_sprint(db, sprint_id, user_id)
    db.table("sprints").delete().eq("id", sprint_id).execute()  # sprint_tasks cascade, tasks return to backlog


def change_tasks(db: Client, sprint_id: str, user_id: str, add: list[str], remove: list[str]) -> dict:
    sprint, _ = _get_sprint(db, sprint_id, user_id)
    if sprint["status"] == "completed":
        raise AppError(409, "Completed sprints cannot be changed")
    if add:
        valid = {
            t["id"]
            for t in db.table("tasks").select("id").eq("project_id", sprint["project_id"]).in_("id", add).execute().data
        }
        if set(add) - valid:
            raise AppError(400, "Some tasks do not belong to this project")
        # a task lives in at most one open sprint
        open_sprints = (
            db.table("sprints").select("id").eq("project_id", sprint["project_id"]).neq("status", "completed").execute().data
        )
        db.table("sprint_tasks").delete().in_("sprint_id", [s["id"] for s in open_sprints]).in_("task_id", add).execute()
        db.table("sprint_tasks").insert([{"sprint_id": sprint_id, "task_id": t} for t in add]).execute()
    if remove:
        db.table("sprint_tasks").delete().eq("sprint_id", sprint_id).in_("task_id", remove).execute()
    return _decorate(db, [sprint])[0]
