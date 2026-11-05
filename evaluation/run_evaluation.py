#!/usr/bin/env python3
"""
Enterprise Brain — Reproducible Evaluation Runner
Executes benchmark across 32 questions and outputs verified metrics:
- Retrieval Recall@5
- Retrieval Precision@5
- MRR
- Answer Correctness
- Citation Precision & Recall
- Unsupported Claim Rate
- Abstention Accuracy
"""

import sys
import os
import json

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.database import SessionLocal, init_db
from app.models.entities import User
from app.services.ingestion.seed_data import seed_enterprise_documents
from app.services.evaluation.eval_runner import EvaluationRunner

def main():
    print("=" * 70)
    print("  ENTERPRISE BRAIN — AUTOMATED ACCURACY & CITATION BENCHMARK")
    print("=" * 70)

    init_db()
    db = SessionLocal()

    try:
        # 1. Ensure Admin User
        admin = db.query(User).filter(User.role == "admin").first()
        if not admin:
            admin = User(
                clerk_user_id="eval_admin",
                email="admin@enterprise.local",
                full_name="Evaluation Administrator",
                role="admin"
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

        # 2. Seed Demonstration Documents
        print("\n[1/3] Ensuring knowledge base documents are seeded and indexed...")
        seeded = seed_enterprise_documents(db, admin)
        print(f"      Knowledge base ready ({seeded} new documents indexed).")

        # 3. Run Benchmark
        print("\n[2/3] Executing 32-question evaluation suite across 6 categories...")
        runner = EvaluationRunner(db)
        report = runner.run_all(admin)

        # 4. Display Results
        print("\n[3/3] BENCHMARK RESULTS SUMMARY:")
        print("-" * 70)
        print(f"  Total Questions Evaluated  : {report['total_evaluated']}")
        print(f"  Retrieval Recall@5         : {report['retrieval_recall_at_5'] * 100:.1f}%")
        print(f"  Retrieval Precision@5      : {report['retrieval_precision_at_5'] * 100:.1f}%")
        print(f"  Mean Reciprocal Rank (MRR) : {report['mrr']:.3f}")
        print(f"  Answer Correctness         : {report['answer_correctness'] * 100:.1f}%")
        print(f"  Citation Precision         : {report['citation_precision'] * 100:.1f}%")
        print(f"  Citation Recall            : {report['citation_recall'] * 100:.1f}%")
        print(f"  Unsupported Claim Rate     : {report['unsupported_claim_rate'] * 100:.1f}%")
        print(f"  Abstention Accuracy        : {report['abstention_accuracy'] * 100:.1f}%")
        print("-" * 70)

        print("\nCATEGORY-LEVEL BREAKDOWN:")
        for cat, stats in report["category_breakdown"].items():
            print(f"  * {cat.ljust(24)}: {stats['passed']}/{stats['total']} passed ({stats['accuracy'] * 100:.1f}%)")

        # Save results to evaluation/results.json
        results_file = os.path.join(os.path.dirname(__file__), "results.json")
        with open(results_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"\nSaved full benchmark report to: {results_file}")
        print("=" * 70)

    finally:
        db.close()

if __name__ == "__main__":
    main()
