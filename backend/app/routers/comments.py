from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.schemas import CommentCreate
from app.services import comments as svc

router = APIRouter(tags=["comments"])


@router.get("/tasks/{task_id}/comments")
def list_comments(task_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.list_comments(db, task_id, user.id)


@router.post("/tasks/{task_id}/comments", status_code=201)
def add_comment(
    task_id: str, body: CommentCreate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.add_comment(db, task_id, user.id, body.body)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    svc.delete_comment(db, comment_id, user.id)


@router.get("/tasks/{task_id}/activity")
def task_activity(task_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.task_activity(db, task_id, user.id)
