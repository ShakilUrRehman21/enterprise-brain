from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class CitationItem(BaseModel):
    citation_number: int
    document_id: str
    document_title: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    chunk_id: str
    exact_passage: str

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = Field(None, description="Existing conversation ID or null for new chat")
    message: str = Field(..., min_length=1, description="User question or prompt")
    collection_id: Optional[str] = Field(None, description="Optional collection filter")

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    citations: Optional[List[CitationItem]] = None
    confidence_score: Optional[float] = None
    abstained: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ConversationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[MessageResponse]] = []

    model_config = ConfigDict(from_attributes=True)

class ChatResponse(BaseModel):
    conversation_id: str
    message: MessageResponse

