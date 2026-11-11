"""Document ingestion: store the upload, then extract → chunk → embed → index."""
import hashlib
import logging
import os
import re
import uuid
from pathlib import Path
from typing import BinaryIO, Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import AccessLevel, DocStatus, Document, DocumentChunk, DocumentShare, User
from app.services.embeddings import embeddings
from app.services.ingestion.chunker import chunk_sections
from app.services.ingestion.extractor import SUPPORTED_TYPES, ExtractionError, extract

logger = logging.getLogger(__name__)
_COPY_BLOCK = 1024 * 1024


def storage_path(doc: Document) -> Path:
    return settings.upload_path / doc.storage_name


def title_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    return re.sub(r"[_\-]+", " ", stem).strip().title()[:255] or "Untitled document"


def _bad_request(msg: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


def store_upload(
    db: Session,
    *,
    owner: User,
    filename: str,
    stream: BinaryIO,
    title: Optional[str] = None,
    access_level: str = AccessLevel.ORGANIZATION,
    share_with: Iterable[str] = (),
    is_sample: bool = False,
) -> Document:
    """Validate and persist an uploaded file. The document starts as `processing`;
    call `process_document` (usually as a background task) to index it."""
    safe_name = Path(filename or "").name.strip()
    ext = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
    if ext not in SUPPORTED_TYPES:
        raise _bad_request("Upload a PDF, DOCX, TXT or Markdown file.")
    if access_level not in AccessLevel.ALL:
        raise _bad_request("Access must be private, shared or organization.")

    settings.upload_path.mkdir(parents=True, exist_ok=True)
    storage_name = f"{uuid.uuid4().hex}.{ext}"
    dest = settings.upload_path / storage_name
    limit = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    size, digest = 0, hashlib.sha256()
    try:
        with open(dest, "wb") as out:
            while block := stream.read(_COPY_BLOCK):
                size += len(block)
                if size > limit:
                    raise _bad_request(f"Files can be up to {settings.MAX_UPLOAD_SIZE_MB} MB.")
                digest.update(block)
                out.write(block)
        if size == 0:
            raise _bad_request("That file is empty.")
        content_hash = digest.hexdigest()
        duplicate = db.scalar(
            select(Document).where(Document.owner_id == owner.id, Document.content_hash == content_hash)
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You already uploaded this file as “{duplicate.title}”.",
            )
    except Exception:
        dest.unlink(missing_ok=True)
        raise

    doc = Document(
        title=(title or "").strip()[:255] or title_from_filename(safe_name),
        filename=safe_name[:255],
        storage_name=storage_name,
        file_type=ext,
        file_size=size,
        content_hash=content_hash,
        owner_id=owner.id,
        access_level=access_level,
        status=DocStatus.PROCESSING,
        is_sample=is_sample,
    )
    db.add(doc)
    db.flush()
    if access_level == AccessLevel.SHARED:
        set_shares(db, doc, share_with)
    db.commit()
    db.refresh(doc)
    return doc


def set_shares(db: Session, doc: Document, user_ids: Iterable[str]) -> None:
    wanted = {uid for uid in user_ids if uid and uid != doc.owner_id}
    existing = set(db.scalars(select(User.id).where(User.id.in_(wanted))).all()) if wanted else set()
    doc.shares.clear()
    db.flush()
    for uid in existing:
        doc.shares.append(DocumentShare(user_id=uid))


def process_document(document_id: str) -> None:
    """Extract, chunk and embed a document in its own DB session.

    Safe to run in a background task: every failure is recorded on the
    document instead of being raised."""
    db = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if doc is None:
            return
        try:
            sections, pages = extract(storage_path(doc), doc.file_type)
            chunks = chunk_sections(sections, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
            if not chunks:
                raise ExtractionError("No readable text found.")
            vectors, model_id = embeddings.embed_documents(
                [f"{doc.title}\n{c.section_title or ''}\n{c.content}" for c in chunks]
            )
            db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
            db.add_all(
                DocumentChunk(
                    document_id=doc.id,
                    chunk_index=c.index,
                    content=c.content,
                    page_number=c.page_number,
                    section_title=c.section_title,
                    word_count=c.word_count,
                    embedding=v,
                    embedding_model=model_id,
                )
                for c, v in zip(chunks, vectors)
            )
            doc.status, doc.error_message = DocStatus.INDEXED, None
            doc.page_count, doc.chunk_count = pages, len(chunks)
            db.commit()
            logger.info("Indexed %s (%d chunks, %s)", doc.title, len(chunks), model_id)
        except FileNotFoundError:
            db.rollback()
            _fail(db, doc, "The stored file is missing. Delete this document and upload it again.")
        except ExtractionError as exc:
            db.rollback()
            _fail(db, doc, str(exc))
        except Exception as exc:  # noqa: BLE001 - record anything unexpected
            db.rollback()
            logger.exception("Indexing failed for %s", document_id)
            _fail(db, doc, f"Indexing failed: {exc}")
    finally:
        db.close()


def _fail(db: Session, doc: Document, message: str) -> None:
    doc.status, doc.error_message = DocStatus.FAILED, message[:2000]
    db.commit()


def delete_document(db: Session, doc: Document) -> None:
    path = storage_path(doc)
    db.delete(doc)
    db.commit()
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    except OSError as exc:  # pragma: no cover
        logger.warning("Couldn't remove %s: %s", path, exc)


def reindex_stale_embeddings(db: Session) -> int:
    """Re-embed chunks produced by a different model than the active one
    (e.g. after adding a Gemini key). Returns the number of chunks updated."""
    active = embeddings.active.model_id
    doc_ids = db.scalars(
        select(DocumentChunk.document_id)
        .where((DocumentChunk.embedding_model != active) | DocumentChunk.embedding_model.is_(None))
        .distinct()
    ).all()
    updated = 0
    for doc_id in doc_ids:
        doc = db.get(Document, doc_id)
        chunks = list(doc.chunks)
        vectors, model_id = embeddings.embed_documents(
            [f"{doc.title}\n{c.section_title or ''}\n{c.content}" for c in chunks]
        )
        for c, v in zip(chunks, vectors):
            c.embedding, c.embedding_model = v, model_id
        db.commit()
        updated += len(chunks)
    return updated
