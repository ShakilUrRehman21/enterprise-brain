from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models import Role, User
from app.schemas import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


class DirectoryEntry(BaseModel):
    id: str
    full_name: str
    email: str


@router.get("/directory", response_model=List[DirectoryEntry])
def directory(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Active colleagues, for choosing who to share a document with."""
    users = db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name)).all()
    return [DirectoryEntry(id=u.id, full_name=u.full_name, email=u.email) for u in users]


@router.get("", response_model=List[UserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.created_at)).all()


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: str, body: UserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    demoting = body.role == Role.MEMBER and target.role == Role.ADMIN
    deactivating = body.is_active is False and target.is_active
    if target.id == admin.id and (demoting or deactivating):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't remove your own admin access.")
    if target.role == Role.ADMIN and (demoting or deactivating):
        admins = db.scalar(select(func.count(User.id)).where(User.role == Role.ADMIN, User.is_active.is_(True)))
        if admins <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The workspace needs at least one active admin.")
    if body.role is not None:
        target.role = body.role
    if body.is_active is not None:
        target.is_active = body.is_active
    db.commit()
    db.refresh(target)
    return target
