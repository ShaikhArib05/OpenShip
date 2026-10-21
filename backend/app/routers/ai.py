from fastapi import APIRouter, Depends
from supabase import Client

from app.ai_schemas import GenerateTasksIn, SprintPlanIn
from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.services import ai as svc
from app.services import gemini

router = APIRouter(tags=["ai"])


@router.get("/ai/status")
def status(user: CurrentUser = Depends(get_current_user)):
    return {"enabled": gemini.is_enabled()}


@router.post("/projects/{project_id}/ai/generate-tasks")
def generate_tasks(
    project_id: str, body: GenerateTasksIn, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.generate_tasks(db, project_id, user.id, body.description.strip())


@router.post("/tasks/{task_id}/ai/breakdown")
def breakdown(task_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.breakdown_task(db, task_id, user.id)


@router.post("/projects/{project_id}/ai/prioritize")
def prioritize(project_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.suggest_priorities(db, project_id, user.id)


@router.post("/projects/{project_id}/ai/plan-sprint")
def plan_sprint(
    project_id: str, body: SprintPlanIn, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.plan_sprint(db, project_id, user.id, body.sprint_id, body.capacity)


@router.post("/projects/{project_id}/ai/summary")
def summary(project_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.summarize_project(db, project_id, user.id)
