from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_member
from app.models.entities import User
from app.schemas.auth import UserResponse

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated user profile and permissions.
    """
    return current_user

@router.get("/users", response_model=List[UserResponse])
def list_organization_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    List all organization users for permission assignment.
    """
    users = db.query(User).all()
    return users

