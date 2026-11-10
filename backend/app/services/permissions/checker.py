from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.entities import Document, DocumentPermission, User

class PermissionChecker:
    @staticmethod
    def can_access_document(db: Session, user: User, document: Document) -> bool:
        """
        Determines whether the given user has access to view/query this document.
        """
        # 1. Admin has global visibility
        if user.role == "admin":
            return True

        # 2. Document Owner has access
        if document.owner_id == user.id:
            return True

        # 3. Organization-wide documents are accessible to all authenticated members
        if document.access_level == "organization":
            return True

        # 4. Explicit user permission in shared documents
        if document.access_level == "shared":
            perm = db.query(DocumentPermission).filter(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id == user.id
            ).first()
            if perm:
                return True

        # 5. Private documents are only accessible to owner or admin
        return False

    @staticmethod
    def get_accessible_document_ids(db: Session, user: User) -> List[str]:
        """
        Returns list of document IDs the user is authorized to view.
        Directly injected into SQL WHERE clauses before vector or keyword retrieval.
        """
        if user.role == "admin":
            return [doc_id for (doc_id,) in db.query(Document.id).filter(Document.status == "indexed").all()]

        # Query documents owned by user, organization-wide, or shared with user
        accessible_docs = db.query(Document.id).outerjoin(
            DocumentPermission, Document.id == DocumentPermission.document_id
        ).filter(
            Document.status == "indexed",
            or_(
                Document.owner_id == user.id,
                Document.access_level == "organization",
                DocumentPermission.user_id == user.id
            )
        ).distinct().all()

        return [doc_id for (doc_id,) in accessible_docs]

    @staticmethod
    def can_modify_document(db: Session, user: User, document: Document) -> bool:
        """
        Only admin or owner can modify/delete document or change its permissions.
        """
        return user.role == "admin" or document.owner_id == user.id

