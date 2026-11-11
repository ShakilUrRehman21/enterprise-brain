"""Permission-aware hybrid retrieval: BM25 keyword ranking + vector similarity,
fused with Reciprocal Rank Fusion (RRF).

Candidate chunks are selected in SQL with the caller's visibility clause
*before* any scoring, so restricted documents never influence results.
Parsed chunk data (token counts, vectors) is cached in-process and keyed by
chunk id + embedding model, so it stays correct across re-ingestion/reindexing.
"""
import math
import threading
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DocStatus, Document, DocumentChunk, User
from app.services.embeddings import embeddings
from app.services.permissions import visible_documents_clause
from app.services.text import tokenize

RRF_K = 60.0
BM25_K1, BM25_B = 1.4, 0.75


@dataclass
class IndexedChunk:
    chunk_id: str
    document_id: str
    chunk_index: int
    content: str
    page_number: Optional[int]
    section_title: Optional[str]
    terms: Counter
    length: int
    vector: Optional[np.ndarray]
    embedding_model: Optional[str]


@dataclass
class Hit:
    chunk: IndexedChunk
    document_title: str
    access_level: str
    score: float = 0.0
    vector_score: float = 0.0
    keyword_score: float = 0.0
    coverage: float = 0.0  # share of the query's (IDF-weighted) terms found in this chunk

    @property
    def chunk_id(self) -> str:
        return self.chunk.chunk_id

    @property
    def document_id(self) -> str:
        return self.chunk.document_id


@dataclass
class QueryTerms:
    weights: Dict[str, float] = field(default_factory=dict)

    @property
    def total(self) -> float:
        return sum(self.weights.values())

    def coverage(self, terms: Iterable[str]) -> float:
        if not self.weights:
            return 0.0
        present = set(terms)
        return sum(w for t, w in self.weights.items() if t in present) / self.total


class _ChunkCache:
    MAX_ITEMS = 50_000

    def __init__(self) -> None:
        self._items: Dict[tuple, IndexedChunk] = {}
        self._lock = threading.Lock()

    def get_many(self, db: Session, keys: List[tuple]) -> Dict[str, IndexedChunk]:
        missing = [cid for cid, model in keys if (cid, model) not in self._items]
        if missing:
            loaded: Dict[tuple, IndexedChunk] = {}
            for i in range(0, len(missing), 500):
                rows = db.execute(
                    select(DocumentChunk, Document.title).join(Document).where(DocumentChunk.id.in_(missing[i : i + 500]))
                ).all()
                for c, title in rows:
                    loaded[(c.id, c.embedding_model)] = _index_chunk(c, title)
            with self._lock:
                if len(self._items) + len(loaded) > self.MAX_ITEMS:
                    self._items.clear()
                self._items.update(loaded)
        return {cid: self._items[(cid, model)] for cid, model in keys if (cid, model) in self._items}

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


def _index_chunk(c: DocumentChunk, doc_title: str) -> IndexedChunk:
    body = tokenize(c.content)
    # Headings and titles are strong signals; count them alongside the body.
    meta = tokenize(f"{doc_title} {c.section_title or ''}")
    terms = Counter(body) + Counter(meta)
    vec = np.asarray(c.embedding, dtype=np.float32) if c.embedding else None
    return IndexedChunk(
        chunk_id=c.id,
        document_id=c.document_id,
        chunk_index=c.chunk_index,
        content=c.content,
        page_number=c.page_number,
        section_title=c.section_title,
        terms=terms,
        length=max(1, sum(terms.values())),
        vector=vec,
        embedding_model=c.embedding_model,
    )


chunk_cache = _ChunkCache()


