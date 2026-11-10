import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import init_db

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()

def test_hybrid_search():
    client = TestClient(app)

    # 1. Ingest document
    text_data = b"""# Corporate Expense and Travel Guidelines
Employees must submit reimbursement requests within 30 days of incurring business expenses.
Direct business travel requires prior approval from department managers.
Meals are reimbursed up to $75 per day when traveling out of state.
Alcohol expenses are not eligible for corporate reimbursement."""

    files = {"file": ("travel_policy.txt", io.BytesIO(text_data), "text/plain")}
    data = {"title": "Corporate Travel Guidelines", "access_level": "organization"}
    upload_res = client.post("/api/documents/upload", files=files, data=data)
    assert upload_res.status_code == 200

    # 2. Test keyword search
    search_payload = {
        "query": "reimbursement 30 days",
        "mode": "keyword",
        "limit": 5
    }
    kw_res = client.post("/api/search", json=search_payload)
    assert kw_res.status_code == 200
    kw_data = kw_res.json()
    assert kw_data["total_hits"] >= 1
    assert "30 days" in kw_data["results"][0]["content"]
    assert kw_data["results"][0]["keyword_score"] > 0

    # 3. Test hybrid search with RRF
    hybrid_payload = {
        "query": "What is the deadline for submitting travel expense receipts?",
        "mode": "hybrid",
        "limit": 5
    }
    hy_res = client.post("/api/search", json=hybrid_payload)
    assert hy_res.status_code == 200
    hy_data = hy_res.json()
    assert hy_data["total_hits"] >= 1
    top_hit = hy_data["results"][0]
    assert top_hit["combined_rrf_score"] > 0
    assert any("reimbursement" in h["document_title"].lower() or "travel" in h["document_title"].lower() for h in hy_data["results"])
