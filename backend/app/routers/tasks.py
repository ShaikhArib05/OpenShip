from datetime import date

from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.schemas import TaskCreate, TaskPriority, TaskStatus, TaskUpdate
from app.services import tasks as svc

router = APIRouter(tags=["tasks"])


@router.get("/projects/{project_id}/tasks")
def list_tasks(
    project_id: str,
    status: TaskStatus | None = None,
    assignee_id: str | None = None,
    priority: TaskPriority | None = None,
    due_before: date | None = None,
    due_after: date | None = None,
    q: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    return svc.list_tasks(
        db, project_id, user.id,
        status=status, assignee_id=assignee_id, priority=priority,
        due_before=due_before.isoformat() if due_before else None,
        due_after=due_after.isoformat() if due_after else None,
        q=q.strip() if q else None,
    )


@router.post("/projects/{project_id}/tasks", status_code=201)
def create_task(
    project_id: str, body: TaskCreate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.create_task(db, project_id, user.id, body.model_dump())


@router.get("/tasks/{task_id}")
def get_task(task_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.get_task_for_member(db, task_id, user.id)[0]


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: str, body: TaskUpdate, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)
):
    return svc.update_task(db, task_id, user.id, body.model_dump(exclude_unset=True))


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    svc.delete_task(db, task_id, user.id)
