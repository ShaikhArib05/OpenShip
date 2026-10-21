"""AI features. Every function only *suggests*: nothing is written here.

The user reviews suggestions in the UI and saves them through the normal task and sprint endpoints.
"""
import json
from datetime import date

from supabase import Client

from app.ai_schemas import BreakdownOut, GenerateOut, PriorityOut, SprintPlanOut, SummaryOut
from app.core.access import get_project_for_member
from app.core.errors import AppError, NotFound
from app.services import gemini
from app.services.tasks import get_task_for_member

PRIORITIES = {"low", "medium", "high", "urgent"}


def _data(obj) -> str:
    """Wrap user content so the model treats it as data."""
    return f"<data>\n{json.dumps(obj, ensure_ascii=False, default=str)}\n</data>"


def _clip(text: str | None, n: int) -> str:
    return (text or "").strip()[:n]


def _points(value) -> int:
    try:
        return max(1, min(int(value), 100))
    except (TypeError, ValueError):
        return 1


def _task_brief(t: dict, desc_len: int = 300) -> dict:
    return {
        "id": t["id"],
        "title": _clip(t["title"], 200),
        "description": _clip(t.get("description"), desc_len),
        "status": t["status"],
        "priority": t["priority"],
        "due_date": t.get("due_date"),
        "estimate": t.get("estimate"),
    }


def _project_tasks(db: Client, project_id: str) -> list[dict]:
    return db.table("tasks").select("*").eq("project_id", project_id).order("created_at").execute().data


# 1. Task generator ---------------------------------------------------------
def generate_tasks(db: Client, project_id: str, user_id: str, description: str) -> dict:
    project = get_project_for_member(db, project_id, user_id)
    existing = [t["title"] for t in _project_tasks(db, project_id)][-50:]
    out = gemini.generate(
        user_id,
        "Turn the project description into a concrete, well-scoped list of 5 to 12 tasks. "
        "Each task needs a short imperative title, a one or two sentence description, a priority "
        "(low, medium, high, urgent), a story point estimate from 1 to 13, and 0 to 3 short lowercase labels. "
        "Do not repeat any existing task title.",
        _data({"project": project["name"], "description": description, "existing_task_titles": existing}),
        GenerateOut,
    )
    tasks = []
    for t in out.tasks[:15]:
        title = _clip(t.title, 200)
        if not title:
            continue
        tasks.append(
            {
                "title": title,
                "description": _clip(t.description, 2000) or None,
                "priority": t.priority if t.priority in PRIORITIES else "medium",
                "estimate": min(_points(t.estimate), 13),
                "labels": [_clip(l, 30) for l in t.labels if l.strip()][:5],
            }
        )
    if not tasks:
        raise AppError(502, "The AI did not produce any usable tasks. Try describing the project in more detail.")
    return {"tasks": tasks}


# 2. Task breakdown ---------------------------------------------------------
def breakdown_task(db: Client, task_id: str, user_id: str) -> dict:
    task, _ = get_task_for_member(db, task_id, user_id)
    out = gemini.generate(
        user_id,
        "Break the task into 3 to 8 smaller subtasks that together complete it. "
        "Each subtask has a short imperative title, a one sentence description, and a story point estimate "
        "from 1 to 5. Order them in the sequence they should be done.",
        _data(_task_brief(task, 2000)),
        BreakdownOut,
    )
    subtasks = [
        {"title": _clip(s.title, 200), "description": _clip(s.description, 1000) or None, "estimate": min(_points(s.estimate), 5)}
        for s in out.subtasks[:8]
        if _clip(s.title, 200)
    ]
    if not subtasks:
        raise AppError(502, "The AI did not produce any usable subtasks.")
    return {"subtasks": subtasks}


# 3. Priority suggestions ---------------------------------------------------
def suggest_priorities(db: Client, project_id: str, user_id: str) -> dict:
    get_project_for_member(db, project_id, user_id)
    open_tasks = [t for t in _project_tasks(db, project_id) if t["status"] != "done"][:40]
    if not open_tasks:
        return {"suggestions": []}
    by_id = {t["id"]: t for t in open_tasks}
    out = gemini.generate(
        user_id,
        "Review each open task and recommend a priority (low, medium, high, urgent) based on its description and due date. "
        "Overdue or imminent deadlines and blocking work raise priority. Only include tasks whose priority should change, "
        "each with a one sentence reason. Use the exact task ids provided.",
        _data({"today": date.today().isoformat(), "tasks": [_task_brief(t) for t in open_tasks]}),
        PriorityOut,
    )
    seen, suggestions = set(), []
    for s in out.suggestions:
        t = by_id.get(s.task_id)
        if not t or s.task_id in seen or s.priority not in PRIORITIES or s.priority == t["priority"]:
            continue  # unknown id, duplicate, or no actual change
        seen.add(s.task_id)
        suggestions.append(
            {
                "task_id": t["id"],
                "title": t["title"],
                "current": t["priority"],
                "priority": s.priority,
                "reason": _clip(s.reason, 250),
            }
        )
    return {"suggestions": suggestions}


