from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class DocumentChunkResponse(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    token_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class DocumentResponse(BaseModel):
    id: str
    title: str
    filename: str
    file_type: str
    file_size: int
    owner_id: str
    collection_id: Optional[str] = None
    status: str
    access_level: str
    error_message: Optional[str] = None
    extracted_text_preview: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DocumentPermissionUpdate(BaseModel):
    access_level: str  # private, shared, organization
    user_ids: Optional[List[str]] = []

class DocumentPermissionResponse(BaseModel):
    id: str
    document_id: str
    user_id: str
    permission: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

