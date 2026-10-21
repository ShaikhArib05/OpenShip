from app.services.comments import mentioned_ids

PROJECT = {"id": "p1", "workspace_id": "ws-1"}
TASK = {"id": "t1", "project_id": "p1", "title": "T"}
COMMENT = {"id": "c1", "task_id": "t1", "author_id": "someone-else"}


def test_non_member_cannot_comment_or_read(make_client):
    c = make_client({"tasks": [TASK], "projects": [PROJECT], "workspace_members": []})
    assert c.get("/tasks/t1/comments").status_code == 403
    assert c.post("/tasks/t1/comments", json={"body": "hi"}).status_code == 403
    assert c.get("/tasks/t1/activity").status_code == 403


def test_empty_comment_rejected(make_client):
    c = make_client({"tasks": [TASK], "projects": [PROJECT], "workspace_members": [{"role": "member"}]})
    assert c.post("/tasks/t1/comments", json={"body": ""}).status_code == 422


def test_member_cannot_delete_others_comment(make_client):
    c = make_client({"comments": [COMMENT], "tasks": [TASK], "projects": [PROJECT], "workspace_members": [{"role": "member"}]})
    assert c.delete("/comments/c1").status_code == 403


def test_owner_can_delete_any_comment(make_client):
    c = make_client({"comments": [COMMENT], "tasks": [TASK], "projects": [PROJECT], "workspace_members": [{"role": "owner"}]})
    assert c.delete("/comments/c1").status_code == 204


def test_mention_parsing():
    uid = "123e4567-e89b-12d3-a456-426614174000"
    assert mentioned_ids(f"hi @[Ann Lee]({uid}) and @[Ann Lee]({uid.upper()})") == {uid}
    assert mentioned_ids("plain @text") == set()
