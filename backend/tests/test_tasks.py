PROJECT = {"id": "p1", "workspace_id": "ws-1", "name": "A", "description": None}
TASK = {"id": "t1", "project_id": "p1", "title": "T", "status": "todo", "assignee_id": None, "position": 1000}
MEMBER = {"workspace_members": [{"role": "member"}], "projects": [PROJECT]}


def test_non_member_cannot_list_tasks(make_client):
    c = make_client({"projects": [PROJECT], "workspace_members": []})
    assert c.get("/projects/p1/tasks").status_code == 403


def test_non_member_cannot_read_or_edit_task(make_client):
    c = make_client({"tasks": [TASK], "projects": [PROJECT], "workspace_members": []})
    assert c.get("/tasks/t1").status_code == 403
    assert c.patch("/tasks/t1", json={"title": "x"}).status_code == 403
    assert c.delete("/tasks/t1").status_code == 403


def test_member_can_create_task(make_client):
    c = make_client({**MEMBER, "tasks": [TASK]})
    r = c.post("/projects/p1/tasks", json={"title": "New"})
    assert r.status_code == 201


def test_invalid_input_rejected(make_client):
    c = make_client(MEMBER)
    assert c.post("/projects/p1/tasks", json={"title": ""}).status_code == 422
    assert c.post("/projects/p1/tasks", json={"title": "x", "status": "bogus"}).status_code == 422
    assert c.post("/projects/p1/tasks", json={"title": "x", "estimate": -1}).status_code == 422


def test_empty_update_rejected(make_client):
    c = make_client({**MEMBER, "tasks": [TASK]})
    assert c.patch("/tasks/t1", json={}).status_code == 400
    assert c.patch("/tasks/t1", json={"title": None}).status_code == 400  # title can't be nulled


def test_missing_task_is_404(make_client):
    c = make_client({**MEMBER, "tasks": []})
    assert c.get("/tasks/nope").status_code == 404
