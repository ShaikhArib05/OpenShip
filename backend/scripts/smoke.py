"""End-to-end smoke test against the real Supabase project. Creates and deletes a throwaway user.

Run from backend/:  .venv\\Scripts\\python -m scripts.smoke
"""
import uuid

from fastapi.testclient import TestClient
from supabase import create_client

from app.core.config import get_settings
from app.main import app

s = get_settings()
admin = create_client(s.supabase_url, s.supabase_service_role_key)
email, pw = f"smoke-{uuid.uuid4().hex[:8]}@example.com", "Sm0ke-test-pass!"
users = []
try:
    for e in (email, "b-" + email):
        users.append(admin.auth.admin.create_user({"email": e, "password": pw, "email_confirm": True}).user.id)
    tokens = []
    for e in (email, "b-" + email):
        c = create_client(s.supabase_url, s.supabase_service_role_key)
        tokens.append(c.auth.sign_in_with_password({"email": e, "password": pw}).session.access_token)
    A, B = ({"Authorization": f"Bearer {t}"} for t in tokens)

    api = TestClient(app)
    ws = api.post("/workspaces", json={"name": "Smoke WS"}, headers=A)
    assert ws.status_code == 201, ws.text
    ws_id = ws.json()["id"]
    assert api.get("/workspaces", headers=A).json()[0]["role"] == "owner"
    assert api.get(f"/workspaces/{ws_id}/members", headers=B).status_code == 403
    assert api.post(f"/workspaces/{ws_id}/projects", json={"name": "P"}, headers=B).status_code == 403

    p = api.post(f"/workspaces/{ws_id}/projects", json={"name": "Proj"}, headers=A)
    assert p.status_code == 201, p.text
    pid = p.json()["id"]
    assert api.get(f"/projects/{pid}", headers=B).status_code == 403

    inv = api.post(f"/workspaces/{ws_id}/invites", json={}, headers=A).json()
    assert api.post(f"/workspaces/{ws_id}/invites", json={}, headers=B).status_code == 403
    assert api.post(f"/workspaces/invites/{inv['token']}/accept", headers=B).status_code == 200
    assert api.get(f"/projects/{pid}", headers=B).status_code == 200
    assert api.delete(f"/projects/{pid}", headers=B).status_code == 403  # members can't delete
    t1 = api.post(f"/projects/{pid}/tasks", json={"title": "First", "priority": "high", "due_date": "2020-01-01", "labels": ["x"]}, headers=B)
    assert t1.status_code == 201, t1.text
    t2 = api.post(f"/projects/{pid}/tasks", json={"title": "Second thing", "assignee_id": users[0]}, headers=A).json()
    assert t2["position"] > t1.json()["position"]
    # assignee must be in the workspace
    outsider = admin.auth.admin.create_user({"email": "c-" + email, "password": pw, "email_confirm": True}).user.id
    users.append(outsider)
    assert api.post(f"/projects/{pid}/tasks", json={"title": "bad", "assignee_id": outsider}, headers=A).status_code == 400
    assert len(api.get(f"/projects/{pid}/tasks", headers=A).json()) == 2
    assert [t["title"] for t in api.get(f"/projects/{pid}/tasks?q=second", headers=A).json()] == ["Second thing"]
    assert len(api.get(f"/projects/{pid}/tasks?priority=high", headers=A).json()) == 1
    assert len(api.get(f"/projects/{pid}/tasks?assignee_id={users[0]}", headers=A).json()) == 1
    assert len(api.get(f"/projects/{pid}/tasks?assignee_id=none", headers=A).json()) == 1
    assert len(api.get(f"/projects/{pid}/tasks?due_before=2021-01-01", headers=A).json()) == 1
    moved = api.patch(f"/tasks/{t2['id']}", json={"status": "done", "position": 5}, headers=B).json()
    assert moved["status"] == "done" and moved["completed_at"]
    assert api.patch(f"/tasks/{t2['id']}", json={"assignee_id": None}, headers=A).json()["assignee_id"] is None
    d = api.get(f"/workspaces/{ws_id}/dashboard", headers=B).json()
    assert d["stats"]["total_tasks"] == 2 and d["stats"]["completed_tasks"] == 1 and d["stats"]["overdue_tasks"] == 1, d
    assert len(d["activity"]) >= 3, d["activity"]
    # outsider (not in workspace) is locked out
    tok = create_client(s.supabase_url, s.supabase_service_role_key).auth.sign_in_with_password(
        {"email": "c-" + email, "password": pw}).session.access_token
    C = {"Authorization": f"Bearer {tok}"}
    assert api.get(f"/projects/{pid}/tasks", headers=C).status_code == 403
    assert api.patch(f"/tasks/{t2['id']}", json={"title": "hax"}, headers=C).status_code == 403
    assert api.delete(f"/tasks/{t2['id']}", headers=B).status_code == 204
    d = api.get(f"/workspaces/{ws_id}/dashboard", headers=B).json()
    assert d["stats"]["projects"] == 1 and d["stats"]["total_tasks"] == 1, d
    assert api.delete(f"/projects/{pid}", headers=A).status_code == 204
    print("SMOKE OK")
finally:
    for uid in users:
        admin.table("workspaces").delete().eq("owner_id", uid).execute()
        admin.auth.admin.delete_user(uid)
