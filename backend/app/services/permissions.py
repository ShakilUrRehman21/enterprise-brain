"""Document access rules — the single source of truth.

  * admins see every document
  * owners see their own documents
  * "organization" documents are visible to every signed-in user
  * "shared" documents are visible to the users they're explicitly shared with
  * "private" documents are visible only to the owner (and admins)

`visible_documents_clause` is applied inside SQL before any scoring happens,
so restricted text never reaches ranking, prompts or responses.
"""
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.models import AccessLevel, Document, DocumentShare, User


def visible_documents_clause(user: User) -> ColumnElement[bool]:
    if user.is_admin:
        return Document.id.isnot(None)
    shared_with_user = exists(
        select(DocumentShare.id).where(DocumentShare.document_id == Document.id, DocumentShare.user_id == user.id)
    )
    return or_(
        Document.owner_id == user.id,
        Document.access_level == AccessLevel.ORGANIZATION,
        and_(Document.access_level == AccessLevel.SHARED, shared_with_user),
    )


def can_view(user: User, doc: Document) -> bool:
    if user.is_admin or doc.owner_id == user.id or doc.access_level == AccessLevel.ORGANIZATION:
        return True
    if doc.access_level == AccessLevel.SHARED:
        return any(s.user_id == user.id for s in doc.shares)
    return False


def can_manage(user: User, doc: Document) -> bool:
    return user.is_admin or doc.owner_id == user.id
