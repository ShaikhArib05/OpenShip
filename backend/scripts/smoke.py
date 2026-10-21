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
    d = api.get(f"/workspaces/{ws_id}/dashboard", headers=B).json()
    assert d["stats"]["projects"] == 1, d
    assert api.delete(f"/projects/{pid}", headers=A).status_code == 204
    print("SMOKE OK")
finally:
    for uid in users:
        admin.table("workspaces").delete().eq("owner_id", uid).execute()
        admin.auth.admin.delete_user(uid)
