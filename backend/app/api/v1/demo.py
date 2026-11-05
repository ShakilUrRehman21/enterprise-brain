from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.entities import User
from app.services.ingestion.seed_data import seed_enterprise_documents, reset_and_seed_clean_documents

router = APIRouter()

@router.post("/seed")
def seed_demo_knowledge_base(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Seeds the foundational hackathon demonstration enterprise documents.
    """
    seeded = seed_enterprise_documents(db, current_user)
    return {
        "success": True,
        "message": f"Successfully seeded {seeded} enterprise demonstration documents into knowledge base.",
        "documents_created": seeded
    }

@router.post("/reset")
def reset_demo_knowledge_base(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Cleans up all temporary documents and chunks, reseeding the 6 pristine demonstration documents
    (5 Organization documents + 1 Private executive policy for access control validation).
    """
    seeded = reset_and_seed_clean_documents(db, current_user)
    return {
        "success": True,
        "message": f"Successfully reset and initialized {seeded} pristine enterprise demonstration documents.",
        "documents_created": seeded
    }


