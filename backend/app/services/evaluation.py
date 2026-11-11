"""Benchmark runner for retrieval and grounded answering.

Each dataset item lists the documents that should be retrieved/cited, the key
facts a correct answer must contain, and whether the system should abstain.
Permission items run as a synthetic member account and additionally check
that no restricted document leaks into retrieval or citations.
"""
import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, List

from sqlalchemy.orm import Session

from app.core.config import PROJECT_DIR
from app.models import EvaluationRun, Role, User
from app.services.answering import AnswerService
from app.services.llm import llm

DATASET_PATH = PROJECT_DIR / "evaluation" / "dataset.jsonl"


def load_dataset(path: Path = DATASET_PATH) -> List[Dict]:
    if not path.exists():
        raise FileNotFoundError(f"Evaluation dataset not found at {path}")
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def _matches(title: str, names: List[str]) -> bool:
    t = title.lower()
    return any(n.lower() == t for n in names)


def run_evaluation(db: Session, admin: User, dataset: List[Dict] | None = None) -> EvaluationRun:
    dataset = dataset if dataset is not None else load_dataset()
    member = User(id="evaluation-member", email="member@evaluation.invalid", full_name="Evaluation member", role=Role.MEMBER)
    service = AnswerService(db)

    rows = []
    for item in dataset:
        user = member if item.get("as_role") == "member" else admin
        relevant = item.get("relevant_docs", [])
        restricted = item.get("restricted_docs", [])
        should_abstain = bool(item.get("should_abstain"))
        facts = item.get("must_include", [])

        result = service.answer(item["question"], user)
        retrieved_titles = list(dict.fromkeys(h.document_title for h in result.retrieved[:5]))
        cited_titles = list(dict.fromkeys(c["document_title"] for c in result.citations))

        leaked = any(_matches(t, restricted) for t in retrieved_titles + cited_titles)
        recall = (sum(1 for d in relevant if _matches_any(d, retrieved_titles)) / len(relevant)) if relevant else None
        mrr = None
        if relevant:
            mrr = next((1 / r for r, t in enumerate(retrieved_titles, 1) if _matches(t, relevant)), 0.0)

        fact_recall = None
        if facts and not result.abstained:
            text = result.text.lower()
            fact_recall = sum(1 for f in facts if f.lower() in text) / len(facts)
        elif facts:
            fact_recall = 0.0

        cit_precision = cit_recall = None
        if not should_abstain and not result.abstained and relevant:
            cit_precision = (sum(1 for t in cited_titles if _matches(t, relevant)) / len(cited_titles)) if cited_titles else 0.0
            cit_recall = sum(1 for d in relevant if _matches_any(d, cited_titles)) / len(relevant)

        if should_abstain:
            passed = result.abstained and not leaked
        else:
            passed = (not result.abstained) and (fact_recall is None or fact_recall == 1.0)

        rows.append(
            {
                "id": item.get("id"),
                "category": item.get("category", "General"),
                "question": item["question"],
                "as_role": "member" if user is member else "admin",
                "should_abstain": should_abstain,
                "abstained": result.abstained,
                "answer": result.text,
                "citations": [{"number": c["number"], "document_title": c["document_title"]} for c in result.citations],
                "retrieved": retrieved_titles,
                "recall_at_5": recall,
                "mrr": mrr,
                "fact_recall": fact_recall,
                "citation_precision": cit_precision,
                "citation_recall": cit_recall,
                "leaked": leaked,
                "passed": passed,
            }
        )

    summary = _summarise(rows)
    run = EvaluationRun(
        triggered_by=admin.id if db.get(User, admin.id) else None,
        engine="gemini" if llm is not None else "extractive",
        summary=summary,
        results=rows,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _matches_any(name: str, titles: List[str]) -> bool:
    return any(_matches(t, [name]) for t in titles)


def _mean(values) -> float | None:
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 4) if vals else None


def _summarise(rows: List[Dict]) -> Dict:
    answerable = [r for r in rows if not r["should_abstain"]]
    unanswerable = [r for r in rows if r["should_abstain"]]
    by_cat: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "passed": 0})
    for r in rows:
        by_cat[r["category"]]["total"] += 1
        by_cat[r["category"]]["passed"] += int(r["passed"])
    return {
        "total": len(rows),
        "passed": sum(r["passed"] for r in rows),
        "pass_rate": _mean(float(r["passed"]) for r in rows),
        "recall_at_5": _mean(r["recall_at_5"] for r in answerable),
        "mrr": _mean(r["mrr"] for r in answerable),
        "fact_recall": _mean(r["fact_recall"] for r in answerable),
        "citation_precision": _mean(r["citation_precision"] for r in answerable),
        "citation_recall": _mean(r["citation_recall"] for r in answerable),
        "abstention_accuracy": _mean(float(r["abstained"]) for r in unanswerable),
        "false_abstention_rate": _mean(float(r["abstained"]) for r in answerable),
        "leaks": sum(r["leaked"] for r in rows),
        "categories": dict(by_cat),
    }
