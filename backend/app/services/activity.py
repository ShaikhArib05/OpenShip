from supabase import Client


def log(db: Client, project_id: str, actor_id: str, action: str, task_id: str | None = None, **details) -> None:
    """Best-effort activity record; never fails the main operation."""
    try:
        db.table("activity_logs").insert(
            {"project_id": project_id, "task_id": task_id, "actor_id": actor_id, "action": action, "details": details}
        ).execute()
    except Exception:
        pass
