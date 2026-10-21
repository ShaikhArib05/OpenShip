from datetime import date

from app.services.dashboard import build_dashboard
from tests.conftest import FakeDB

PROJECT = {"id": "p1", "workspace_id": "ws-1", "name": "Alpha", "description": None, "created_at": "2026-01-01"}


def test_non_member_cannot_create_project(make_client):
    c = make_client({"workspace_members": []})
    assert c.post("/workspaces/ws-1/projects", json={"name": "X"}).status_code == 403


def test_empty_project_name_rejected(make_client):
    c = make_client({"workspace_members": [{"role": "member"}]})
    assert c.post("/workspaces/ws-1/projects", json={"name": ""}).status_code == 422


def test_member_can_create_project(make_client):
    c = make_client({"workspace_members": [{"role": "member"}], "projects": [PROJECT]})
    r = c.post("/workspaces/ws-1/projects", json={"name": "Alpha"})
    assert r.status_code == 201 and r.json()["id"] == "p1"


def test_non_member_cannot_read_project(make_client):
    c = make_client({"projects": [PROJECT], "workspace_members": []})
    assert c.get("/projects/p1").status_code == 403


def test_missing_project_is_404(make_client):
    c = make_client({"projects": []})
    assert c.get("/projects/nope").status_code == 404


def test_member_cannot_delete_project(make_client):
    c = make_client({"projects": [PROJECT], "workspace_members": [{"role": "member"}]})
    assert c.delete("/projects/p1").status_code == 403


def test_owner_can_delete_project(make_client):
    c = make_client({"projects": [PROJECT], "workspace_members": [{"role": "owner"}]})
    assert c.delete("/projects/p1").status_code == 204


def test_dashboard_stats():
    tasks = [
        {"id": "1", "project_id": "p1", "title": "a", "status": "done", "priority": "low", "due_date": "2026-01-01", "assignee_id": None},
        {"id": "2", "project_id": "p1", "title": "b", "status": "todo", "priority": "low", "due_date": "2026-01-05", "assignee_id": None},
        {"id": "3", "project_id": "p1", "title": "c", "status": "in_progress", "priority": "low", "due_date": "2026-02-20", "assignee_id": None},
        {"id": "4", "project_id": "p1", "title": "d", "status": "todo", "priority": "low", "due_date": None, "assignee_id": None},
    ]
    db = FakeDB({"workspace_members": [{"role": "member"}], "projects": [PROJECT], "tasks": tasks})
    d = build_dashboard(db, "ws-1", "u1", today=date(2026, 2, 15))
    assert d["stats"] == {"projects": 1, "total_tasks": 4, "completed_tasks": 1, "overdue_tasks": 1}
    assert d["by_status"]["todo"] == 2
    assert [t["id"] for t in d["upcoming"]] == ["3"]  # only not-done tasks due within 14 days
    assert d["projects"][0]["done_count"] == 1
