from typing import List, Optional
from app.services.ingestion.extractor import ExtractedSection
from app.core.config import settings

class Chunk:
    def __init__(
        self,
        chunk_index: int,
        content: str,
        page_number: Optional[int] = None,
        section_title: Optional[str] = None,
        token_count: int = 0
    ):
        self.chunk_index = chunk_index
        self.content = content
        self.page_number = page_number
        self.section_title = section_title
        self.token_count = token_count

class TextChunker:
    def __init__(self, chunk_size: int = settings.CHUNK_SIZE, chunk_overlap: int = settings.CHUNK_OVERLAP):
        # 1 token is approximately 4 characters in English
        self.chunk_size_tokens = chunk_size
        self.overlap_tokens = chunk_overlap
        self.target_char_size = chunk_size * 4
        self.overlap_chars = chunk_overlap * 4

    def chunk_sections(self, sections: List[ExtractedSection]) -> List[Chunk]:
        """
        Takes extracted structured sections and splits them into sized chunks with overlap,
        respecting section boundaries and preserving page references.
        """
        all_chunks: List[Chunk] = []
        global_index = 0

        for section in sections:
            text = section.content.strip()
            if not text:
                continue

            words = text.split()
            # If section is small enough, keep as single chunk
            if len(words) <= self.chunk_size_tokens:
                all_chunks.append(
                    Chunk(
                        chunk_index=global_index,
                        content=text,
                        page_number=section.page_number,
                        section_title=section.section_title,
                        token_count=len(words)
                    )
                )
                global_index += 1
                continue

            # Sliding window over words with overlap
            step = max(50, self.chunk_size_tokens - self.overlap_tokens)
            start = 0

            while start < len(words):
                end = min(len(words), start + self.chunk_size_tokens)
                chunk_words = words[start:end]
                chunk_text = " ".join(chunk_words).strip()

                if len(chunk_text) > 40:  # Skip tiny fragments
                    all_chunks.append(
                        Chunk(
                            chunk_index=global_index,
                            content=chunk_text,
                            page_number=section.page_number,
                            section_title=section.section_title,
                            token_count=len(chunk_words)
                        )
                    )
                    global_index += 1

                if end == len(words):
                    break
                start += step

        return all_chunks

