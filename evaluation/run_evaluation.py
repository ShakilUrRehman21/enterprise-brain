#!/usr/bin/env python3
"""Run the answer-quality benchmark from the command line.

Uses a throwaway database and upload folder, so it never touches real data:

    python evaluation/run_evaluation.py            # offline engine
    GEMINI_API_KEY=... python evaluation/run_evaluation.py   # Gemini engine

The questions live in backend/evaluation/dataset.jsonl. Writes the full
report to evaluation/results.json.
"""
import json
import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
tmp = Path(tempfile.mkdtemp(prefix="eb-eval-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(tmp / 'eval.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(tmp / "uploads")
sys.path.insert(0, str(HERE.parent / "backend"))

from app.core.database import SessionLocal, init_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import Role, User  # noqa: E402
from app.services.evaluation import run_evaluation  # noqa: E402
from app.services.sample_data import load_sample_documents  # noqa: E402


def pct(v):
    return "n/a" if v is None else f"{v * 100:.1f}%"


def main() -> int:
    init_db()
    with SessionLocal() as db:
        admin = User(email="eval@example.com", full_name="Evaluation", password_hash=hash_password("unused-pass"), role=Role.ADMIN)
        db.add(admin)
        db.commit()
        load_sample_documents(db, admin)
        run = run_evaluation(db, admin)

    s = run.summary
    print(f"\nEngine: {run.engine}")
    print(f"Passed: {s['passed']}/{s['total']} ({pct(s['pass_rate'])})")
    for key, label in [
        ("recall_at_5", "Right document in top 5"),
        ("mrr", "Mean reciprocal rank"),
        ("fact_recall", "Key facts found"),
        ("citation_precision", "Citations on target"),
        ("citation_recall", "Relevant documents cited"),
        ("abstention_accuracy", "Correctly declined"),
        ("false_abstention_rate", "Wrongly declined"),
    ]:
        print(f"  {label:<26} {pct(s[key])}")
    print(f"  {'Restricted leaks':<26} {s['leaks']}")
    print("\nBy category:")
    for cat, c in s["categories"].items():
        print(f"  {cat:<24} {c['passed']}/{c['total']}")
    failures = [r for r in run.results if not r["passed"]]
    if failures:
        print("\nFailed:")
        for r in failures:
            print(f"  - [{r['category']}] {r['question']}")

    out = HERE / "results.json"
    out.write_text(json.dumps({"engine": run.engine, "summary": s, "results": run.results}, indent=2))
    print(f"\nFull report: {out}")
    return 0 if s["leaks"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
