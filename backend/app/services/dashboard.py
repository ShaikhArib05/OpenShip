from datetime import date, timedelta

from supabase import Client

from app.core.auth import require_member

UPCOMING_DAYS = 14


def build_dashboard(db: Client, workspace_id: str, user_id: str, today: date | None = None) -> dict:
    require_member(db, workspace_id, user_id)
    today = today or date.today()

    projects = (
        db.table("projects")
        .select("id, name, description, created_at")
        .eq("workspace_id", workspace_id)
        .eq("archived", False)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    ids = [p["id"] for p in projects]
    tasks: list[dict] = []
    activity: list[dict] = []
    if ids:
        tasks = (
            db.table("tasks")
            .select("id, project_id, title, status, priority, due_date, assignee_id")
            .in_("project_id", ids)
            .execute()
            .data
        )
        activity = (
            db.table("activity_logs")
            .select("id, project_id, task_id, action, details, created_at, profiles(full_name, email)")
            .in_("project_id", ids)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
            .data
        )

    def overdue(t: dict) -> bool:
        return t["status"] != "done" and bool(t["due_date"]) and t["due_date"] < today.isoformat()

    per_project = {p["id"]: {"total": 0, "done": 0} for p in projects}
    for t in tasks:
        per_project[t["project_id"]]["total"] += 1
        per_project[t["project_id"]]["done"] += t["status"] == "done"

    horizon = (today + timedelta(days=UPCOMING_DAYS)).isoformat()
    names = {p["id"]: p["name"] for p in projects}
    upcoming = sorted(
        (
            {**t, "project_name": names[t["project_id"]]}
            for t in tasks
            if t["status"] != "done" and t["due_date"] and today.isoformat() <= t["due_date"] <= horizon
        ),
        key=lambda t: t["due_date"],
    )[:8]

    by_status = {s: 0 for s in ("todo", "in_progress", "in_review", "done")}
    for t in tasks:
        by_status[t["status"]] += 1

    return {
        "stats": {
            "projects": len(projects),
            "total_tasks": len(tasks),
            "completed_tasks": by_status["done"],
            "overdue_tasks": sum(overdue(t) for t in tasks),
        },
        "by_status": by_status,
        "projects": [
            {**p, "task_count": per_project[p["id"]]["total"], "done_count": per_project[p["id"]]["done"]}
            for p in projects
        ],
        "upcoming": upcoming,
        "activity": activity,
    }
