from tests.conftest import register, upload

SECRET = "# Executive Pay\nExecutives receive 45 days of sabbatical leave and a golden parachute of 24 months salary."


def _ask(client, headers, q):
    r = client.post("/api/chat", json={"message": q}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["message"]


def test_private_document_is_invisible_to_other_members(client, admin, member):
    m_headers, _ = member
    other, _ = register(client, "other@example.com")
    doc = upload(client, m_headers, "exec.txt", SECRET, access="private", title="Executive Pay")

    assert doc["id"] not in [d["id"] for d in client.get("/api/documents", headers=other).json()]
    assert client.get(f"/api/documents/{doc['id']}", headers=other).status_code == 404
    hits = client.post("/api/search", json={"query": "sabbatical golden parachute"}, headers=other).json()["results"]
    assert all(h["document_id"] != doc["id"] for h in hits)

    msg = _ask(client, other, "How much sabbatical leave do executives get?")
    assert msg["abstained"] and msg["citations"] == []
    assert "45" not in msg["content"]

    # Owner and admin can both see it.
    assert not _ask(client, m_headers, "How much sabbatical leave do executives get?")["abstained"]
    assert _ask(client, admin[0], "How much sabbatical leave do executives get?")["citations"][0]["document_id"] == doc["id"]


def test_sharing_grants_and_revoking_removes_access(client, admin, member):
    m_headers, m_user = member
    a_headers = admin[0]
    doc = upload(client, a_headers, "exec.txt", SECRET, access="shared", title="Executive Pay", user_ids=[m_user["id"]])
    assert client.get(f"/api/documents/{doc['id']}", headers=m_headers).status_code == 200

    # Switching to private must revoke the earlier share (stale grants bug).
    r = client.put(f"/api/documents/{doc['id']}/access", json={"access_level": "private", "user_ids": []}, headers=a_headers)
    assert r.status_code == 200 and r.json()["shared_with"] == []
    assert client.get(f"/api/documents/{doc['id']}", headers=m_headers).status_code == 404
    assert _ask(client, m_headers, "How much sabbatical leave do executives get?")["abstained"]

    # Switching back to shared without re-adding users keeps it closed.
    client.put(f"/api/documents/{doc['id']}/access", json={"access_level": "shared", "user_ids": []}, headers=a_headers)
    assert client.get(f"/api/documents/{doc['id']}", headers=m_headers).status_code == 404


def test_members_cannot_manage_others_documents(client, admin, member):
    doc = upload(client, admin[0], "org.txt", "Organization wide note about lunch.", access="organization")
    m_headers, _ = member
    assert client.get(f"/api/documents/{doc['id']}", headers=m_headers).json()["can_manage"] is False
    assert client.delete(f"/api/documents/{doc['id']}", headers=m_headers).status_code == 403
    r = client.put(f"/api/documents/{doc['id']}/access", json={"access_level": "private"}, headers=m_headers)
    assert r.status_code == 403


def test_conversations_are_private_to_their_owner(client, admin, member):
    upload(client, admin[0], "org.txt", "The office opens at 9am every weekday.")
    conv_id = client.post("/api/chat", json={"message": "When does the office open?"}, headers=admin[0]).json()["conversation"]["id"]
    assert client.get(f"/api/conversations/{conv_id}", headers=member[0]).status_code == 404
    r = client.post("/api/chat", json={"message": "hi", "conversation_id": conv_id}, headers=member[0])
    assert r.status_code == 404


def test_evaluation_and_admin_endpoints_are_admin_only(client, member):
    h = member[0]
    assert client.get("/api/evaluation/latest", headers=h).status_code == 403
    assert client.post("/api/evaluation/run", headers=h).status_code == 403
    assert client.post("/api/system/sample-documents", headers=h).status_code == 403
