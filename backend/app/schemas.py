from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class InviteCreate(BaseModel):
    email: str | None = None


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    archived: bool | None = None


TaskStatus = Literal["todo", "in_progress", "in_review", "done"]
TaskPriority = Literal["low", "medium", "high", "urgent"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    assignee_id: str | None = None
    due_date: date | None = None
    labels: list[Annotated[str, Field(min_length=1, max_length=30)]] = Field(default_factory=list, max_length=10)
    estimate: int | None = Field(default=None, ge=0, le=1000)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: str | None = None
    due_date: date | None = None
    labels: list[Annotated[str, Field(min_length=1, max_length=30)]] | None = Field(default=None, max_length=10)
    estimate: int | None = Field(default=None, ge=0, le=1000)
    position: float | None = None


class CommentCreate(BaseModel):
    # Mentions are stored inline as @[Display Name](user-uuid).
    body: str = Field(min_length=1, max_length=5000)
