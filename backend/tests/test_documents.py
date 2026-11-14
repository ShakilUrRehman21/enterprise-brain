import io

from docx import Document as DocxDocument
from pypdf import PdfWriter

from tests.conftest import upload


def test_upload_txt_creates_chunks_with_sections(client, admin):
    doc = upload(client, admin[0], "policy.md", "# Travel\n\n## Meals\nDaily meal allowance is $75.\n\n## Hotels\nUse approved hotels.")
    assert doc["chunk_count"] == 2
    assert {c["section_title"] for c in doc["chunks"]} == {"Meals", "Hotels"}
    assert doc["title"] == "Policy"


def test_upload_docx_keeps_headings(client, admin):
    d = DocxDocument()
    d.add_heading("Onboarding", level=1)
    d.add_paragraph("New hires receive a laptop on their first day.")
    buf = io.BytesIO()
    d.save(buf)
    r = client.post(
        "/api/documents",
        files={"file": ("guide.docx", buf.getvalue(), "application/octet-stream")},
        headers=admin[0],
    )
    doc = client.get(f"/api/documents/{r.json()['id']}", headers=admin[0]).json()
    assert doc["status"] == "indexed"
    assert doc["chunks"][0]["section_title"] == "Onboarding"


def test_blank_pdf_fails_with_a_clear_message(client, admin):
    w = PdfWriter()
    w.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    w.write(buf)
    r = client.post("/api/documents", files={"file": ("scan.pdf", buf.getvalue(), "application/pdf")}, headers=admin[0])
    doc = client.get(f"/api/documents/{r.json()['id']}", headers=admin[0]).json()
    assert doc["status"] == "failed"
    assert "OCR" in doc["error_message"]


def test_rejects_bad_type_empty_and_duplicate_files(client, admin):
    h = admin[0]
    assert client.post("/api/documents", files={"file": ("x.exe", b"MZ", "x")}, headers=h).status_code == 400
    assert client.post("/api/documents", files={"file": ("x.txt", b"", "text/plain")}, headers=h).status_code == 400
    upload(client, h, "a.txt", "Same content here for the test.")
    dup = client.post("/api/documents", files={"file": ("b.txt", b"Same content here for the test.", "text/plain")}, headers=h)
    assert dup.status_code == 409


def test_filenames_cannot_escape_the_upload_folder(client, admin):
    from app.core.config import settings

    doc = upload(client, admin[0], "../../evil.txt", "Path traversal attempt content.")
    assert doc["filename"] == "evil.txt"
    stored = list(settings.upload_path.iterdir())
    assert all(p.parent == settings.upload_path for p in stored)


def test_delete_removes_file_and_chunks(client, admin):
    from app.core.config import settings

    doc = upload(client, admin[0], "temp.txt", "Temporary document text for deletion.")
    before = len(list(settings.upload_path.iterdir()))
    assert client.delete(f"/api/documents/{doc['id']}", headers=admin[0]).status_code == 204
    assert len(list(settings.upload_path.iterdir())) == before - 1
    assert client.get(f"/api/documents/{doc['id']}", headers=admin[0]).status_code == 404


def test_download_original(client, admin):
    doc = upload(client, admin[0], "notes.txt", "Original file body.")
    r = client.get(f"/api/documents/{doc['id']}/file", headers=admin[0])
    assert r.status_code == 200 and r.content == b"Original file body."
