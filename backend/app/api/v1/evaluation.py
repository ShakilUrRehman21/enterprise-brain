from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_admin, require_member
from app.models.entities import User
from app.services.evaluation.eval_runner import EvaluationRunner

router = APIRouter()
_cached_report = None

@router.get("/dataset")
def get_evaluation_dataset(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    Returns the loaded benchmark evaluation questions and categories.
    """
    runner = EvaluationRunner(db)
    return runner.load_dataset_samples()

@router.post("/run")
def run_evaluation_benchmark(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Runs the full evaluation benchmark across all 32 questions and returns verified metrics.
    """
    global _cached_report
    runner = EvaluationRunner(db)
    report = runner.run_all(current_user)
    _cached_report = report
    return report

@router.get("/report")
def get_latest_evaluation_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    Returns the latest computed evaluation metrics.
    If not yet executed, runs and returns the benchmark report.
    """
    global _cached_report
    if not _cached_report:
        runner = EvaluationRunner(db)
        _cached_report = runner.run_all(current_user)
    return _cached_report

