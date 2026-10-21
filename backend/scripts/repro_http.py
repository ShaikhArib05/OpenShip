"""Hit the *running* backend over HTTP the way the browser does (parallel calls, Origin header)."""
import json
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

from supabase import create_client

from app.core.config import get_settings

import os

BASE = os.environ.get("BASE", "http://localhost:8000")
s = get_settings()
admin = create_client(s.supabase_url, s.supabase_service_role_key)
email, pw = f"repro-{uuid.uuid4().hex[:8]}@example.com", "Repro-pass-123!"


def call(method, path, token, body=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Origin": "http://localhost:3000"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


uid = admin.auth.admin.create_user({"email": email, "password": pw, "email_confirm": True}).user.id
try:
    tok = create_client(s.supabase_url, s.supabase_service_role_key).auth.sign_in_with_password(
        {"email": email, "password": pw}
    ).session.access_token
    ws = call("POST", "/workspaces", tok, {"name": "Repro"})[1]
    pid = call("POST", f"/workspaces/{ws['id']}/projects", tok, {"name": "P"})[1]["id"]
    paths = [f"/projects/{pid}", f"/projects/{pid}/tasks", f"/workspaces/{ws['id']}/members", "/notifications", "/workspaces"]
    bad = 0
    for rnd in range(6):
        with ThreadPoolExecutor(8) as ex:
            results = list(ex.map(lambda p: (p, call("GET", p, tok)), paths * 2))
        for p, (code, body) in results:
            if code != 200:
                bad += 1
                print(rnd, code, p, body)
    print("failures:", bad, "of", 6 * len(paths) * 2)
finally:
    admin.table("workspaces").delete().eq("owner_id", uid).execute()
    admin.auth.admin.delete_user(uid)
