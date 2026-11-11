# Architecture

```
Browser ── Next.js (app shell, /api proxy) ── FastAPI ── SQLite / Postgres
                                                  │
                                                  └── Gemini (optional): answers + embeddings
```

## Backend layout

```
backend/app/
  main.py                 app factory, startup bootstrap, error handlers
  manage.py               admin CLI
  core/config.py          settings (env / .env), path resolution
  core/database.py        engine, sessions, legacy-schema guard
  core/security.py        scrypt password hashing, JWT access tokens
  api/deps.py             current user, admin guard
  api/routes/             auth, users, documents, chat (+ search), system (+ evaluation)
  models.py               SQLAlchemy models
  schemas/                Pydantic request/response models
  services/
    text.py               tokenizer, stemmer, sentence splitter
    embeddings.py         Gemini + local embedding providers, model-tagged vectors
    retrieval.py          permission-filtered hybrid search (BM25 + vectors, RRF)
    answering.py          relevance gate, Gemini / extractive answers, citation validation
    permissions.py        the single source of truth for document access
    ingestion/            extract → chunk → embed pipeline
    evaluation.py         benchmark runner
    sample_data.py        sample policy documents
```

## Authentication

Email and password accounts with scrypt hashing and HS256 JWT bearer tokens (12-hour expiry by default). The first account becomes admin. Admins can promote, demote and deactivate people; the API refuses to remove the last active admin. Deactivated users' tokens stop working immediately because every request reloads the user.

## Ingestion

`POST /api/documents` validates the type and size while streaming to disk (under a random file name, so user file names never touch the file system), rejects duplicates per owner by SHA-256, and returns `202`. Indexing runs as a background task in its own DB session. Failures are recorded on the document with a readable message, never raised into the request. Documents left `processing` by a crash are marked failed on the next startup so they can be reprocessed.

Chunking is sentence-aligned (350 words with 60 words of overlap by default) and never crosses a heading. Run-on text without punctuation is hard-wrapped.

## Retrieval

1. SQL selects passage ids from `indexed` documents matching `visible_documents_clause(user)`.
2. Parsed passages (term counts, vectors) come from an in-process cache keyed by `(chunk id, embedding model)`.
3. **BM25** over stemmed terms; document titles and section headings count as terms.
4. **Vectors**: the query is embedded once per embedding model present among the candidates and compared only with vectors from that same model. Matches below the provider's noise floor are ignored.
5. **Reciprocal rank fusion** (k = 60) combines both rankings.

## Answering

- **Follow-ups** are rewritten into standalone questions (by Gemini, or by prefixing the previous question offline).
- **Relevance gate:** a passage qualifies if it covers ≥ 60% of the question's IDF-weighted terms, or, with Gemini embeddings, has cosine similarity ≥ 0.62. For "compare A and B" questions, two passages from different documents may qualify together. If nothing qualifies, the assistant declines.
- **Gemini path:** qualifying passages plus related context go to the model as numbered sources inside `<source>` tags, with instructions to treat them as untrusted data. The reply is post-processed: grouped citations are normalised, citations to non-existent sources are removed, the rest are renumbered in order of appearance, and an answer with no valid citation is treated as unsupported and declined. If Gemini errors, the extractive engine answers instead.
- **Extractive path:** sentences from the top passages are scored by query-term coverage and the best are quoted verbatim, grouped per source. "Summarize X" questions return the opening of each section of the best-matching document.

Every citation stores the full passage plus the exact supporting quote, so past answers stay verifiable even if a document is later deleted.

## Data model

`users`, `documents`, `document_shares`, `document_chunks` (with `embedding` JSON and `embedding_model`), `conversations`, `messages` (with citations JSON), `evaluation_runs`.

## Scaling notes

Scoring happens in Python over the user's visible passages, which comfortably handles tens of thousands of passages. Beyond that, move vector search into pgvector (an HNSW index on `embedding`, filtered by the same visibility clause) and keyword search into Postgres full-text search. The service boundaries (`Retriever.search`) are already in place for that swap.
