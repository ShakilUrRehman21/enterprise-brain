from app.services.ingestion.chunker import chunk_sections
from app.services.ingestion.extractor import Section, _text
from app.services.text import split_sentences, stem, tokenize


def test_stemming_is_consistent_for_variants():
    assert stem("days") == stem("day")
    assert stem("travelling") == stem("travel")
    assert stem("expenses") == stem("expense")
    assert stem("submitted") == stem("submit")


def test_tokenize_keeps_compound_terms_and_drops_stop_words():
    assert "m&a" in tokenize("What is the M&A budget?")
    assert "what" not in tokenize("What is the budget?")


def test_sentence_split_handles_lists_and_decimals():
    assert split_sentences("- First item\n- Second item. Third sentence.") == ["First item", "Second item.", "Third sentence."]
    assert split_sentences("Cap is $75.50 per day. Tips are 20%.") == ["Cap is $75.50 per day.", "Tips are 20%."]


def test_chunker_overlaps_and_respects_limit():
    text = " ".join(f"Sentence number {i} has five words." for i in range(100))
    chunks = chunk_sections([Section(text, 1, "Intro")], max_words=60, overlap_words=12)
    assert len(chunks) > 5
    assert all(c.word_count <= 60 for c in chunks)
    assert chunks[0].content.split(". ")[-1] in chunks[1].content  # overlap carried forward


def test_text_extraction_detects_markdown_and_caps_headings():
    sections = _text("INTRODUCTION\nWelcome aboard.\n## Benefits\nHealth cover is included.")
    assert [s.heading for s in sections] == ["INTRODUCTION", "Benefits"]


def test_legacy_database_is_detected(tmp_path):
    import sqlite3

    import pytest
    from sqlalchemy import create_engine

    from app.core import database

    path = tmp_path / "old.db"
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE users (id TEXT PRIMARY KEY, clerk_user_id TEXT NOT NULL, email TEXT)")
    con.commit()
    con.close()
    original = database.engine
    database.engine = create_engine(f"sqlite:///{path}")
    try:
        with pytest.raises(database.LegacySchemaError, match="reset-db"):
            database.init_db()
    finally:
        database.engine.dispose()
        database.engine = original


def test_pdf_lines_are_unwrapped_and_bullets_normalised():
    from app.services.ingestion.extractor import _unwrap_pdf_lines

    lines = [
        "EXPERIENCE",
        " \x7f Built 5 apps, reducing page",
        "load times by 25%.",
        " Second item",
        "-5% is not a bullet",
    ]
    assert _unwrap_pdf_lines(lines) == [
        "EXPERIENCE",
        "• Built 5 apps, reducing page load times by 25%.",
        "• Second item",
        "-5% is not a bullet",
    ]


def test_hash_numbers_are_not_markdown_headings():
    from app.services.text import is_heading

    assert is_heading("## Benefits")
    assert not is_heading("#52532 · #52618")


def test_gemini_client_switches_to_vertex_when_key_is_rejected(monkeypatch):
    from app.services import gemini

    made = []

    class Rejected(Exception):
        code = 403

    def fake_make(self, mode):
        made.append(mode)
        return mode

    monkeypatch.setattr(gemini.GeminiClient, "_make", fake_make)
    client = gemini.GeminiClient("AQ.test", "auto")

    def call(c):
        if c == "developer":
            raise Rejected("PERMISSION_DENIED")
        return "ok"

    assert client.call(call) == "ok"
    assert client.mode == "vertex" and made == ["developer", "vertex"]
    # Non-auth errors are not retried on the other endpoint.
    client2 = gemini.GeminiClient("AQ.test", "auto")
    import pytest

    with pytest.raises(ValueError):
        client2.call(lambda c: (_ for _ in ()).throw(ValueError("quota")))
    assert client2.mode == "developer"
