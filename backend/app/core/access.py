from supabase import Client

from app.core.auth import require_member
from app.core.errors import NotFound


def get_project_for_member(db: Client, project_id: str, user_id: str) -> dict:
    """Load a project and ensure the user belongs to its workspace. Returns the project row + role."""
    rows = db.table("projects").select("*").eq("id", project_id).limit(1).execute().data
    if not rows:
        raise NotFound("Project")
    project = rows[0]
    role = require_member(db, project["workspace_id"], user_id)
    return {**project, "role": role}
