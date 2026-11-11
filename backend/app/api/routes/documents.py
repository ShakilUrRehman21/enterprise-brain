from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import AccessLevel, DocStatus, Document, User
from app.schemas import AccessUpdate, ChunkOut, DocumentDetail, DocumentOut
from app.services.ingestion.pipeline import delete_document, process_document, set_shares, storage_path, store_upload
from app.services.permissions import can_manage, can_view, visible_documents_clause

router = APIRouter(prefix="/documents", tags=["documents"])

_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
}


def _out(doc: Document, user: User, cls=DocumentOut):
    manage = can_manage(user, doc)
    data = {c: getattr(doc, c) for c in DocumentOut.model_fields if hasattr(doc, c)}
    data.update(
        owner_name=doc.owner.full_name if doc.owner else None,
        can_manage=manage,
        shared_with=[s.user_id for s in doc.shares] if manage else [],
    )
    if cls is DocumentDetail:
        data["chunks"] = [ChunkOut.model_validate(c) for c in doc.chunks]
    return cls(**data)


def _get_visible(db: Session, user: User, document_id: str) -> Document:
    doc = db.get(Document, document_id)
    # 404 rather than 403, so restricted documents don't reveal they exist.
    if not doc or not can_view(user, doc):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    return doc


def _get_managed(db: Session, user: User, document_id: str) -> Document:
    doc = _get_visible(db, user, document_id)
    if not can_manage(user, doc):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner or an admin can change this document.")
    return doc


@router.get("", response_model=List[DocumentOut])
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.scalars(
        select(Document)
        .where(visible_documents_clause(user))
        .options(selectinload(Document.owner), selectinload(Document.shares))
        .order_by(Document.created_at.desc())
    ).all()
    return [_out(d, user) for d in docs]


@router.post("", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    access_level: str = Form(AccessLevel.ORGANIZATION),
    user_ids: List[str] = Form(default=[]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a PDF, DOCX, TXT or Markdown file. Indexing runs in the background;
    poll the document until its status is `indexed` or `failed`."""
    doc = store_upload(
        db,
        owner=user,
        filename=file.filename or "",
        stream=file.file,
        title=title,
        access_level=access_level,
        share_with=user_ids,
    )
    background.add_task(process_document, doc.id)
    return _out(doc, user)


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _out(_get_visible(db, user, document_id), user, DocumentDetail)


@router.get("/{document_id}/file")
def download_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = _get_visible(db, user, document_id)
    path = storage_path(doc)
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The original file is no longer stored.")
    return FileResponse(path, media_type=_MEDIA_TYPES.get(doc.file_type), filename=doc.filename)


@router.put("/{document_id}/access", response_model=DocumentOut)
def update_access(
    document_id: str, body: AccessUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    doc = _get_managed(db, user, document_id)
    doc.access_level = body.access_level
    # Shares only exist for "shared" documents; clearing them on any other level
    # prevents stale grants from re-appearing later.
    set_shares(db, doc, body.user_ids if body.access_level == AccessLevel.SHARED else [])
    db.commit()
    db.refresh(doc)
    return _out(doc, user)


@router.post("/{document_id}/reprocess", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
def reprocess_document(
    document_id: str, background: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    doc = _get_managed(db, user, document_id)
    if doc.status == DocStatus.PROCESSING:
        raise HTTPException(status.HTTP_409_CONFLICT, "This document is already being processed.")
    doc.status, doc.error_message = DocStatus.PROCESSING, None
    db.commit()
    background.add_task(process_document, doc.id)
    return _out(doc, user)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    delete_document(db, _get_managed(db, user, document_id))
