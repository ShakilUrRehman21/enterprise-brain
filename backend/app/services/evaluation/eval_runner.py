import json
import os
import re
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import User, EvaluationDataset, EvaluationResult
from app.services.retrieval.searcher import HybridSearchEngine, STOP_WORDS
from app.services.generation.rag_service import RAGService, ABSTAIN_PHRASE

DATASET_FILE = os.path.join(os.path.dirname(__file__), "../../../../evaluation/dataset.jsonl")

class EvaluationRunner:
    def __init__(self, db: Session):
        self.db = db
        self.search_engine = HybridSearchEngine(db)
        self.rag_service = RAGService(db)

    def load_dataset_samples(self) -> List[Dict[str, Any]]:
        samples = []
        if os.path.exists(DATASET_FILE):
            with open(DATASET_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        samples.append(json.loads(line.strip()))
        return samples

    def run_all(self, test_user: User) -> Dict[str, Any]:
        samples = self.load_dataset_samples()
        if not samples:
            raise ValueError(f"Evaluation dataset file not found at {DATASET_FILE}")

        results = []
        category_stats: Dict[str, Dict[str, int]] = {}

        total_recall_5 = 0.0
        total_prec_5 = 0.0
        total_mrr = 0.0
        total_correctness = 0.0
        total_cit_prec = 0.0
        total_cit_rec = 0.0
        total_unsupported = 0.0
        abstention_correct = 0
        abstention_opportunities = 0

        # Create Member user for permission-restricted questions
        member_user = self.db.query(User).filter(User.role == "member").first()
        if not member_user:
            member_user = User(
                clerk_user_id="eval_member",
                email="eval_member@enterprise.com",
                full_name="Evaluation Member",
                role="member"
            )
            self.db.add(member_user)
            self.db.commit()
            self.db.refresh(member_user)

        for s in samples:
            q_id = s.get("id", "q")
            category = s.get("category", "General")
            question = s["question"]
            expected_answer = s["expected_answer"]
            relevant_docs = s.get("relevant_docs", [])
            should_abstain = s.get("should_abstain", False)
            target_role = s.get("target_user_role", "admin")

            active_user = member_user if target_role == "member" else test_user

            # 1. Retrieval
            retrieved_hits = self.search_engine.search(
                query=question,
                user=active_user,
                mode="hybrid",
                limit=5
            )

            # Metrics: Recall@5, Precision@5, MRR
            if should_abstain:
                hit_docs = [h.document_title for h in retrieved_hits]
                leaked = any(d.lower() in hd.lower() for hd in hit_docs for d in relevant_docs) if relevant_docs else False
                recall_5 = 1.0 if not leaked else 0.0
                prec_5 = 1.0 if not leaked else 0.0
                mrr = 1.0 if not leaked else 0.0
            else:
                hit_docs = [h.document_title for h in retrieved_hits]
                matched_docs = [d for d in relevant_docs if any(d.lower() in hd.lower() for hd in hit_docs)]
                recall_5 = len(matched_docs) / len(relevant_docs) if relevant_docs else 1.0

                prec_hits = sum(1 for hd in hit_docs if any(d.lower() in hd.lower() for d in relevant_docs))
                prec_5 = prec_hits / len(retrieved_hits) if retrieved_hits else 0.0

                mrr = 0.0
                for rank, hd in enumerate(hit_docs, start=1):
                    if any(d.lower() in hd.lower() for d in relevant_docs):
                        mrr = 1.0 / rank
                        break

            # 2. RAG Generation
            _, assistant_msg = self.rag_service.answer_query(
                query=question,
                user=active_user
            )

            generated_answer = assistant_msg.content
            abstained = assistant_msg.abstained or (ABSTAIN_PHRASE.lower() in generated_answer.lower())
            citations = assistant_msg.citations or []

            # 3. Answer Correctness & Abstention Accuracy
            if should_abstain:
                abstention_opportunities += 1
                is_correct = abstained
                if abstained:
                    abstention_correct += 1
                correctness_score = 1.0 if abstained else 0.0
                unsupported_rate = 0.0
                cit_precision = 1.0
                cit_recall = 1.0
            else:
                # Abstention evaluation on non-abstain queries
                if abstained:
                    correctness_score = 0.0
                    is_correct = False
                else:
                    # Semantic word overlap between generated answer and expected answer
                    exp_words = set(w.lower() for w in re.findall(r"\b\w+\b", expected_answer) if len(w) > 2 and w.lower() not in STOP_WORDS)
                    gen_words = set(w.lower() for w in re.findall(r"\b\w+\b", generated_answer) if len(w) > 2 and w.lower() not in STOP_WORDS)
                    overlap = exp_words.intersection(gen_words)
                    correctness_score = len(overlap) / len(exp_words) if exp_words else 1.0
                    is_correct = correctness_score >= 0.40

                # Citation metrics
                if citations:
                    valid_cits = 0
                    for c in citations:
                        c_title = c.get("document_title", "")
                        if any(d.lower() in c_title.lower() for d in relevant_docs):
                            valid_cits += 1
                    cit_precision = valid_cits / len(citations)
                    cited_doc_titles = [c.get("document_title", "").lower() for c in citations]
                    recalled_docs = sum(1 for d in relevant_docs if any(d.lower() in cdt for cdt in cited_doc_titles))
                    cit_recall = recalled_docs / len(relevant_docs) if relevant_docs else 1.0
                    unsupported_rate = 0.0
                else:
                    cit_precision = 0.0 if not abstained else 1.0
                    cit_recall = 0.0 if not abstained else 1.0
                    unsupported_rate = 1.0 if not abstained else 0.0

            total_recall_5 += recall_5
            total_prec_5 += prec_5
            total_mrr += mrr
            total_correctness += correctness_score
            total_cit_prec += cit_precision
            total_cit_rec += cit_recall
            total_unsupported += unsupported_rate

            # Category Breakdown
            if category not in category_stats:
                category_stats[category] = {"total": 0, "passed": 0}
            category_stats[category]["total"] += 1
            if is_correct:
                category_stats[category]["passed"] += 1

            results.append({
                "id": q_id,
                "category": category,
                "question": question,
                "expected": expected_answer,
                "generated": generated_answer,
                "passed": is_correct,
                "citations": citations,
                "recall_at_5": round(recall_5, 3),
                "mrr": round(mrr, 3),
                "correctness": round(correctness_score, 3)
            })

        n = len(samples)
        report = {
            "total_evaluated": n,
            "retrieval_recall_at_5": round(total_recall_5 / n, 4),
            "retrieval_precision_at_5": round(total_prec_5 / n, 4),
            "mrr": round(total_mrr / n, 4),
            "answer_correctness": round(total_correctness / n, 4),
            "citation_precision": round(total_cit_prec / n, 4),
            "citation_recall": round(total_cit_rec / n, 4),
            "unsupported_claim_rate": round(total_unsupported / n, 4),
            "abstention_accuracy": round(abstention_correct / abstention_opportunities, 4) if abstention_opportunities > 0 else 1.0,
            "category_breakdown": {
                cat: {
                    "total": st["total"],
                    "passed": st["passed"],
                    "accuracy": round(st["passed"] / st["total"], 3) if st["total"] > 0 else 0.0
                }
                for cat, st in category_stats.items()
            },
            "results": results
        }
        return report
