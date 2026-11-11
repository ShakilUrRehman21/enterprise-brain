"""Embedding providers.

Every stored vector is tagged with the id of the model that produced it.
Retrieval only compares a query vector with chunk vectors from the *same*
model, so a corpus can never silently mix incompatible vector spaces.
"""
import logging
import math
import time
import zlib
from collections import Counter
from functools import lru_cache
from typing import Dict, List, Optional, Sequence

import numpy as np

from app.core.config import settings
from app.services.text import raw_tokens, stem, STOP_WORDS

logger = logging.getLogger(__name__)


class EmbeddingError(RuntimeError):
    pass


class EmbeddingProvider:
    model_id: str
    dimension: int
    # Cosine similarity below which a match is treated as noise.
    min_similarity: float = 0.0

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        raise NotImplementedError

    def embed_query(self, text: str) -> List[float]:
        raise NotImplementedError


def _normalize(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    return vec / norm if norm > 0 else vec


class LocalHashEmbedder(EmbeddingProvider):
    """Offline embedding via feature hashing of stems, stem bigrams and
    character n-grams. Not a neural model, but it gives useful fuzzy matching
    (plurals, word variants, partial overlaps) with zero dependencies."""

    min_similarity = 0.15

    def __init__(self, dimension: int = 768):
        self.dimension = dimension
        self.model_id = f"local-hash-v2:{dimension}"

    def _add(self, vec: np.ndarray, feature: str, weight: float) -> None:
        h = zlib.crc32(feature.encode())
        sign = 1.0 if (h >> 31) & 1 else -1.0
        vec[h % self.dimension] += sign * weight

    def _embed(self, text: str) -> List[float]:
        vec = np.zeros(self.dimension, dtype=np.float32)
        words = [w for w in raw_tokens(text) if w not in STOP_WORDS]
        stems = [stem(w) for w in words]
        for s, count in Counter(stems).items():
            self._add(vec, "w:" + s, 1.0 + math.log(count))
        for a, b in zip(stems, stems[1:]):
            self._add(vec, f"b:{a}_{b}", 0.5)
        for w in set(words):
            padded = f"#{w}#"
            for i in range(len(padded) - 3):
                self._add(vec, "c:" + padded[i : i + 4], 0.25)
        return _normalize(vec).tolist()

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed(text)


class GeminiEmbedder(EmbeddingProvider):
    _BATCH = 64
    min_similarity = 0.5

    def __init__(self, model: str, dimension: int):
        from app.services.gemini import get_client

        self._client = get_client()
        self._model = model
        self.dimension = dimension
        self.model_id = f"gemini:{model}:{dimension}"

    def _call(self, texts: Sequence[str], task_type: str) -> List[List[float]]:
        from google.genai import types

        cfg = types.EmbedContentConfig(task_type=task_type, output_dimensionality=self.dimension)
        out: List[List[float]] = []
        for i in range(0, len(texts), self._BATCH):
            batch = list(texts[i : i + self._BATCH])
            for attempt in range(3):
                try:
                    vectors = self._embed_batch(batch, cfg)
                    if len(vectors) != len(batch):
                        raise EmbeddingError(f"expected {len(batch)} embeddings, got {len(vectors)}")
                    # Truncated (reduced-dimension) Gemini vectors must be re-normalized.
                    out.extend(_normalize(np.asarray(v, dtype=np.float32)).tolist() for v in vectors)
                    break
                except Exception as exc:  # network / quota / API errors
                    # Queries are on the request path: fail fast and fall back to keywords.
                    if attempt == 2 or task_type == "RETRIEVAL_QUERY":
                        raise EmbeddingError(f"Gemini embedding failed: {exc}") from exc
                    time.sleep(1.5 * (attempt + 1))
        return out

    def _embed_batch(self, batch: List[str], cfg) -> List[list]:
        def run(c, contents):
            resp = c.models.embed_content(model=self._model, contents=contents, config=cfg)
            return [e.values for e in (resp.embeddings or [])]

        if self._client.mode == "vertex" and len(batch) > 1:
            # Vertex AI accepts one input per request for gemini-embedding-001.
            return [v for text in batch for v in self._client.call(lambda c: run(c, [text]))]
        vectors = self._client.call(lambda c: run(c, batch))
        if self._client.mode == "vertex" and len(batch) > 1 and len(vectors) != len(batch):
            return [v for text in batch for v in self._client.call(lambda c: run(c, [text]))]
        return vectors

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        return self._call(texts, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> List[float]:
        return self._call([text], "RETRIEVAL_QUERY")[0]


class EmbeddingRegistry:
    """Holds the active provider plus every provider we can use at query time."""

    def __init__(self) -> None:
        self.local = LocalHashEmbedder(settings.EMBEDDING_DIMENSION)
        self.gemini: Optional[GeminiEmbedder] = None
        if settings.gemini_enabled:
            try:
                self.gemini = GeminiEmbedder(settings.GEMINI_EMBEDDING_MODEL, settings.EMBEDDING_DIMENSION)
            except Exception as exc:  # pragma: no cover - import/config errors
                logger.error("Gemini embeddings unavailable, using local embeddings: %s", exc)

    @property
    def active(self) -> EmbeddingProvider:
        return self.gemini or self.local

    def by_model_id(self, model_id: str) -> Optional[EmbeddingProvider]:
        for p in (self.gemini, self.local):
            if p is not None and p.model_id == model_id:
                return p
        return None

    def embed_documents(self, texts: Sequence[str]) -> tuple[List[List[float]], str]:
        """Embed with the active provider, falling back to local on failure.

        Returns the vectors and the model id that produced them.
        """
        provider = self.active
        try:
            return provider.embed_documents(texts), provider.model_id
        except EmbeddingError as exc:
            if provider is self.local:
                raise
            logger.warning("%s — falling back to local embeddings for this document.", exc)
            return self.local.embed_documents(texts), self.local.model_id

    def embed_query(self, text: str, model_ids: Sequence[str]) -> Dict[str, np.ndarray]:
        """Embed the query once per model present in the candidate set."""
        out: Dict[str, np.ndarray] = {}
        for mid in set(model_ids):
            if self.by_model_id(mid) is None:
                continue  # e.g. Gemini chunks while no key is configured
            try:
                out[mid] = _cached_query_embedding(mid, text)
            except EmbeddingError as exc:
                logger.warning("Query embedding failed (%s); using keyword ranking only.", exc)
        return out


@lru_cache(maxsize=512)
def _cached_query_embedding(model_id: str, text: str) -> np.ndarray:
    # Failures raise and are therefore never cached.
    provider = embeddings.by_model_id(model_id)
    return np.asarray(provider.embed_query(text), dtype=np.float32)


embeddings = EmbeddingRegistry()
