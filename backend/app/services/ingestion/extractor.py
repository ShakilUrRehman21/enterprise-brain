import os
import re
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
import docx

class ExtractedSection:
    def __init__(self, content: str, page_number: Optional[int] = None, section_title: Optional[str] = None):
        self.content = content.strip()
        self.page_number = page_number
        self.section_title = section_title

class DocumentExtractor:
    @staticmethod
    def extract_text_from_file(file_path: str, file_type: str) -> List[ExtractedSection]:
        """
        Extracts structured text units with page numbers and section headings.
        """
        file_type = file_type.lower().strip(".")
        if file_type == "pdf":
            return DocumentExtractor._extract_pdf(file_path)
        elif file_type in ["docx", "doc"]:
            return DocumentExtractor._extract_docx(file_path)
        elif file_type in ["txt", "md"]:
            return DocumentExtractor._extract_txt(file_path)
        else:
            raise ValueError(f"Unsupported document format: {file_type}. Supported: PDF, DOCX, TXT.")

    @staticmethod
    def _extract_pdf(file_path: str) -> List[ExtractedSection]:
        sections: List[ExtractedSection] = []
        reader = PdfReader(file_path)
        current_heading = "General"

        for page_idx, page in enumerate(reader.pages):
            raw_text = page.extract_text() or ""
            lines = raw_text.splitlines()
            page_text_blocks = []

            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue
                # Simple heading heuristic: uppercase or short title-like lines
                if len(stripped) < 60 and (stripped.isupper() or stripped.endswith(":") or stripped.startswith(("#", "SECTION", "POLICY", "ARTICLE"))):
                    current_heading = stripped.lstrip("#").strip()
                page_text_blocks.append(stripped)

            page_content = "\n".join(page_text_blocks).strip()
            if page_content:
                sections.append(
                    ExtractedSection(
                        content=page_content,
                        page_number=page_idx + 1,
                        section_title=current_heading
                    )
                )

        if not sections:
            raise ValueError("PDF document contains no readable text or is empty/scanned.")
        return sections

    @staticmethod
    def _extract_docx(file_path: str) -> List[ExtractedSection]:
        sections: List[ExtractedSection] = []
        doc = docx.Document(file_path)
        current_heading = "Overview"
        current_paragraphs: List[str] = []
        page_estimate = 1
        word_count = 0

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            # Check if paragraph has heading style
            if p.style and "heading" in p.style.name.lower():
                if current_paragraphs:
                    sections.append(
                        ExtractedSection(
                            content="\n".join(current_paragraphs),
                            page_number=page_estimate,
                            section_title=current_heading
                        )
                    )
                    current_paragraphs = []
                current_heading = text
            else:
                current_paragraphs.append(text)
                word_count += len(text.split())
                if word_count > 450:  # ~1 page per 450 words
                    page_estimate += 1
                    word_count = 0

        if current_paragraphs:
            sections.append(
                ExtractedSection(
                    content="\n".join(current_paragraphs),
                    page_number=page_estimate,
                    section_title=current_heading
                )
            )

        if not sections:
            raise ValueError("DOCX document contains no readable text.")
        return sections

    @staticmethod
    def _extract_txt(file_path: str) -> List[ExtractedSection]:
        sections: List[ExtractedSection] = []
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        if not content.strip():
            raise ValueError("Text document is empty.")

        # Split into sections based on Markdown headers or double line-breaks
        pattern = r"(^#{1,3}\s+.+$|^[A-Z\s]{4,40}$)"
        parts = re.split(pattern, content, flags=re.MULTILINE)

        current_heading = "General"
        page_counter = 1
        accumulated_text = ""

        for part in parts:
            stripped = part.strip()
            if not stripped:
                continue
            if re.match(pattern, stripped, flags=re.MULTILINE):
                if accumulated_text.strip():
                    sections.append(
                        ExtractedSection(
                            content=accumulated_text.strip(),
                            page_number=page_counter,
                            section_title=current_heading
                        )
                    )
                    accumulated_text = ""
                    page_counter += 1
                current_heading = stripped.lstrip("#").strip()
            else:
                accumulated_text += "\n" + stripped

        if accumulated_text.strip():
            sections.append(
                ExtractedSection(
                    content=accumulated_text.strip(),
                    page_number=page_counter,
                    section_title=current_heading
                )
            )

        return sections if sections else [ExtractedSection(content=content.strip(), page_number=1, section_title="General")]

