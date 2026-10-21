"""Live check of the AI endpoints against real Gemini and the real database (slow, uses quota).

Run from backend/:  .venv\Scripts\python -m scripts.smoke_ai
"""
import time
import uuid

from fastapi.testclient import TestClient
from supabase import create_client

from app.core.config import get_settings
from app.main import app

s = get_settings()
admin = create_client(s.supabase_url, s.supabase_service_role_key)
email, pw = f"ai-{uuid.uuid4().hex[:8]}@example.com", "Ai-smoke-pass-1!"
uid = admin.auth.admin.create_user({"email": email, "password": pw, "email_confirm": True}).user.id
try:
    tok = create_client(s.supabase_url, s.supabase_service_role_key).auth.sign_in_with_password(
        {"email": email, "password": pw}).session.access_token
    H = {"Authorization": f"Bearer {tok}"}
    api = TestClient(app)
    assert api.get("/ai/status", headers=H).json() == {"enabled": True}
    ws = api.post("/workspaces", json={"name": "AI WS"}, headers=H).json()["id"]
    pid = api.post(f"/workspaces/{ws}/projects", json={"name": "Pet adoption site"}, headers=H).json()["id"]

    def timed(label, fn):
        t = time.time()
        r = fn()
        print(f"{label}: {r.status_code} in {time.time() - t:.0f}s")
        assert r.status_code == 200, r.text
        return r.json()

    gen = timed("generate", lambda: api.post(f"/projects/{pid}/ai/generate-tasks", headers=H,
        json={"description": "A website where shelters list adoptable pets and visitors can search, favourite and apply to adopt them."}))
    assert 3 <= len(gen["tasks"]) <= 15 and all(t["title"] for t in gen["tasks"]), gen
    print("  e.g.", [t["title"] for t in gen["tasks"][:3]])
    assert api.get(f"/projects/{pid}/tasks", headers=H).json() == []  # nothing saved without approval

    ids = []
    for i, t in enumerate(gen["tasks"][:6]):
        r = api.post(f"/projects/{pid}/tasks", headers=H, json={**t, "due_date": "2020-01-01" if i == 0 else None})
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])

    bd = timed("breakdown", lambda: api.post(f"/tasks/{ids[1]}/ai/breakdown", headers=H))
    assert 2 <= len(bd["subtasks"]) <= 8, bd
    pr = timed("prioritize", lambda: api.post(f"/projects/{pid}/ai/prioritize", headers=H))
    assert all(x["task_id"] in ids and x["priority"] != x["current"] for x in pr["suggestions"]), pr
    print("  priority suggestions:", len(pr["suggestions"]))
    sp = api.post(f"/projects/{pid}/sprints", headers=H, json={"name": "S1", "start_date": "2026-01-01", "end_date": "2026-01-14"}).json()
    plan = timed("sprint plan", lambda: api.post(f"/projects/{pid}/ai/plan-sprint", headers=H, json={"sprint_id": sp["id"], "capacity": 8}))
    assert plan["total_points"] <= 8 and all(t["id"] in ids for t in plan["tasks"]), plan
    print("  planned", len(plan["tasks"]), "tasks,", plan["total_points"], "points")
    sm = timed("summary", lambda: api.post(f"/projects/{pid}/ai/summary", headers=H))
    assert len(sm["summary"]) > 50, sm
    print("AI SMOKE OK")
finally:
    admin.table("workspaces").delete().eq("owner_id", uid).execute()
    admin.auth.admin.delete_user(uid)