# 4. Sprint planner ---------------------------------------------------------
def plan_sprint(db: Client, project_id: str, user_id: str, sprint_id: str, capacity: int) -> dict:
    get_project_for_member(db, project_id, user_id)
    sprints = db.table("sprints").select("*").eq("id", sprint_id).eq("project_id", project_id).limit(1).execute().data
    if not sprints:
        raise NotFound("Sprint")
    sprint = sprints[0]
    if sprint["status"] == "completed":
        raise AppError(409, "Completed sprints cannot be planned")

    sprint_ids = [s["id"] for s in db.table("sprints").select("id").eq("project_id", project_id).execute().data]
    links = db.table("sprint_tasks").select("task_id").in_("sprint_id", sprint_ids).execute().data if sprint_ids else []
    in_sprint = {row["task_id"] for row in links}
    backlog = [t for t in _project_tasks(db, project_id) if t["id"] not in in_sprint and t["status"] != "done"][:60]
    if not backlog:
        return {"tasks": [], "total_points": 0, "reasoning": "The backlog has no tasks to plan."}
    by_id = {t["id"]: t for t in backlog}

    out = gemini.generate(
        user_id,
        f"Choose which backlog tasks to pull into this sprint. The team capacity is {capacity} story points; "
        "stay at or under it. Tasks without an estimate count as 1 point. Prefer higher priority and earlier due dates, "
        "and favour a coherent set that serves the sprint goal. Return the chosen task ids and a short reasoning. "
        "Use the exact task ids provided.",
        _data(
            {
                "sprint": {"name": sprint["name"], "goal": sprint["goal"], "start": sprint["start_date"], "end": sprint["end_date"]},
                "capacity_points": capacity,
                "backlog": [_task_brief(t) for t in backlog],
            }
        ),
        SprintPlanOut,
    )
    chosen, used = [], 0
    for tid in out.task_ids:
        t = by_id.get(tid)
        if not t or any(c["id"] == tid for c in chosen):
            continue
        cost = t["estimate"] or 1
        if used + cost > capacity:  # never exceed capacity, whatever the model says
            continue
        used += cost
        chosen.append({"id": tid, "title": t["title"], "priority": t["priority"], "estimate": t["estimate"]})
    return {"tasks": chosen, "total_points": used, "reasoning": _clip(out.reasoning, 600)}


# 5. Project summary --------------------------------------------------------
def summarize_project(db: Client, project_id: str, user_id: str) -> dict:
    project = get_project_for_member(db, project_id, user_id)
    tasks = _project_tasks(db, project_id)
    if not tasks:
        return {"summary": "This project has no tasks yet, so there is nothing to summarise."}
    today = date.today().isoformat()
    done = [t for t in tasks if t["status"] == "done"]
    open_ = [t for t in tasks if t["status"] != "done"]
    overdue = [t for t in open_ if t["due_date"] and t["due_date"] < today]
    active = db.table("sprints").select("name, goal, start_date, end_date").eq("project_id", project_id).eq("status", "active").execute().data
    out = gemini.generate(
        user_id,
        "Write a concise project status summary for a team lead in under 170 words. Use short sections titled "
        "Progress, Completed, Outstanding, and Risks. Plain text with short bullet lines starting with '- '. "
        "Be specific, mention overdue work, and do not invent facts that are not in the data.",
        _data(
            {
                "project": project["name"],
                "today": today,
                "counts": {"total": len(tasks), "done": len(done), "open": len(open_), "overdue": len(overdue)},
                "active_sprint": active[0] if active else None,
                "recently_completed": [_clip(t["title"], 120) for t in sorted(done, key=lambda t: t["completed_at"] or "", reverse=True)[:10]],
                "open_tasks": [
                    {"title": _clip(t["title"], 120), "status": t["status"], "priority": t["priority"], "due": t["due_date"]}
                    for t in open_[:30]
                ],
            }
        ),
        SummaryOut,
    )
    return {"summary": _clip(out.summary, 2500)}
