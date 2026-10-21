from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.schemas import ProjectCreate, ProjectUpdate
from app.services import dashboard as dash
from app.services import projects as svc

router = APIRouter(tags=["projects"])


@router.get("/workspaces/{workspace_id}/projects")
def list_projects(workspace_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.list_projects(db, workspace_id, user.id)


@router.post("/workspaces/{workspace_id}/projects", status_code=201)
def create_project(
    workspace_id: str, body: ProjectCreate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.create_project(db, workspace_id, user.id, body.name, body.description)


@router.get("/workspaces/{workspace_id}/dashboard")
def dashboard(workspace_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return dash.build_dashboard(db, workspace_id, user.id)


@router.get("/projects/{project_id}")
def get_project(project_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.get_project(db, project_id, user.id)


@router.patch("/projects/{project_id}")
def update_project(
    project_id: str, body: ProjectUpdate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.update_project(db, project_id, user.id, body.model_dump(exclude_unset=True))


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    svc.delete_project(db, project_id, user.id)
