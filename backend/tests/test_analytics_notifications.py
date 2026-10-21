from datetime import date

from app.services.analytics import burndown, project_analytics
from app.services.notifications import notify
from tests.conftest import FakeDB

SPRINT = {"start_date": "2026-03-01", "end_date": "2026-03-05"}  # 5 days


def test_burndown_by_task_count():
    tasks = [
        {"estimate": None, "completed_at": "2026-03-02T10:00:00+00:00"},
        {"estimate": None, "completed_at": None},
    ]
    b = burndown(SPRINT, tasks, today=date(2026, 3, 3))
    assert b["unit"] == "tasks" and b["total"] == 2
    rem = [p["remaining"] for p in b["points"]]
    assert rem == [2, 1, 1, None, None]  # future days have no actual value
    assert [p["ideal"] for p in b["points"]][0] == 2 and b["points"][-1]["ideal"] == 0


def test_burndown_uses_points_when_estimated():
    tasks = [
        {"estimate": 5, "completed_at": "2026-03-01T09:00:00+00:00"},
        {"estimate": 3, "completed_at": None},
    ]
    b = burndown(SPRINT, tasks, today=date(2026, 3, 5))
    assert b["unit"] == "points" and b["total"] == 8
    assert b["points"][0]["remaining"] == 3 and b["points"][-1]["remaining"] == 3


def test_burndown_single_day_sprint_does_not_divide_by_zero():
    sprint = {"start_date": "2026-03-01", "end_date": "2026-03-01"}
    b = burndown(sprint, [{"estimate": 2, "completed_at": None}], date(2026, 3, 1))
    assert len(b["points"]) == 1 and b["points"][0]["remaining"] == 2


def test_project_analytics_numbers():
    tasks = [
        {"id": "1", "status": "done", "due_date": "2026-01-01", "estimate": None, "completed_at": None},
        {"id": "2", "status": "todo", "due_date": "2026-01-02", "estimate": None, "completed_at": None},
        {"id": "3", "status": "in_progress", "due_date": None, "estimate": None, "completed_at": None},
        {"id": "4", "status": "todo", "due_date": "2026-12-31", "estimate": None, "completed_at": None},
    ]
    db = FakeDB({"workspace_members": [{"role": "member"}], "projects": [{"id": "p", "workspace_id": "w"}], "tasks": tasks})
    a = project_analytics(db, "p", "u", today=date(2026, 2, 1))
    assert a["total_tasks"] == 4 and a["completion_rate"] == 25 and a["overdue_tasks"] == 1
    assert a["by_status"]["todo"] == 2 and a["sprint"] is None


def test_analytics_requires_membership(make_client):
    c = make_client({"workspace_members": [], "projects": [{"id": "p", "workspace_id": "w"}]})
    assert c.get("/projects/p/analytics").status_code == 403


def test_notifications_endpoints(make_client):
    c = make_client({"notifications": [{"id": "n1"}]})
    assert c.get("/notifications").status_code == 200
    assert c.post("/notifications/n1/read").status_code == 204
    assert c.post("/notifications/read-all").status_code == 204
    empty = make_client({"notifications": []})
    assert empty.post("/notifications/missing/read").status_code == 404


class Recorder(FakeDB):
    def __init__(self):
        super().__init__({"profiles": [{"full_name": "Ann", "email": "a@x"}]})
        self.inserted = []

    def table(self, name):
        outer = self
        q = super().table(name)
        if name == "notifications":
            q.insert = lambda rows: (outer.inserted.extend(rows), q)[1]
        return q


def test_notify_skips_actor_and_none_and_dedupes():
    db = Recorder()
    notify(db, {"actor", None, "bob"}, "actor", "assignment", "{actor} assigned you {title}", {"id": "t", "title": "X"})
    assert db.inserted == [{"user_id": "bob", "type": "assignment", "message": "Ann assigned you X", "task_id": "t"}]


def test_notify_nothing_for_self_only():
    db = Recorder()
    notify(db, {"actor"}, "actor", "assignment", "{actor}", {"id": "t", "title": "X"})
    assert db.inserted == []
