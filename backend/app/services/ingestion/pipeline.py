import os
import shutil
import logging
from typing import Optional, List
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.entities import Document, DocumentChunk, DocumentPermission, User
from app.services.ingestion.extractor import DocumentExtractor
from app.services.ingestion.chunker import TextChunker
from app.services.embeddings.embedder import embedding_service

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md"}

class IngestionPipeline:
    def __init__(self, db: Session):
        self.db = db
        self.chunker = TextChunker()

    def validate_file(self, file: UploadFile) -> str:
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is missing."
            )

        ext = file.filename.split(".")[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}."
            )
        return ext

    def process_upload(
        self,
        file: UploadFile,
        current_user: User,
        title: Optional[str] = None,
        collection_id: Optional[str] = None,
        access_level: str = "organization"
    ) -> Document:
        ext = self.validate_file(file)

        # Check file size
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)

        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum size limit of {settings.MAX_UPLOAD_SIZE_MB}MB."
            )

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )

        doc_title = title or file.filename.rsplit(".", 1)[0].replace("_", " ").title()

        # Create Document record with status "uploaded"
        doc = Document(
            title=doc_title,
            filename=file.filename,
            file_path="",
            file_type=ext,
            file_size=file_size,
            owner_id=current_user.id,
            collection_id=collection_id,
            status="uploaded",
            access_level=access_level
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)

        # Save file to disk
        safe_filename = f"{doc.id}_{file.filename}"
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        disk_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

        with open(disk_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        doc.file_path = disk_path
        self.db.commit()

        # Ingest and Index
        self.ingest_document(doc)
        return doc

    def ingest_document(self, doc: Document) -> None:
        """
        Runs text extraction, chunking, and embedding generation.
        """
        try:
            doc.status = "processing"
            self.db.commit()

            # 1. Text Extraction
            sections = DocumentExtractor.extract_text_from_file(doc.file_path, doc.file_type)
            extracted_text = "\n\n".join(s.content for s in sections)
            doc.extracted_text_preview = extracted_text[:2000]

            # 2. Structural Chunking
            chunks = self.chunker.chunk_sections(sections)
            if not chunks:
                raise ValueError("No meaningful content could be extracted from document.")

            # 3. Embedding Generation
            texts_to_embed = [c.content for c in chunks]
            embeddings = embedding_service.embed_texts(texts_to_embed)

            # 4. Remove any prior chunks if retrying
            self.db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()

            # 5. Save Chunks
            for chunk_data, emb in zip(chunks, embeddings):
                chunk_record = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=chunk_data.chunk_index,
                    content=chunk_data.content,
                    page_number=chunk_data.page_number,
                    section_title=chunk_data.section_title,
                    token_count=chunk_data.token_count,
                    embedding=emb
                )
                self.db.add(chunk_record)

            doc.status = "indexed"
            doc.error_message = None
            self.db.commit()
            self.db.refresh(doc)
            logger.info(f"Successfully indexed document {doc.id} ({doc.title}) with {len(chunks)} chunks.")

        except Exception as e:
            logger.error(f"Failed to ingest document {doc.id}: {e}", exc_info=True)
            doc.status = "failed"
            doc.error_message = str(e)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to process and index document: {str(e)}"
            )

