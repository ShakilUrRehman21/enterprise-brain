import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_member
from app.models.entities import Document, DocumentChunk, DocumentPermission, User
from app.schemas.document import DocumentResponse, DocumentChunkResponse, DocumentPermissionUpdate, DocumentPermissionResponse
from app.services.ingestion.pipeline import IngestionPipeline
from app.services.permissions.checker import PermissionChecker

router = APIRouter()

@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    collection_id: Optional[str] = Form(None),
    access_level: str = Form("organization"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    Upload and ingest an enterprise document (PDF, DOCX, TXT).
    Extracts text, splits into chunks, and generates vector embeddings.
    """
    pipeline = IngestionPipeline(db)
    doc = pipeline.process_upload(
        file=file,
        current_user=current_user,
        title=title,
        collection_id=collection_id,
        access_level=access_level
    )
    return doc

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    List all documents accessible to the current user according to access controls.
    """
    accessible_ids = PermissionChecker.get_accessible_document_ids(db, current_user)
    docs = db.query(Document).filter(Document.id.in_(accessible_ids)).order_by(Document.created_at.desc()).all()
    return docs

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if not PermissionChecker.can_access_document(db, current_user, doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this document."
        )
    return doc

@router.get("/{document_id}/preview")
def get_document_preview(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    Returns extracted text preview and all structured chunks for citation inspection.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if not PermissionChecker.can_access_document(db, current_user, doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to inspect this document's contents."
        )

    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index.asc()).all()

    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "access_level": doc.access_level,
        "preview_text": doc.extracted_text_preview,
        "total_chunks": len(chunks),
        "chunks": [
            {
                "id": c.id,
                "chunk_index": c.chunk_index,
                "page_number": c.page_number,
                "section_title": c.section_title,
                "token_count": c.token_count,
                "content": c.content
            }
            for c in chunks
        ]
    }

@router.post("/{document_id}/retry", response_model=DocumentResponse)
def retry_document_ingestion(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if not PermissionChecker.can_modify_document(db, current_user, doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to reprocess this document."
        )

    if not os.path.exists(doc.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original document file not found on disk."
        )

    pipeline = IngestionPipeline(db)
    pipeline.ingest_document(doc)
    return doc

@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if not PermissionChecker.can_modify_document(db, current_user, doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to delete this document."
        )

    # Delete physical file
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    return {"success": True, "message": f"Document '{doc.title}' deleted successfully."}

@router.get("/{document_id}/permissions", response_model=List[DocumentPermissionResponse])
def get_document_permissions(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if not PermissionChecker.can_modify_document(db, current_user, doc):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    return doc.permissions

@router.put("/{document_id}/permissions")
def update_document_permissions(
    document_id: str,
    payload: DocumentPermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if not PermissionChecker.can_modify_document(db, current_user, doc):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    if payload.access_level not in ["private", "shared", "organization"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid access level.")

    doc.access_level = payload.access_level

    # Update explicit permissions if shared
    if payload.access_level == "shared" and payload.user_ids is not None:
        db.query(DocumentPermission).filter(DocumentPermission.document_id == document_id).delete()
        for uid in payload.user_ids:
            perm = DocumentPermission(document_id=doc.id, user_id=uid, permission="view")
            db.add(perm)

    db.commit()
    db.refresh(doc)
    return {"success": True, "access_level": doc.access_level, "message": "Permissions updated successfully."}

