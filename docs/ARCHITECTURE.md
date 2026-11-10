# Enterprise Brain — System Architecture & Engineering Specifications

## 1. System Overview

Enterprise Brain is a permission-enforced, evidence-grounded AI knowledge platform designed to transform disparate enterprise documents into an intelligent, auditable knowledge assistant.

```
                              ┌───────────────────────────────────────────────┐
                              │            Next.js 15 Frontend                │
                              │  (Dashboard, Chat, Search, Docs, Eval, RBAC)  │
                              └──────────────────────┬────────────────────────┘
                                                     │ Authenticated REST API
                                                     │ (X-User-Email / Clerk JWT)
                                                     ▼
                              ┌───────────────────────────────────────────────┐
                              │            FastAPI Backend Engine             │
                              │   - Security & Row-Level Authorization        │
                              │   - Hybrid Reciprocal Rank Fusion (RRF)       │
                              │   - Gemini Model & Embedding Connectors       │
                              └──────────┬────────────────────────────┬───────┘
                                         │                            │
             Document Ingestion Pipeline │                            │ RAG & Search Pipeline
                                         ▼                            ▼
                      ┌────────────────────────────┐      ┌────────────────────────────┐
                      │ Extractors: PDF, DOCX, TXT │      │ Pre-Retrieval SQL Filter   │
                      │ Structure-Aware Chunker    │      │ Vector Cosine Similarity   │
                      │ Batch Embedding Generator  │      │ Keyword FTS Scoring        │
                      └──────────────┬─────────────┘      │ Reciprocal Rank Fusion     │
                                     │                    └─────────────┬──────────────┘
                                     ▼                                  │
                      ┌─────────────────────────────────────────┐       ▼
                      │ PostgreSQL 16 + pgvector Storage Engine │ ◄─────┘
                      │ (Users, Documents, Chunks, Transcripts) │
                      └─────────────────────────────────────────┘
```

---

## 2. Ingestion Pipeline & Chunking

1. **Extraction (`extractor.py`):**
   - **PDF:** Extracted via `pypdf`, preserving sequential page indices and uppercase section headers.
   - **DOCX:** Extracted via `python-docx`, capturing XML heading hierarchies (`Heading 1`, `Heading 2`) and estimated page bounds.
   - **TXT / Markdown:** Extracted preserving markdown headers (`#`, `##`) and structural dividers.
2. **Chunking (`chunker.py`):**
   - Target token window: **700 tokens** (~2,800 characters) with a **120 token overlap** (~480 characters).
   - Metadata enriched: `chunk_index`, `page_number`, `section_title`, `token_count`, and parent `document_id`.
3. **Embedding (`embedder.py`):**
   - Google Gemini API `text-embedding-004` producing 768-dimensional normalized dense vectors.
   - Deterministic 768-dim hash vector fallback ensuring self-contained offline operation.

---

## 3. Hybrid Retrieval & Reciprocal Rank Fusion (RRF)

Retrieval computes two independent relevance rankings over the authorized candidate space:
1. **Vector Rank ($R_{\text{vector}}$):** Dot product / cosine distance between query embedding and chunk vectors.
2. **Keyword Rank ($R_{\text{keyword}}$):** Term frequency with heading and title boosting ($1.0 + \ln(\text{count} + 1)$ with $+2.0$ for section heading matches).
3. **Fusion Formulation:**
   $$\text{RRF}(d) = \frac{1}{60 + \text{rank}_{\text{vector}}(d)} + \frac{1}{60 + \text{rank}_{\text{keyword}}(d)}$$

---

## 4. Multi-Tenant Access Control & Security Model

Access control is strictly evaluated **pre-retrieval** in SQL before scoring or LLM prompting:
```sql
SELECT c.id, c.content, c.embedding, d.id, d.title, d.access_level
FROM document_chunks c
JOIN documents d ON c.document_id = d.id
LEFT JOIN document_permissions p ON d.id = p.document_id
WHERE d.status = 'indexed'
  AND (
    d.access_level = 'organization'
    OR d.owner_id = :user_id
    OR (d.access_level = 'shared' AND p.user_id = :user_id)
    OR :is_admin = TRUE
  );
```
- Unauthorized chunks are never exposed in retrieval, eliminating potential prompt injection or metadata leaking.

---

## 5. Grounded Generation & Citation Verification

- **Prompt Injection Defense:** Document chunks are wrapped in isolated `<document_chunk id="...">...</document_chunk>` XML tags and declared strictly passive evidence.
- **Citation Syntax:** Inline bracketed markers `[#]` cross-referenced against the chunk index.
- **Verification Engine:** Citations are verified server-side against actual retrieved chunks; non-existent references are pruned.
- **Abstention Guarantee:** When sufficient topical evidence is absent, the system returns:
  > *"I couldn't find sufficient evidence in the accessible documents to answer this question confidently."*

