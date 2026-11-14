from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import __version__
from app.api.deps import get_current_user, require_admin
from app.core.config import settings
from app.core.database import get_db
from app.models import DocStatus, Document, DocumentChunk, EvaluationRun, User
from app.schemas import EvaluationRunOut, SystemStatus
from app.services.embeddings import embeddings
from app.services.evaluation import load_dataset, run_evaluation
from app.services.ingestion.pipeline import reindex_stale_embeddings
from app.services.llm import llm
from app.services.retrieval import chunk_cache
from app.services.sample_data import SAMPLE_DOCUMENTS, load_sample_documents

router = APIRouter(tags=["system"])


class PublicInfo(BaseModel):
    name: str
    version: str
    registration_open: bool
    needs_first_admin: bool


@router.get("/system/info", response_model=PublicInfo)
def public_info(db: Session = Depends(get_db)):
    """Unauthenticated: what the sign-in page needs to know."""
    users = db.scalar(select(func.count(User.id))) or 0
    return PublicInfo(
        name=settings.PROJECT_NAME,
        version=__version__,
        registration_open=settings.ALLOW_REGISTRATION or users == 0,
        needs_first_admin=users == 0,
    )


@router.get("/system/status", response_model=SystemStatus)
def system_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    active = embeddings.active.model_id
    stale = db.scalar(
        select(func.count(DocumentChunk.id)).where(
            (DocumentChunk.embedding_model != active) | DocumentChunk.embedding_model.is_(None)
        )
    )
    return SystemStatus(
        version=__version__,
        ai_engine="gemini" if llm is not None else "local",
        generation_model=llm.model if llm is not None else None,
        embedding_model=active,
        database=db.get_bind().dialect.name,
        registration_open=settings.ALLOW_REGISTRATION,
        documents_indexed=db.scalar(select(func.count(Document.id)).where(Document.status == DocStatus.INDEXED)) or 0,
        stale_chunks=stale or 0,
        last_ai_error=getattr(llm, "last_error", None) if user.is_admin else None,
    )


class SampleResult(BaseModel):
    added: list[str]


@router.post("/system/sample-documents", response_model=SampleResult)
def add_sample_documents(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return SampleResult(added=load_sample_documents(db, admin))


class ReindexResult(BaseModel):
    chunks_updated: int


@router.post("/system/reindex", response_model=ReindexResult)
def reindex(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Re-embed chunks made with a different embedding model than the active one."""
    updated = reindex_stale_embeddings(db)
    chunk_cache.clear()
    return ReindexResult(chunks_updated=updated)


# ------------------------------------------------------------------ evaluation
@router.get("/evaluation/latest", response_model=EvaluationRunOut | None)
def latest_evaluation(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalar(select(EvaluationRun).order_by(EvaluationRun.created_at.desc()).limit(1))


@router.post("/evaluation/run", response_model=EvaluationRunOut)
def start_evaluation(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    sample_titles = {d["title"] for d in SAMPLE_DOCUMENTS}
    loaded = set(
        db.scalars(
            select(Document.title).where(Document.is_sample.is_(True), Document.status == DocStatus.INDEXED)
        ).all()
    )
    if not sample_titles <= loaded:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The benchmark runs against the sample documents. Add them from the Documents page first.",
        )
    try:
        dataset = load_dataset()
    except FileNotFoundError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc)) from exc
    return run_evaluation(db, admin, dataset)
