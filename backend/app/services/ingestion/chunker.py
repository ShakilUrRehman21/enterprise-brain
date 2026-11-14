"""Split sections into overlapping, sentence-aligned chunks."""
from dataclasses import dataclass
from typing import List, Optional

from app.services.ingestion.extractor import Section
from app.services.text import split_sentences


@dataclass
class Chunk:
    index: int
    content: str
    page_number: Optional[int]
    section_title: Optional[str]
    word_count: int


def chunk_sections(sections: List[Section], max_words: int, overlap_words: int) -> List[Chunk]:
    chunks: List[Chunk] = []
    for section in sections:
        if len(section.content.split()) <= max_words:
            sentences = [section.content]
        else:
            sentences = []
            for sent in split_sentences(section.content):
                w = sent.split()
                # Hard-wrap run-on text (e.g. PDFs without punctuation).
                sentences.extend(" ".join(w[i : i + max_words]) for i in range(0, len(w), max_words))
        window: List[str] = []
        words = 0
        for sent in sentences:
            n = len(sent.split())
            if window and words + n > max_words:
                chunks.append(_make(len(chunks), window, section))
                # Carry trailing sentences forward as overlap.
                carry, carried = [], 0
                for prev in reversed(window):
                    w = len(prev.split())
                    if carried + w > overlap_words:
                        break
                    carry.insert(0, prev)
                    carried += w
                window, words = carry, carried
            window.append(sent)
            words += n
        if window:
            chunks.append(_make(len(chunks), window, section))
    return chunks


def _make(index: int, sentences: List[str], section: Section) -> Chunk:
    text = " ".join(sentences) if len(sentences) > 1 else sentences[0]
    return Chunk(index, text.strip(), section.page_number, section.heading, len(text.split()))
