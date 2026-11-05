import re
import math
from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from app.core.database import is_postgres
from app.models.entities import Document, DocumentChunk, User
from app.schemas.search import SearchHit, SearchResponse
from app.services.embeddings.embedder import embedding_service
from app.services.permissions.checker import PermissionChecker

STOP_WORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with",
    "by", "about", "as", "is", "was", "are", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "what", "which", "who", "whom",
    "this", "that", "these", "those", "am", "it", "its", "of", "from"
}

class HybridSearchEngine:
    def __init__(self, db: Session):
        self.db = db

    def search(
        self,
        query: str,
        user: User,
        mode: str = "hybrid",
        limit: int = 5,
        collection_id: Optional[str] = None
    ) -> List[SearchHit]:
        """
        Executes permission-filtered hybrid search combining vector similarity and keyword relevance.
        """
        # Step 1: Pre-retrieval authorization boundary
        accessible_doc_ids = PermissionChecker.get_accessible_document_ids(self.db, user)
        if not accessible_doc_ids:
            return []

        # Query accessible chunks with joined Document details
        chunk_query = self.db.query(DocumentChunk, Document).join(
            Document, DocumentChunk.document_id == Document.id
        ).filter(
            DocumentChunk.document_id.in_(accessible_doc_ids)
        )

        if collection_id:
            chunk_query = chunk_query.filter(Document.collection_id == collection_id)

        records = chunk_query.all()
        if not records:
            return []

        # Step 2: Vector Search
        vector_ranked: List[Dict[str, Any]] = []
        if mode in ["vector", "hybrid"]:
            query_embedding = np.array(embedding_service.embed_query(query), dtype=np.float32)
            q_norm = np.linalg.norm(query_embedding)
            if q_norm > 0:
                query_embedding /= q_norm

            scored_chunks = []
            for chunk, doc in records:
                if not chunk.embedding:
                    continue
                emb = chunk.embedding
                if isinstance(emb, str):
                    import json
                    try:
                        emb = json.loads(emb)
                    except Exception:
                        continue
                emb_vec = np.array(emb, dtype=np.float32)
                norm = np.linalg.norm(emb_vec)
                if norm > 0:
                    emb_vec /= norm
                sim = float(np.dot(query_embedding, emb_vec))
                scored_chunks.append({
                    "chunk": chunk,
                    "document": doc,
                    "similarity": sim
                })

            scored_chunks.sort(key=lambda x: x["similarity"], reverse=True)
            vector_ranked = scored_chunks

        # Step 3: Keyword Search
        keyword_ranked: List[Dict[str, Any]] = []
        if mode in ["keyword", "hybrid"]:
            # Tokenize query keywords
            query_tokens = [
                w.lower() for w in re.findall(r"\b\w+\b", query)
                if w.lower() not in STOP_WORDS and len(w) > 2
            ]

            scored_kw_chunks = []
            for chunk, doc in records:
                content_lower = chunk.content.lower()
                title_lower = (chunk.section_title or "").lower()
                doc_title_lower = doc.title.lower()

                kw_score = 0.0
                for token in query_tokens:
                    # Content matches
                    count = content_lower.count(token)
                    if count > 0:
                        kw_score += 1.0 + math.log(count + 1)
                    # Heading/Title boost
                    if token in title_lower:
                        kw_score += 2.0
                    if token in doc_title_lower:
                        kw_score += 1.5

                if kw_score > 0 or not query_tokens:
                    scored_kw_chunks.append({
                        "chunk": chunk,
                        "document": doc,
                        "keyword_score": kw_score
                    })

            scored_kw_chunks.sort(key=lambda x: x["keyword_score"], reverse=True)
            keyword_ranked = scored_kw_chunks

        # Step 4: Fusion & Selection
        k_rrf = 60.0
        chunk_map: Dict[str, Dict[str, Any]] = {}

        if mode == "vector":
            for rank, item in enumerate(vector_ranked[:limit]):
                c = item["chunk"]
                d = item["document"]
                chunk_map[c.id] = {
                    "chunk": c,
                    "document": d,
                    "sim": item["similarity"],
                    "kw": 0.0,
                    "rrf": item["similarity"]
                }
        elif mode == "keyword":
            for rank, item in enumerate(keyword_ranked[:limit]):
                c = item["chunk"]
                d = item["document"]
                chunk_map[c.id] = {
                    "chunk": c,
                    "document": d,
                    "sim": 0.0,
                    "kw": item["keyword_score"],
                    "rrf": item["keyword_score"]
                }
        else:  # Hybrid: Reciprocal Rank Fusion
            # Assign vector ranks
            for rank, item in enumerate(vector_ranked):
                cid = item["chunk"].id
                chunk_map[cid] = {
                    "chunk": item["chunk"],
                    "document": item["document"],
                    "sim": item["similarity"],
                    "kw": 0.0,
                    "rrf": 1.0 / (k_rrf + rank + 1)
                }

            # Assign keyword ranks
            for rank, item in enumerate(keyword_ranked):
                cid = item["chunk"].id
                rrf_contrib = 1.0 / (k_rrf + rank + 1)
                if cid in chunk_map:
                    chunk_map[cid]["kw"] = item["keyword_score"]
                    chunk_map[cid]["rrf"] += rrf_contrib
                else:
                    chunk_map[cid] = {
                        "chunk": item["chunk"],
                        "document": item["document"],
                        "sim": 0.0,
                        "kw": item["keyword_score"],
                        "rrf": rrf_contrib
                    }

        # Sort aggregated results
        sorted_items = sorted(chunk_map.values(), key=lambda x: x["rrf"], reverse=True)

        results: List[SearchHit] = []
        for entry in sorted_items[:limit]:
            c = entry["chunk"]
            d = entry["document"]
            results.append(
                SearchHit(
                    chunk_id=c.id,
                    document_id=d.id,
                    document_title=d.title,
                    page_number=c.page_number,
                    section_title=c.section_title,
                    content=c.content,
                    similarity_score=round(entry["sim"], 4),
                    keyword_score=round(entry["kw"], 4),
                    combined_rrf_score=round(entry["rrf"], 5),
                    access_level=d.access_level
                )
            )

        return results

