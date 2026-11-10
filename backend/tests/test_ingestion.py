import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import init_db
from app.services.ingestion.extractor import DocumentExtractor
from app.services.ingestion.chunker import TextChunker
import docx

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()

def test_chunker_basic():
    chunker = TextChunker(chunk_size=50, chunk_overlap=10)
    # Generate 120 words
    words = [f"word{i}" for i in range(120)]
    from app.services.ingestion.extractor import ExtractedSection
    sections = [ExtractedSection(content=" ".join(words), page_number=1, section_title="Introduction")]
    chunks = chunker.chunk_sections(sections)
    assert len(chunks) >= 2
    assert chunks[0].page_number == 1
    assert chunks[0].section_title == "Introduction"

def test_upload_txt_document():
    client = TestClient(app)
    sample_content = b"""# Enterprise Travel Policy
Employees must submit expense reports within 30 days of the travel date.
Failure to submit receipts within 30 days will result in delayed reimbursement.
Meals are reimbursed up to $75 per day.
Lodging requires pre-approval from the finance department."""

    files = {"file": ("travel_policy.txt", io.BytesIO(sample_content), "text/plain")}
    data = {"title": "Employee Travel Policy", "access_level": "organization"}
    response = client.post("/api/documents/upload", files=files, data=data)
    assert response.status_code == 200
    doc = response.json()
    assert doc["title"] == "Employee Travel Policy"
    assert doc["status"] == "indexed"
    assert doc["file_type"] == "txt"

    doc_id = doc["id"]

    # Test preview endpoint
    preview_res = client.get(f"/api/documents/{doc_id}/preview")
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["total_chunks"] >= 1
    assert "30 days" in preview_data["preview_text"]

def test_upload_docx_document(tmp_path):
    # Create real DOCX file
    docx_file = tmp_path / "engineering_guide.docx"
    doc = docx.Document()
    doc.add_heading("Engineering Architecture Guide", level=1)
    doc.add_paragraph("All microservices must communicate via gRPC or authenticated HTTPS.")
    doc.add_paragraph("Data persistence requires PostgreSQL with strict row-level security.")
    doc.save(str(docx_file))

    with open(docx_file, "rb") as f:
        content = f.read()

    client = TestClient(app)
    files = {"file": ("engineering_guide.docx", io.BytesIO(content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    data = {"title": "Engineering Architecture Guide", "access_level": "organization"}
    response = client.post("/api/documents/upload", files=files, data=data)
    assert response.status_code == 200
    doc_res = response.json()
    assert doc_res["title"] == "Engineering Architecture Guide"
    assert doc_res["status"] == "indexed"

