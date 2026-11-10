import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON, Float, Boolean, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base, VectorType

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    clerk_user_id = Column(String(128), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="member", nullable=False)  # "admin" or "member"
    created_at = Column(DateTime, default=utc_now, nullable=False)

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    collections = relationship("Collection", back_populates="owner")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    permissions = relationship("DocumentPermission", back_populates="user", cascade="all, delete-orphan")

class Collection(Base):
    __tablename__ = "collections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    owner = relationship("User", back_populates="collections")
    documents = relationship("Document", back_populates="collection")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, txt
    file_size = Column(Integer, nullable=False)  # in bytes
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    collection_id = Column(String(36), ForeignKey("collections.id"), nullable=True)
    status = Column(String(50), default="uploaded", nullable=False)  # uploaded, processing, indexed, failed
    access_level = Column(String(50), default="organization", nullable=False)  # private, shared, organization
    error_message = Column(Text, nullable=True)
    extracted_text_preview = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    owner = relationship("User", back_populates="documents")
    collection = relationship("Collection", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    permissions = relationship("DocumentPermission", back_populates="document", cascade="all, delete-orphan")

class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission = Column(String(50), default="view", nullable=False)  # view, admin
    created_at = Column(DateTime, default=utc_now, nullable=False)

    document = relationship("Document", back_populates="permissions")
    user = relationship("User", back_populates="permissions")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    section_title = Column(String(255), nullable=True)
    token_count = Column(Integer, nullable=True)
    embedding = Column(VectorType, nullable=True)  # vector or JSON string
    created_at = Column(DateTime, default=utc_now, nullable=False)

    document = relationship("Document", back_populates="chunks")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="New Chat", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True)  # List of citation objects
    confidence_score = Column(Float, nullable=True)
    abstained = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")

class EvaluationDataset(Base):
    __tablename__ = "evaluation_dataset"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    category = Column(String(100), nullable=False)  # factual, multi-doc, synthesis, missing, contradiction, permission
    question = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=False)
    relevant_document_ids = Column(JSON, nullable=True)
    relevant_chunk_ids = Column(JSON, nullable=True)
    expected_citation_references = Column(JSON, nullable=True)
    should_abstain = Column(Boolean, default=False)
    target_user_role = Column(String(50), default="member")  # member or admin or specific user
    created_at = Column(DateTime, default=utc_now, nullable=False)

class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(36), ForeignKey("evaluation_dataset.id", ondelete="CASCADE"), nullable=False)
    retrieval_recall_at_5 = Column(Float, nullable=True)
    retrieval_precision_at_5 = Column(Float, nullable=True)
    mrr = Column(Float, nullable=True)
    answer_correctness = Column(Float, nullable=True)
    citation_precision = Column(Float, nullable=True)
    citation_recall = Column(Float, nullable=True)
    unsupported_claim_rate = Column(Float, nullable=True)
    abstention_accuracy = Column(Float, nullable=True)
    generated_answer = Column(Text, nullable=True)
    generated_citations = Column(JSON, nullable=True)
    passed = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
