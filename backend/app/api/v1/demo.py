from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.entities import User
from app.services.ingestion.seed_data import seed_enterprise_documents

router = APIRouter()

@router.post("/seed")
def seed_demo_knowledge_base(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Seeds the 5 foundational hackathon demonstration enterprise documents:
    1. Employee HR Policy
    2. Engineering Architecture Guide
    3. Security and Compliance Policy
    4. Employee Travel Policy
    5. Product Roadmap
    """
    seeded = seed_enterprise_documents(db, current_user)
    return {
        "success": True,
        "message": f"Successfully seeded {seeded} enterprise demonstration documents into knowledge base.",
        "documents_created": seeded
    }
