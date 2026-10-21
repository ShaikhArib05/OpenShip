from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.schemas import SprintCreate, SprintTasksChange, SprintUpdate
from app.services import sprints as svc

router = APIRouter(tags=["sprints"])


@router.get("/projects/{project_id}/sprints")
def list_sprints(project_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.list_for_project(db, project_id, user.id)


@router.post("/projects/{project_id}/sprints", status_code=201)
def create_sprint(
    project_id: str, body: SprintCreate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.create(db, project_id, user.id, body.model_dump())


@router.get("/workspaces/{workspace_id}/sprints")
def workspace_sprints(workspace_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.list_for_workspace(db, workspace_id, user.id)


@router.patch("/sprints/{sprint_id}")
def update_sprint(
    sprint_id: str, body: SprintUpdate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.update(db, sprint_id, user.id, body.model_dump(exclude_unset=True))


@router.delete("/sprints/{sprint_id}", status_code=204)
def delete_sprint(sprint_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    svc.delete(db, sprint_id, user.id)


@router.post("/sprints/{sprint_id}/tasks")
def change_sprint_tasks(
    sprint_id: str, body: SprintTasksChange, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.change_tasks(db, sprint_id, user.id, body.add, body.remove)
