from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

RoleName = Literal["admin", "member"]
AccessLevelName = Literal["private", "shared", "organization"]
SearchMode = Literal["hybrid", "vector", "keyword"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth & users ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name can't be blank.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: str
    email: str
    full_name: str
    role: RoleName
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class UserUpdate(BaseModel):
    role: Optional[RoleName] = None
    is_active: Optional[bool] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ---------- Documents ----------
class DocumentOut(ORM):
    id: str
    title: str
    filename: str
    file_type: str
    file_size: int
    owner_id: str
    owner_name: Optional[str] = None
    status: str
    access_level: AccessLevelName
    error_message: Optional[str] = None
    page_count: Optional[int] = None
    chunk_count: int
    is_sample: bool
    can_manage: bool = False
    shared_with: List[str] = []
    created_at: datetime
    updated_at: datetime


class ChunkOut(ORM):
    id: str
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    word_count: int


class DocumentDetail(DocumentOut):
    chunks: List[ChunkOut] = []


class AccessUpdate(BaseModel):
    access_level: AccessLevelName
    user_ids: List[str] = []


# ---------- Search ----------
class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    mode: SearchMode = "hybrid"
    limit: int = Field(10, ge=1, le=50)


class SearchHit(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    content: str
    score: float
    vector_score: float
    keyword_score: float
    access_level: str


class SearchResponse(BaseModel):
    query: str
    mode: SearchMode
    vector_available: bool
    results: List[SearchHit]


# ---------- Chat ----------
class Citation(BaseModel):
    number: int
    chunk_id: str
    document_id: str
    document_title: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    passage: str
    quote: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: Optional[str] = None


class MessageOut(ORM):
    id: str
    conversation_id: str
    role: str
    content: str
    citations: List[Citation] = []
    abstained: bool = False
    confidence: Optional[float] = None
    engine: Optional[str] = None
    created_at: datetime

    @field_validator("citations", mode="before")
    @classmethod
    def _none_to_list(cls, v):
        return v or []


class ConversationSummary(ORM):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationOut(ConversationSummary):
    messages: List[MessageOut] = []


class ChatResponse(BaseModel):
    conversation: ConversationSummary
    user_message: MessageOut
    message: MessageOut


# ---------- System / evaluation ----------
class SystemStatus(BaseModel):
    version: str
    ai_engine: Literal["gemini", "local"]
    generation_model: Optional[str]
    embedding_model: str
    database: str
    registration_open: bool
    documents_indexed: int
    stale_chunks: int


class EvaluationRunOut(ORM):
    id: str
    engine: str
    summary: Dict
    results: List[Dict]
    created_at: datetime
