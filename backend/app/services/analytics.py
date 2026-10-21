from datetime import date, datetime, timedelta

from supabase import Client

from app.core.access import get_project_for_member

STATUSES = ("todo", "in_progress", "in_review", "done")


def burndown(sprint: dict, tasks: list[dict], today: date) -> dict:
    """Remaining work per day for a sprint, plus a straight ideal line.

    Work is measured in story points when any task has an estimate, otherwise in task count.
    """
    use_points = any(t.get("estimate") for t in tasks)
    weight = (lambda t: t.get("estimate") or 0) if use_points else (lambda t: 1)
    total = sum(weight(t) for t in tasks)

    start = date.fromisoformat(sprint["start_date"])
    end = date.fromisoformat(sprint["end_date"])
    days = (end - start).days
    last_actual = min(today, end)

    def done_by(day: date) -> int:
        # completed_at is stored in UTC; compare by UTC calendar date
        return sum(
            weight(t)
            for t in tasks
            if t.get("completed_at") and datetime.fromisoformat(t["completed_at"]).date() <= day
        )

    points = []
    for i in range(days + 1):
        day = start + timedelta(days=i)
        points.append(
            {
                "date": day.isoformat(),
                "ideal": round(total - total * i / days, 2) if days else 0,
                "remaining": total - done_by(day) if day <= last_actual else None,
            }
        )
    return {"unit": "points" if use_points else "tasks", "total": total, "points": points}


def project_analytics(db: Client, project_id: str, user_id: str, today: date | None = None) -> dict:
    get_project_for_member(db, project_id, user_id)
    today = today or date.today()
    tasks = (
        db.table("tasks").select("id, status, due_date, estimate, completed_at").eq("project_id", project_id).execute().data
    )
    by_status = {s: 0 for s in STATUSES}
    for t in tasks:
        by_status[t["status"]] += 1
    total = len(tasks)
    overdue = sum(1 for t in tasks if t["status"] != "done" and t["due_date"] and t["due_date"] < today.isoformat())

    sprints = (
        db.table("sprints")
        .select("*")
        .eq("project_id", project_id)
        .neq("status", "planned")
        .order("start_date", desc=True)
        .execute()
        .data
    )
    sprints.sort(key=lambda s: s["status"] != "active")  # active first, then most recent completed
    sprint_info = None
    if sprints:
        s = sprints[0]
        links = db.table("sprint_tasks").select("task_id").eq("sprint_id", s["id"]).execute().data
        ids = {link["task_id"] for link in links}
        sprint_tasks = [t for t in tasks if t["id"] in ids]
        done = sum(t["status"] == "done" for t in sprint_tasks)
        sprint_info = {
            "id": s["id"],
            "name": s["name"],
            "status": s["status"],
            "start_date": s["start_date"],
            "end_date": s["end_date"],
            "total": len(sprint_tasks),
            "done": done,
            "burndown": burndown(s, sprint_tasks, today),
        }

    return {
        "total_tasks": total,
        "completed_tasks": by_status["done"],
        "completion_rate": round(by_status["done"] / total * 100) if total else 0,
        "overdue_tasks": overdue,
        "by_status": by_status,
        "sprint": sprint_info,
    }
