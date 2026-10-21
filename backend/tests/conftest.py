import pytest
from fastapi.testclient import TestClient

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.main import app


class FakeQuery:
    """Minimal chainable stand-in for the supabase query builder."""

    def __init__(self, rows):
        self.rows = rows

    def __getattr__(self, _):
        return lambda *a, **k: self

    def execute(self):
        return type("R", (), {"data": self.rows, "count": len(self.rows)})()


class FakeDB:
    def __init__(self, tables=None):
        self.tables = tables or {}

    def table(self, name):
        return FakeQuery(self.tables.get(name, []))


@pytest.fixture
def make_client():
    def _make(tables=None, user_id="user-1"):
        app.dependency_overrides[get_db] = lambda: FakeDB(tables)
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=user_id, email="a@b.c")
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()
