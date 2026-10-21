from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.schemas import InviteCreate, WorkspaceCreate
from app.services import workspaces as svc

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("")
def list_workspaces(user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.list_for_user(db, user.id)


@router.post("", status_code=201)
def create_workspace(
    body: WorkspaceCreate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.create(db, user.id, body.name)


@router.get("/{workspace_id}/members")
def members(workspace_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.list_members(db, workspace_id, user.id)


@router.delete("/{workspace_id}/members/{target_id}", status_code=204)
def remove_member(
    workspace_id: str, target_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    svc.remove_member(db, workspace_id, user.id, target_id)


@router.post("/{workspace_id}/invites", status_code=201)
def create_invite(
    workspace_id: str, body: InviteCreate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.create_invite(db, workspace_id, user.id, body.email)


@router.post("/invites/{token}/accept")
def accept_invite(token: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.accept_invite(db, token, user.id)
