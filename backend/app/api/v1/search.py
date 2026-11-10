from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_member
from app.models.entities import User
from app.schemas.search import SearchRequest, SearchResponse
from app.services.retrieval.searcher import HybridSearchEngine

router = APIRouter()

@router.post("", response_model=SearchResponse)
def execute_search(
    payload: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    Executes permission-aware hybrid search (vector similarity + keyword search with RRF).
    Only returns chunks from documents the user is authorized to view.
    """
    engine = HybridSearchEngine(db)
    hits = engine.search(
        query=payload.query,
        user=current_user,
        mode=payload.mode,
        limit=payload.limit,
        collection_id=payload.collection_id
    )

    return SearchResponse(
        query=payload.query,
        mode=payload.mode,
        total_hits=len(hits),
        results=hits
    )

