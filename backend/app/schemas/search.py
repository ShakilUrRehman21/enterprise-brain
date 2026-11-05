from typing import Optional, List
from pydantic import BaseModel, Field

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Natural-language or keyword search query")
    mode: str = Field("hybrid", description="Search mode: hybrid, vector, or keyword")
    limit: int = Field(5, ge=1, le=50, description="Maximum number of chunks to return")
    collection_id: Optional[str] = Field(None, description="Optional collection ID filter")

class SearchHit(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    content: str
    similarity_score: float
    keyword_score: float
    combined_rrf_score: float
    access_level: str

class SearchResponse(BaseModel):
    query: str
    mode: str
    total_hits: int
    results: List[SearchHit]

