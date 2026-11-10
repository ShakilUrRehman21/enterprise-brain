import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.models.entities import User

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()

def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Enterprise Brain" in data["service"]

def test_auth_me_default_admin():
    client = TestClient(app)
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@enterprise.local"
    assert data["role"] == "admin"

def test_auth_me_member_header():
    client = TestClient(app)
    headers = {
        "X-User-Email": "member_bob@enterprise.local",
        "X-User-Role": "member",
        "X-User-Name": "Bob Member"
    }
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "member_bob@enterprise.local"
    assert data["role"] == "member"
    assert data["full_name"] == "Bob Member"

