"""Test setup: every test session gets its own temporary database and upload
folder, configured *before* the app is imported. Gemini is disabled so tests
are deterministic and offline."""
import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="eb-tests-"))
os.environ.update(
    DATABASE_URL=f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    UPLOAD_DIR=str(_TMP / "uploads"),
    GEMINI_API_KEY="",
    SECRET_KEY="test-secret-key-that-is-at-least-32-bytes-long",
    ALLOW_REGISTRATION="true",
    ADMIN_EMAIL="",
    ADMIN_PASSWORD="",
)

import io  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import reset_db  # noqa: E402
from app.main import app  # noqa: E402
from app.services.retrieval import chunk_cache  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture()
def client():
    reset_db()
    chunk_cache.clear()
    with TestClient(app) as c:
        yield c


def register(client, email, name="Test User"):
    r = client.post("/api/auth/register", json={"email": email, "full_name": name, "password": PASSWORD})
    assert r.status_code == 201, r.text
    data = r.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data["user"]


@pytest.fixture()
def admin(client):
    return register(client, "admin@example.com", "Ada Admin")


@pytest.fixture()
def member(client, admin):
    return register(client, "member@example.com", "Max Member")


def upload(client, headers, name, text, access="organization", title=None, user_ids=()):
    data = {"access_level": access}
    if title:
        data["title"] = title
    if user_ids:
        data["user_ids"] = list(user_ids)
    r = client.post(
        "/api/documents",
        files={"file": (name, io.BytesIO(text.encode() if isinstance(text, str) else text), "text/plain")},
        data=data,
        headers=headers,
    )
    assert r.status_code == 202, r.text
    doc = client.get(f"/api/documents/{r.json()['id']}", headers=headers).json()
    assert doc["status"] == "indexed", doc
    return doc


@pytest.fixture()
def samples(client, admin):
    r = client.post("/api/system/sample-documents", headers=admin[0])
    assert r.status_code == 200, r.text
    assert len(r.json()["added"]) == 6
    return r.json()["added"]
