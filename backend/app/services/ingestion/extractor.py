"""Extract text from PDF, DOCX, TXT and Markdown into sections that keep
their page number and nearest heading."""
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from app.services.text import is_heading

SUPPORTED_TYPES = {"pdf", "docx", "txt", "md"}


class ExtractionError(ValueError):
    pass


@dataclass
class Section:
    content: str
    page_number: Optional[int]
    heading: Optional[str]


def extract(path: Path, file_type: str) -> tuple[List[Section], Optional[int]]:
    """Return (sections, page_count)."""
    ft = file_type.lower().lstrip(".")
    if ft == "pdf":
        sections, pages = _pdf(path), None
        pages = max((s.page_number or 0) for s in sections) if sections else 0
    elif ft == "docx":
        sections, pages = _docx(path), None
    elif ft in ("txt", "md"):
        sections, pages = _text(path.read_text(encoding="utf-8", errors="replace")), None
    else:
        raise ExtractionError(f"Unsupported file type '.{ft}'.")
    sections = [s for s in sections if s.content.strip()]
    if not sections:
        raise ExtractionError("No readable text found. Scanned PDFs need OCR before upload.")
    return sections, pages


def _clean_heading(line: str) -> str:
    return line.strip().lstrip("#").strip().rstrip(":")[:255]


def _split_by_headings(lines: List[str], page: Optional[int], heading: Optional[str]) -> tuple[List[Section], Optional[str]]:
    sections: List[Section] = []
    buf: List[str] = []
    for line in lines:
        if is_heading(line):
            if buf:
                sections.append(Section("\n".join(buf), page, heading))
                buf = []
            heading = _clean_heading(line)
        elif line.strip():
            buf.append(line.strip())
    if buf:
        sections.append(Section("\n".join(buf), page, heading))
    return sections, heading


_BULLET_CHARS = set("•▪●◦‣∙·➢➔►–-*")


def _strip_bullet(line: str) -> tuple[str, bool]:
    """Remove a leading bullet marker. PDFs encode bullets as anything from
    "•" to private-use glyphs or control characters, so match by category.
    A marker only counts when followed by whitespace ("-5%" is not a bullet)."""
    s = line.strip()
    i = 0
    while i < len(s) and (s[i] in _BULLET_CHARS or unicodedata.category(s[i]) in ("Cc", "Co", "Cf", "So")):
        i += 1
    if i == 0 or i == len(s) or not s[i].isspace():
        return s, False
    return s[i:].strip(), True


def _unwrap_pdf_lines(lines: List[str]) -> List[str]:
    """PDF text comes back with hard line breaks inside sentences and odd
    bullet glyphs. Normalise bullets to "• " and re-join wrapped lines."""
    out: List[str] = []
    for raw in lines:
        text, bullet = _strip_bullet(raw)
        if not text:
            continue
        prev = out[-1] if out else None
        continues = (
            prev is not None
            and not bullet
            and not is_heading(text)
            and not is_heading(prev)
            and not prev.rstrip().endswith((".", ":", "!", "?"))
            # lower-case/symbol continuation, or the previous line ran to full width
            and (text[0].islower() or text[0] in "(&,;#" or len(prev) >= 90)
        )
        if continues:
            out[-1] = f"{prev} {text}"
        else:
            out.append(f"• {text}" if bullet else text)
    return out


def _pdf(path: Path) -> List[Section]:
    from pypdf import PdfReader

    try:
        reader = PdfReader(str(path))
    except Exception as exc:
        raise ExtractionError(f"Couldn't open PDF: {exc}") from exc
    if reader.is_encrypted:
        raise ExtractionError("This PDF is password-protected. Remove the password and upload it again.")
    sections: List[Section] = []
    heading: Optional[str] = None
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        page_sections, heading = _split_by_headings(_unwrap_pdf_lines(text.splitlines()), i, heading)
        sections.extend(page_sections)
    return sections


def _docx(path: Path) -> List[Section]:
    import docx

    try:
        document = docx.Document(str(path))
    except Exception as exc:
        raise ExtractionError(f"Couldn't open DOCX: {exc}") from exc
    sections: List[Section] = []
    heading: Optional[str] = None
    buf: List[str] = []

    def flush():
        if buf:
            sections.append(Section("\n".join(buf), None, heading))
            buf.clear()

    for p in document.paragraphs:
        text = p.text.strip()
        if not text:
            continue
        style = (p.style.name if p.style is not None else "").lower()
        if style.startswith("heading") or style == "title":
            flush()
            heading = text[:255]
        else:
            buf.append(text)
    flush()
    for table in document.tables:
        rows = [" | ".join(c.text.strip() for c in row.cells) for row in table.rows]
        if rows:
            sections.append(Section("\n".join(rows), None, heading))
    return sections


def _text(content: str) -> List[Section]:
    # Normalise Windows line endings and form feeds (treated as page breaks).
    content = content.replace("\r\n", "\n")
    sections: List[Section] = []
    heading: Optional[str] = None
    for page_no, page in enumerate(re.split(r"\f", content), start=1):
        page_sections, heading = _split_by_headings(page.splitlines(), page_no if "\f" in content else None, heading)
        sections.extend(page_sections)
    return sections
