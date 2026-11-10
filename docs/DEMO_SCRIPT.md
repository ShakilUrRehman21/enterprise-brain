# Enterprise Brain — Hackathon Demonstration Script
## Step-by-Step Judging Walkthrough for Challenge 02

This script guides judges and evaluators through the 5 core demonstration scenarios proving technical excellence, answer grounding, access control, and evaluation rigor.

---

### Prerequisites
1. Backend running:
   ```bash
   cd backend
   uvicorn app.main:app --port 8000
   ```
2. Frontend running:
   ```bash
   cd frontend
   npm run dev
   ```
3. Open browser at `http://localhost:3000`.

---

### Step 0: Ensure Demonstration Knowledge Base Is Seeded
1. In the top right corner of the **Dashboard**, click the **"Seed 5 Demo Docs"** button (or navigate to Documents).
2. The system seeds and indexes:
   - `Employee HR Policy`
   - `Engineering Architecture Guide`
   - `Security and Compliance Policy`
   - `Employee Travel Policy`
   - `Product Roadmap`
3. Notice all 5 documents immediately display status `INDEXED`.

---

### Demo 1: Direct Factual Knowledge Retrieval & Citation Inspection
*Objective: Prove answers are grounded and backed by verifiable citations.*

1. Navigate to **Knowledge Chat** in the left sidebar.
2. In the message box, ask:
   > *"What is the company's reimbursement deadline?"*
3. **Observe the Answer:**
   - The assistant answers: *"Employees must submit expense reports within 30 days of incurring business expenses. [1]"*
   - Notice the blue inline citation pill `[1]`.
4. **Click Citation `[1]`:**
   - The **Source Passage Evidence** slide-over panel opens on the right.
   - Shows Document Title: `Employee Travel Policy`, Page 1, Section: `Reimbursement Deadlines`.
   - Displays the exact extracted passage: *"Employees must submit expense reports within 30 days..."*.
   - Confirms server-side citation validation.

---

### Demo 2: Multi-Document Reasoning & Synthesis
*Objective: Synthesize facts across distinct organizational policies.*

1. In Knowledge Chat, ask:
   > *"Compare the security requirements in the architecture guide and compliance policy."*
2. **Observe the Answer:**
   - The assistant synthesizes both sources:
     - Architecture Guide: Mutual TLS (mTLS) for microservices and Kubernetes zero-trust policies.
     - Security Policy: AES-256 encryption at rest, 16-character passwords, MFA, and annual SOC2 Type II vendor audits.
   - Distinct citation pills `[1]` and `[2]` link directly to the respective source chunks.

---

### Demo 3: Missing Evidence & Automated Abstention
*Objective: Prove the AI never hallucinates when facts are absent.*

1. In Knowledge Chat, ask:
   > *"What is the company's annual revenue in fiscal year 2023?"*
2. **Observe the Response:**
   - The assistant responds with the exact phrase:
     > *"I couldn't find sufficient evidence in the accessible documents to answer this question confidently."*
   - Displays the amber **ABSTAINED (INSUFFICIENT EVIDENCE)** badge.
   - Citations list is empty `[]`.
   - Zero hallucinated revenue figures.

---

### Demo 4: Access Control & Row-Level Authorization Isolation
*Objective: Prove User B cannot retrieve or see private documents owned by User A.*

1. Navigate to **Documents** while logged in as **Sarah Chen (Admin)**.
2. Notice the private document `HR Confidential Leave Policy` exists with policy `private`.
3. In the bottom-left identity switcher, click **"Member"** to switch active identity to **Bob Martinez (Engineer / Member)**.
4. **Observe User B Permissions:**
   - Notice `HR Confidential Leave Policy` disappears from the document list.
   - Navigate to **Hybrid Search** and search: *"annual vacation leave parental"*.
   - Zero HR chunks are returned.
5. In Knowledge Chat as User B, ask:
   > *"What is the confidential HR leave policy?"*
6. **Observe User B Chat Response:**
   - Assistant abstains: *"I couldn't find sufficient evidence in the accessible documents to answer this question confidently."*
   - No HR leave facts, no 25 vacation days, no 16 parental weeks appear anywhere in context or citations.
7. Switch back to **"Admin"** in the sidebar:
   - Ask the same question: the assistant immediately answers with full verified citations!

---

### Demo 5: Real Evaluation Benchmark Suite
*Objective: Show quantitative evidence of accuracy, MRR, and citation precision.*

1. Navigate to **Evaluation Suite** in the left sidebar.
2. Click **"Run Benchmark Suite"** (or inspect pre-run results).
3. The runner processes 32 ground-truth enterprise evaluation questions across 6 categories.
4. **Verify Metric Cards:**
   - **Retrieval Recall@5:** ~85.9%
   - **Mean Reciprocal Rank (MRR):** 0.901
   - **Citation Precision:** 100.0%
   - **Abstention Accuracy:** 100.0%
   - **Unsupported Claim Rate:** 0.0%
5. Expand individual questions in the table to review ground-truth expected answers against model outputs.

