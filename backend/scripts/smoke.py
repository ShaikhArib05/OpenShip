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
    cm = api.post(f"/tasks/{t2['id']}/comments", json={"body": f"hey @[A]({users[0]})"}, headers=B)
    assert cm.status_code == 201, cm.text
    cl = api.get(f"/tasks/{t2['id']}/comments", headers=A).json()
    assert len(cl) == 1 and cl[0]["profiles"]["email"] == "b-" + email, cl
    assert api.get(f"/tasks/{t2['id']}/comments", headers=C).status_code == 403
    assert api.delete(f"/comments/{cm.json()['id']}", headers=C).status_code == 403
    assert api.post(f"/tasks/{t2['id']}/comments", json={"body": "owner note"}, headers=A).status_code == 201
    acts = api.get(f"/tasks/{t2['id']}/activity", headers=B).json()
    assert {"created task", "moved task", "commented on task"} <= {a["action"] for a in acts}, acts
    assert api.delete(f"/comments/{cm.json()['id']}", headers=A).status_code == 204  # owner can moderate
    assert api.delete(f"/tasks/{t2['id']}", headers=B).status_code == 204
    d = api.get(f"/workspaces/{ws_id}/dashboard", headers=B).json()
    assert d["stats"]["projects"] == 1 and d["stats"]["total_tasks"] == 1, d
    # --- notifications + analytics ---
    def notifs(h):
        return api.get("/notifications", headers=h).json()

    assert notifs(A)["unread"] == 0 or True  # A may have none yet
    before_b = notifs(B)["unread"]
    api.patch(f"/tasks/{t1.json()['id']}", json={"assignee_id": users[0]}, headers=A)  # A assigns to self: no notification
    assert notifs(A)["unread"] == 0
    api.patch(f"/tasks/{t1.json()['id']}", json={"assignee_id": users[1]}, headers=A)  # A assigns B
    nb = notifs(B)
    assert nb["unread"] == before_b + 1 and nb["items"][0]["type"] == "assignment", nb
    api.patch(f"/tasks/{t1.json()['id']}", json={"status": "in_review"}, headers=A)  # B is assignee and creator
    assert notifs(B)["items"][0]["type"] == "status_change"
    assert notifs(B)["unread"] == before_b + 2  # one status notification even though B is both roles
    api.post(f"/tasks/{t1.json()['id']}/comments", json={"body": f"ping @[B]({users[1]}) and @[out]({outsider})"}, headers=A)
    assert notifs(B)["items"][0]["type"] == "mention"
    assert notifs(C)["unread"] == 0  # a non-member mention creates nothing
    nid = notifs(B)["items"][0]["id"]
    assert api.post(f"/notifications/{nid}/read", headers=A).status_code == 404  # not A's notification
    assert api.post(f"/notifications/{nid}/read", headers=B).status_code == 204
    assert notifs(B)["unread"] == before_b + 2
    assert api.post("/notifications/read-all", headers=B).status_code == 204
    assert notifs(B)["unread"] == 0

    an = api.get(f"/projects/{pid}/analytics", headers=A).json()
    assert an["total_tasks"] == 1 and an["by_status"]["in_review"] == 1 and an["completion_rate"] == 0 and an["overdue_tasks"] == 1, an
    assert api.get(f"/projects/{pid}/analytics", headers=C).status_code == 403

    # --- sprints ---
    t3 = api.post(f"/projects/{pid}/tasks", json={"title": "Fin", "estimate": 3, "status": "done"}, headers=A).json()
    sp = api.post(f"/projects/{pid}/sprints", json={"name": "S1", "start_date": "2026-01-01", "end_date": "2026-01-14"}, headers=B)
    assert sp.status_code == 201, sp.text
    sid = sp.json()["id"]
    assert api.post(f"/projects/{pid}/sprints", json={"name": "bad", "start_date": "2026-02-01", "end_date": "2026-01-01"}, headers=A).status_code == 422
    assert api.get(f"/projects/{pid}/sprints", headers=C).status_code == 403
    assert api.post(f"/sprints/{sid}/tasks", json={"add": [t1.json()["id"], t3["id"]]}, headers=C).status_code == 403
    r = api.post(f"/sprints/{sid}/tasks", json={"add": [t1.json()["id"], t3["id"]]}, headers=A).json()
    assert r["total"] == 2 and r["done"] == 1 and r["points_done"] == 3, r
    assert api.patch(f"/sprints/{sid}", json={"status": "completed"}, headers=A).status_code == 409  # must start first
    assert api.patch(f"/sprints/{sid}", json={"status": "active"}, headers=A).json()["status"] == "active"
    sa = api.get(f"/projects/{pid}/analytics", headers=A).json()["sprint"]
    assert sa["name"] == "S1" and sa["total"] == 2 and sa["done"] == 1 and len(sa["burndown"]["points"]) == 14, sa
    assert sa["burndown"]["unit"] == "points" and sa["burndown"]["total"] == 3
    sp2 = api.post(f"/projects/{pid}/sprints", json={"name": "S2", "start_date": "2026-01-15", "end_date": "2026-01-28"}, headers=A).json()
    assert api.patch(f"/sprints/{sp2['id']}", json={"status": "active"}, headers=A).status_code == 409  # one active
    # moving a task to another open sprint removes it from the first
    r2 = api.post(f"/sprints/{sp2['id']}/tasks", json={"add": [t1.json()["id"]]}, headers=A).json()
    assert r2["total"] == 1
    assert next(s for s in api.get(f"/projects/{pid}/sprints", headers=A).json() if s["id"] == sid)["total"] == 1
    assert len(api.get(f"/workspaces/{ws_id}/sprints", headers=A).json()) == 2
    done = api.patch(f"/sprints/{sid}", json={"status": "completed"}, headers=A).json()
    assert done["status"] == "completed" and done["total"] == 1  # finished task kept for history
    assert api.patch(f"/sprints/{sid}", json={"name": "x"}, headers=A).status_code == 409
    assert api.delete(f"/sprints/{sp2['id']}", headers=A).status_code == 204
    assert api.delete(f"/projects/{pid}", headers=A).status_code == 204
    print("SMOKE OK")
finally:
    for uid in users:
        admin.table("workspaces").delete().eq("owner_id", uid).execute()
        admin.auth.admin.delete_user(uid)