class Retriever:
    def __init__(self, db: Session):
        self.db = db

    def _candidates(self, user: User, document_ids: Optional[List[str]] = None):
        stmt = (
            select(DocumentChunk.id, DocumentChunk.embedding_model, Document.title, Document.access_level)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.status == DocStatus.INDEXED, visible_documents_clause(user))
        )
        if document_ids:
            stmt = stmt.where(Document.id.in_(document_ids))
        return self.db.execute(stmt).all()

    def query_terms(self, text: str) -> QueryTerms:
        """IDF-weighted terms of `text`, using the corpus of the last search.

        Terms that never occur are weighted as if they occurred once, so a
        question about something absent (e.g. "revenue") lowers coverage."""
        corpus = getattr(self, "_corpus", {})
        n = max(len(corpus), 1)
        weights = {}
        for t in dict.fromkeys(tokenize(text)):
            df = max(sum(1 for h in corpus.values() if t in h.chunk.terms), 1)
            weights[t] = math.log(1 + (n - df + 0.5) / (df + 0.5))
        return QueryTerms(weights)

    def search(self, query: str, user: User, mode: str = "hybrid", limit: int = 10) -> tuple[List[Hit], QueryTerms, bool]:
        """Return (hits, weighted query terms, whether vector scoring was available)."""
        rows = self._candidates(user)
        if not rows:
            return [], QueryTerms(), False

        meta = {cid: (title, access) for cid, _, title, access in rows}
        chunks = chunk_cache.get_many(self.db, [(cid, model) for cid, model, _, _ in rows])
        hits = {cid: Hit(chunk=ch, document_title=meta[cid][0], access_level=meta[cid][1]) for cid, ch in chunks.items()}
        n_docs = len(hits)

        # ---- weighted query terms (IDF over the caller's visible corpus) ----
        self._corpus = hits
        qt = self.query_terms(query)
        q_terms, idf = list(qt.weights), qt.weights
        for h in hits.values():
            h.coverage = qt.coverage(h.chunk.terms)

        # ---- keyword ranking (BM25) ----
        keyword_rank: List[Hit] = []
        if mode in ("keyword", "hybrid") and q_terms:
            avg_len = sum(h.chunk.length for h in hits.values()) / n_docs
            for h in hits.values():
                s = 0.0
                for t in q_terms:
                    tf = h.chunk.terms.get(t, 0)
                    if tf:
                        s += idf[t] * tf * (BM25_K1 + 1) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * h.chunk.length / avg_len))
                h.keyword_score = s
            keyword_rank = sorted((h for h in hits.values() if h.keyword_score > 0), key=lambda h: h.keyword_score, reverse=True)

        # ---- vector ranking (per embedding model) ----
        vector_rank: List[Hit] = []
        vector_available = False
        if mode in ("vector", "hybrid"):
            q_vecs = embeddings.embed_query(query, [h.chunk.embedding_model for h in hits.values() if h.chunk.embedding_model])
            vector_available = bool(q_vecs)
            for h in hits.values():
                qv = q_vecs.get(h.chunk.embedding_model or "")
                if qv is not None and h.chunk.vector is not None and h.chunk.vector.shape == qv.shape:
                    h.vector_score = float(np.dot(qv, h.chunk.vector))
            floors = {mid: getattr(embeddings.by_model_id(mid), "min_similarity", 1.0) for mid in q_vecs}
            vector_rank = sorted(
                (h for h in hits.values() if h.vector_score > 0 and h.vector_score >= floors.get(h.chunk.embedding_model or "", 1.0)),
                key=lambda h: h.vector_score,
                reverse=True,
            )

        # ---- fusion ----
        if mode == "keyword":
            ranked = keyword_rank
            for h in ranked:
                h.score = h.keyword_score
        elif mode == "vector":
            ranked = vector_rank
            for h in ranked:
                h.score = h.vector_score
        else:
            for ranking in (keyword_rank, vector_rank):
                for r, h in enumerate(ranking):
                    h.score += 1.0 / (RRF_K + r + 1)
            ranked = sorted((h for h in hits.values() if h.score > 0), key=lambda h: h.score, reverse=True)

        return ranked[:limit], qt, vector_available
