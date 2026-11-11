from tests.conftest import PASSWORD, register


def test_first_user_is_admin_and_next_is_member(client):
    _, first = register(client, "first@example.com")
    _, second = register(client, "second@example.com")
    assert first["role"] == "admin"
    assert second["role"] == "member"


def test_endpoints_require_a_valid_token(client, admin):
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/documents", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    assert client.get("/api/auth/me", headers=admin[0]).json()["email"] == "admin@example.com"


def test_role_headers_cannot_escalate_privileges(client, member):
    headers = {**member[0], "X-User-Role": "admin", "X-User-Email": "admin@example.com"}
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["role"] == "member"
    assert client.get("/api/users", headers=headers).status_code == 403


def test_login_and_wrong_password(client, admin):
    ok = client.post("/api/auth/login", json={"email": "ADMIN@example.com", "password": PASSWORD})
    assert ok.status_code == 200 and ok.json()["user"]["role"] == "admin"
    bad = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrong-password"})
    assert bad.status_code == 401


def test_duplicate_email_and_weak_password_rejected(client, admin):
    dup = client.post("/api/auth/register", json={"email": "admin@example.com", "full_name": "X", "password": PASSWORD})
    assert dup.status_code == 409
    weak = client.post("/api/auth/register", json={"email": "new@example.com", "full_name": "X", "password": "short"})
    assert weak.status_code == 422


def test_admin_manages_roles_but_cannot_lock_themselves_out(client, admin, member):
    a_headers, a_user = admin
    _, m_user = member
    promoted = client.patch(f"/api/users/{m_user['id']}", json={"role": "admin"}, headers=a_headers)
    assert promoted.json()["role"] == "admin"
    self_demote = client.patch(f"/api/users/{a_user['id']}", json={"role": "member"}, headers=a_headers)
    assert self_demote.status_code == 400


def test_deactivated_user_loses_access(client, admin, member):
    m_headers, m_user = member
    client.patch(f"/api/users/{m_user['id']}", json={"is_active": False}, headers=admin[0])
    assert client.get("/api/auth/me", headers=m_headers).status_code == 401
    login = client.post("/api/auth/login", json={"email": "member@example.com", "password": PASSWORD})
    assert login.status_code == 403
