SPRINT = {"id": "s1", "project_id": "p1", "name": "S", "status": "planned", "start_date": "2026-01-01", "end_date": "2026-01-14"}
PROJECT = {"id": "p1", "workspace_id": "ws-1"}
MEMBER = {"workspace_members": [{"role": "member"}], "projects": [PROJECT], "sprints": [SPRINT]}
BODY = {"name": "Sprint 1", "start_date": "2026-01-01", "end_date": "2026-01-14"}


def test_non_member_blocked_everywhere(make_client):
    c = make_client({"workspace_members": [], "projects": [PROJECT], "sprints": [SPRINT]})
    assert c.get("/projects/p1/sprints").status_code == 403
    assert c.post("/projects/p1/sprints", json=BODY).status_code == 403
    assert c.patch("/sprints/s1", json={"name": "x"}).status_code == 403
    assert c.delete("/sprints/s1").status_code == 403
    assert c.post("/sprints/s1/tasks", json={"add": ["t"]}).status_code == 403
    assert c.get("/workspaces/ws-1/sprints").status_code == 403


def test_end_before_start_rejected(make_client):
    c = make_client(MEMBER)
    assert c.post("/projects/p1/sprints", json={**BODY, "end_date": "2025-12-01"}).status_code == 422


def test_cannot_edit_completed_sprint(make_client):
    done = {**SPRINT, "status": "completed"}
    c = make_client({**MEMBER, "sprints": [done]})
    assert c.patch("/sprints/s1", json={"name": "x"}).status_code == 409
    assert c.post("/sprints/s1/tasks", json={"add": ["t"]}).status_code == 409


def test_invalid_transition_rejected(make_client):
    c = make_client(MEMBER)
    assert c.patch("/sprints/s1", json={"status": "completed"}).status_code == 409  # planned -> completed


def test_second_active_sprint_rejected(make_client):
    # the fake DB returns the same rows for any sprints query, so "another active sprint" exists
    c = make_client(MEMBER)
    assert c.patch("/sprints/s1", json={"status": "active"}).status_code == 409


def test_missing_sprint_404(make_client):
    c = make_client({**MEMBER, "sprints": []})
    assert c.delete("/sprints/nope").status_code == 404
