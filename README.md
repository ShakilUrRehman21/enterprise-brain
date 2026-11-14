# Enterprise Brain

Ask questions about your company's documents and get answers where every claim links to the exact passage it came from. Documents are permission-aware: people only get answers from documents they're allowed to see, and the assistant says so plainly when the documents don't cover a question.

- **Next.js 15 + React 19** frontend (Tailwind, self-hosted fonts)
- **FastAPI + SQLAlchemy 2** backend (SQLite by default, Postgres for production)
- **Google Gemini** for written answers and semantic search, optional. Without a key the app runs fully offline and quotes matching sentences directly.

## Quick start (local)

Requirements: Python 3.11+, Node 20+.

```bash
# Backend
cd backend
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload --port 8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The first account you create becomes the workspace admin. As admin, use **Add sample documents** to load six example policies (one of them private) and try it out. On Windows, `start.bat` or `start.ps1` launches both servers.

Configuration lives in `.env` (see `.env.example`). The important settings:

| Setting | Purpose |
|---|---|
| `SECRET_KEY` | Signs login tokens. Required in production. |
| `DATABASE_URL` | Defaults to SQLite in `backend/data/`. Use a `postgresql://` URL in production. |
| `GEMINI_API_KEY` | Enables written answers, multi-document synthesis and semantic search. Works with AI Studio and Vertex AI express keys. Check it with `python -m app.manage check-ai`. |
| `ALLOW_REGISTRATION` | `false` makes the workspace invite-only. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional admin account created on startup. |

## Docker

```bash
echo "SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" > .env
echo "GEMINI_API_KEY=..." >> .env   # optional
docker compose up --build
```

Frontend on :3000, API docs at http://localhost:8000/api/docs.

## Deploying

- **Backend on Render:** use a Docker web service with **Root Directory** `backend` (the Dockerfile builds from that folder and listens on Render's `$PORT`). Required environment variables: `SECRET_KEY` and `GEMINI_API_KEY`; add `DATABASE_URL` from a Render Postgres database so data survives redeploys. `render.yaml` sets all of this up as a Blueprint.
- **Frontend on Vercel:** set `BACKEND_API_URL` to the backend's URL (for example `https://your-api.onrender.com`). The frontend proxies `/api/*` to it, so no CORS setup is needed.

## How it works

1. **Ingestion.** Uploads are stored under a random name, then indexed in the background. Text is extracted from PDF, DOCX, TXT or Markdown, keeping headings and page numbers, split into overlapping sentence-aligned passages, and embedded.
2. **Retrieval.** Only passages from documents the user can see are loaded, filtered in SQL before any scoring. They're ranked by BM25 keyword relevance and vector similarity, fused with reciprocal rank fusion. Each vector is tagged with the model that made it, so vectors from different models are never compared.
3. **Relevance gate.** If no passage covers enough of the question's important terms (or, with Gemini, isn't semantically close enough), the assistant declines instead of guessing.
4. **Answering.** With Gemini, the model writes an answer from numbered sources. Citations are then validated against the retrieved passages, renumbered, and uncited answers are rejected. Without Gemini, the best-matching sentences are quoted verbatim. Either way, each citation carries the supporting quote, which the UI highlights in the source.

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Access rules

| Access | Who can see and ask about it |
|---|---|
| Everyone | All signed-in users |
| Specific people | The owner, the people it's shared with, and admins |
| Only me | The owner and admins |

Restricted documents return 404 (not 403) to people without access, so their existence isn't revealed.

## Tests and benchmark

```bash
cd backend && python -m pytest          # 50 tests, uses a temporary database
python evaluation/run_evaluation.py      # answer-quality benchmark, never touches real data
```

The benchmark (`backend/evaluation/dataset.jsonl`, 31 questions) checks that answers contain the required facts, cite the right documents, decline questions the documents don't cover, and never leak a restricted document to a member. Offline results: 29/31 passed, 0 leaks, 100% of unanswerable questions declined. The two failures are multi-document synthesis questions, which need Gemini. Admins can also run it from **Answer quality** in the app.

GitHub Actions (`.github/workflows/ci.yml`) runs the tests, the benchmark, the frontend build and both Docker builds on every push, so a broken build shows up before it reaches Render or Vercel.

## Admin commands

```bash
cd backend
python -m app.manage create-admin you@company.com "Your Name"
python -m app.manage load-samples you@company.com
python -m app.manage check-ai       # test the Gemini key
python -m app.manage reindex        # re-embed after adding/changing the Gemini key (also runs automatically on startup)
python -m app.manage reprocess      # re-extract all documents after upgrading
python -m app.manage reset-db --yes # deletes everything
```
