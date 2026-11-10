import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import init_db

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()

def test_evaluation_pipeline_and_seed():
    client = TestClient(app)

    # 1. Seed demo knowledge base
    seed_res = client.post("/api/demo/seed")
    assert seed_res.status_code == 200
    assert seed_res.json()["success"] is True

    # 2. Get dataset
    ds_res = client.get("/api/evaluation/dataset")
    assert ds_res.status_code == 200
    questions = ds_res.json()
    assert len(questions) >= 30

    # Ensure all required categories exist
    categories = set(q["category"] for q in questions)
    assert "Direct factual" in categories
    assert "Multi-document" in categories
    assert "Synthesis" in categories
    assert "Missing evidence" in categories
    assert "Contradiction" in categories
    assert "Permission-restricted" in categories

    # 3. Run evaluation benchmark
    eval_res = client.post("/api/evaluation/run")
    assert eval_res.status_code == 200
    report = eval_res.json()
    assert report["total_evaluated"] >= 30
    assert report["retrieval_recall_at_5"] > 0.70
    assert report["abstention_accuracy"] >= 0.85
    assert len(report["category_breakdown"]) >= 5

