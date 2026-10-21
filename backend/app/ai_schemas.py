"""Shapes Gemini must return (used as its response schema) and request bodies for the AI endpoints."""
from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["low", "medium", "high", "urgent"]


# ---- model output ----
class GeneratedTask(BaseModel):
    title: str
    description: str
    priority: Priority
    estimate: int  # story points, 1-13
    labels: list[str]


class GenerateOut(BaseModel):
    tasks: list[GeneratedTask]


class Subtask(BaseModel):
    title: str
    description: str
    estimate: int


class BreakdownOut(BaseModel):
    subtasks: list[Subtask]


class PrioritySuggestion(BaseModel):
    task_id: str
    priority: Priority
    reason: str


class PriorityOut(BaseModel):
    suggestions: list[PrioritySuggestion]


class SprintPlanOut(BaseModel):
    task_ids: list[str]
    reasoning: str


class SummaryOut(BaseModel):
    summary: str


# ---- request bodies ----
class GenerateTasksIn(BaseModel):
    description: str = Field(min_length=10, max_length=4000)


class SprintPlanIn(BaseModel):
    sprint_id: str
    capacity: int = Field(ge=1, le=500, description="Team capacity in story points")
