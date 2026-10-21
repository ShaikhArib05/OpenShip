from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app


def test_health():
    assert TestClient(app).get("/health").json() == {"status": "ok"}


def test_requires_auth(make_client):
    # Fake DB only: the real auth dependency must reject a missing token.
    c = make_client()
    app.dependency_overrides.pop(get_current_user)
    r = c.get("/workspaces")
    assert r.status_code == 401
    assert "error" in r.json()


def test_non_member_cannot_list_members(make_client):
    c = make_client({"workspace_members": []})
    assert c.get("/workspaces/ws-1/members").status_code == 403


def test_member_cannot_invite(make_client):
    c = make_client({"workspace_members": [{"role": "member"}]})
    assert c.post("/workspaces/ws-1/invites", json={}).status_code == 403


def test_owner_can_invite(make_client):
    c = make_client({"workspace_members": [{"role": "owner"}], "workspace_invites": [{"token": "t"}]})
    r = c.post("/workspaces/ws-1/invites", json={})
    assert r.status_code == 201 and r.json()["token"] == "t"
