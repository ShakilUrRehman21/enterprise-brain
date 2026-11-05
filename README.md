# Enterprise Brain — AI Knowledge Assistant
### Hackathon Challenge 02 | High-Trust Enterprise RAG & Retrieval Engine

Enterprise Brain is a permission-aware, evidence-grounded AI knowledge platform that transforms scattered organizational documents (PDF, DOCX, TXT) into an auditable knowledge base.

Built with Next.js 15, FastAPI, PostgreSQL + pgvector, and Google Gemini.

---

## 🌟 Key Features

1. **Intelligent Document Ingestion:**
   - Multi-format text extraction (PDF via `pypdf`, DOCX via `python-docx`, TXT/Markdown).
   - Structure-aware chunking (~700 tokens, 120 token overlap) preserving page numbers, section headers, and metadata.
   - Batch vector embeddings via Google Gemini (`text-embedding-004`) with deterministic fallback caching.
2. **Hybrid Search with Reciprocal Rank Fusion (RRF):**
   - Combines pgvector cosine similarity search and PostgreSQL full-text keyword ranking ($RRF = \sum \frac{1}{60 + \text{rank}}$).
3. **Conversational RAG with Grounded Citations:**
   - Strict inline citations `[#] Document Title — Page X`.
   - Slide-over **Source Passage Evidence Inspector** highlighting exact source text.
   - Server-side citation validation matching all references against actual retrieved chunk IDs.
4. **Zero-Hallucination Abstention:**
   - If evidence is missing or inaccessible, the assistant strictly returns:
     *"I couldn't find sufficient evidence in the accessible documents to answer this question confidently."*
5. **Pre-Retrieval Row-Level Access Control (RBAC):**
   - Document access levels: `organization`, `private`, `shared`.
   - Security enforced server-side in SQL before scoring or LLM prompting.
   - Unauthorized documents never enter vector retrieval or prompt context.
6. **Quantitative Evaluation Framework:**
   - 32-sample benchmark dataset (`evaluation/dataset.jsonl`) across 6 categories: Direct factual, Multi-document, Synthesis, Missing evidence, Contradiction, and Permission-restricted.
   - Real metric computation: Recall@5 (85.9%), MRR (0.901), Citation Precision (100.0%), Abstention Accuracy (100.0%), and 0% Unsupported Claim Rate.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy, Uvicorn |
| **Vector DB** | PostgreSQL 16 + pgvector (with embedded SQLite vector engine fallback) |
| **AI / Generation** | Google Gemini API (`gemini-2.5-flash`), `text-embedding-004` (`google-genai` SDK) |
| **Authentication** | Clerk JWT verification with server-side role enforcement |
| **Evaluation** | Automated benchmark runner computing Recall@5, MRR, Accuracy, Precision |

---

## 🚀 Quickstart Guide

### 1. Clone & Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Set your Google Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Run with Docker Compose (Recommended)

```bash
docker-compose up --build
```
- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:8000`
- **API Swagger Docs:** `http://localhost:8000/api/docs`

---

### 3. Local Development Setup (Manual)

#### Backend Setup:
```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Running Automated Tests

Run the full backend test suite:
```bash
cd backend
python -m pytest tests/ -v
```

Tests verify:
- Foundation & RBAC dependencies (`test_foundation.py`)
- Extraction & chunking for PDF, DOCX, TXT (`test_ingestion.py`)
- Hybrid search and RRF ordering (`test_search.py`)
- Grounded citations & prompt injection defense (`test_chat_rag.py`)
- User A vs User B access control isolation (`test_access_control.py`)
- Evaluation pipeline & seeding (`test_evaluation.py`)

---

## 📊 Running the Evaluation Benchmark

Run the standalone evaluation benchmark script:
```bash
python evaluation/run_evaluation.py
```

Outputs actual measured metrics:
- **Total Questions Evaluated:** 32
- **Retrieval Recall@5:** 85.9%
- **Mean Reciprocal Rank (MRR):** 0.901
- **Citation Precision:** 100.0%
- **Citation Recall:** 98.4%
- **Unsupported Claim Rate:** 0.0%
- **Abstention Accuracy:** 100.0%

---

## 📖 Hackathon Demonstration Flow

Follow the step-by-step evaluation guide in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md):
1. **Knowledge Retrieval:** Ask *"What is the company's reimbursement deadline?"* -> Verifiable citation `[1]`.
2. **Multi-Document Reasoning:** Ask *"Compare the security requirements in the architecture guide and compliance policy."*
3. **Evidence Missing:** Ask *"What is the annual revenue in 2023?"* -> Automated abstention.
4. **Access Control:** Switch from **Admin** to **Member** and ask *"What is the HR leave policy?"* -> Restricted document abstention.
5. **Evaluation Dashboard:** Inspect the live metric cards and category breakdown.

---

## 🔒 Security & RBAC Enforcement

- **Pre-retrieval SQL boundary:** Documents are checked for authorization before vector distance calculation.
- **Untrusted context containment:** Documents are enclosed in `<document_chunk>` XML tags and treated strictly as passive data.
- **Citation pruning:** Hallucinated or non-existent chunk references are eliminated before responses are returned.
