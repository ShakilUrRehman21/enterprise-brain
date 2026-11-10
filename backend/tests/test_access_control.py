import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import init_db

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()

def test_user_a_and_user_b_permission_isolation():
    """
    Master Prompt Section 5 Security Scenario:
    User A:
      - Can access Private Executive Leave Policy
      - Can access Engineering Guide (Organization-wide)
    User B:
      - Can access Engineering Guide
      - CANNOT access Private Executive Leave Policy
    User B asks: 'What is the confidential executive leave policy?'
    Expected: Abstains, no confidential text in context, citations, or response.
    """
    client = TestClient(app)

    headers_user_a = {
        "X-User-Email": "alice_hr_director@enterprise.com",
        "X-User-Role": "admin",
        "X-User-Name": "Alice HR Director"
    }

    headers_user_b = {
        "X-User-Email": "bob_engineer@enterprise.com",
        "X-User-Role": "member",
        "X-User-Name": "Bob Engineer"
    }

    # 1. User A uploads confidential HR Policy (Private)
    hr_content = b"""# Confidential Executive Compensation and Leave Policy
Executives are granted 45 days of executive sabbatical leave per calendar year.
Executive golden parachute severance provides 24 months of full salary.
Executive medical expense reimbursement is unlimited with zero deductible."""

    files_hr = {"file": ("exec_leave_policy.txt", io.BytesIO(hr_content), "text/plain")}
    data_hr = {"title": "Confidential Executive Leave Policy", "access_level": "private"}
    upload_hr = client.post("/api/documents/upload", files=files_hr, data=data_hr, headers=headers_user_a)
    assert upload_hr.status_code == 200
    hr_doc_id = upload_hr.json()["id"]

    # 2. Upload Engineering Guide (Organization-wide)
    eng_content = b"""# Engineering Architecture Guide
All microservices run on Kubernetes with automated canary deployments.
Services must adhere to zero-trust network policies and mutual TLS."""

    files_eng = {"file": ("eng_guide.txt", io.BytesIO(eng_content), "text/plain")}
    data_eng = {"title": "Engineering Architecture Guide", "access_level": "organization"}
    upload_eng = client.post("/api/documents/upload", files=files_eng, data=data_eng, headers=headers_user_a)
    assert upload_eng.status_code == 200
    eng_doc_id = upload_eng.json()["id"]

    # 3. Security Check: User B attempts to view document list
    docs_user_b = client.get("/api/documents", headers=headers_user_b).json()
    b_doc_ids = [d["id"] for d in docs_user_b]
    assert eng_doc_id in b_doc_ids
    assert hr_doc_id not in b_doc_ids, "CRITICAL SECURITY BREACH: User B saw private HR document in list!"

    # 4. Security Check: User B attempts to access HR document by ID
    direct_get = client.get(f"/api/documents/{hr_doc_id}", headers=headers_user_b)
    assert direct_get.status_code == 403, f"Expected 403 Forbidden for User B, got {direct_get.status_code}"

    # 5. Security Check: User B attempts to preview HR document chunks
    preview_attempt = client.get(f"/api/documents/{hr_doc_id}/preview", headers=headers_user_b)
    assert preview_attempt.status_code == 403

    # 6. Security Check: User B performs search for HR executive leave
    search_b = client.post("/api/search", json={"query": "executive sabbatical leave golden parachute", "mode": "hybrid"}, headers=headers_user_b)
    assert search_b.status_code == 200
    search_b_hits = search_b.json()["results"]
    for hit in search_b_hits:
        assert hit["document_id"] != hr_doc_id, "CRITICAL SECURITY BREACH: HR chunk returned in User B search results!"

    # 7. Security Check: User B asks in Chat: 'What is the confidential executive leave policy?'
    chat_b = client.post("/api/chat", json={"message": "What is the confidential executive leave policy?"}, headers=headers_user_b)
    assert chat_b.status_code == 200
    msg_b = chat_b.json()["message"]
    # User B must receive abstention
    assert "couldn't find sufficient evidence" in msg_b["content"].lower()
    assert msg_b["abstained"] is True
    assert msg_b["citations"] == []
    assert "45 days" not in msg_b["content"]
    assert "golden parachute" not in msg_b["content"]

    # 8. Contrast: User A asks the same question and gets the verified answer
    chat_a = client.post("/api/chat", json={"message": "What is the confidential executive leave policy?"}, headers=headers_user_a)
    assert chat_a.status_code == 200
    msg_a = chat_a.json()["message"]
    assert msg_a["abstained"] is False
    assert len(msg_a["citations"]) >= 1
    assert "Confidential Executive Leave Policy" in msg_a["citations"][0]["document_title"]
