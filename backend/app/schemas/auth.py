from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "member"

class UserCreate(UserBase):
    clerk_user_id: str

class UserResponse(UserBase):
    id: str
    clerk_user_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenPayload(BaseModel):
    sub: str
    email: Optional[str] = None
    role: Optional[str] = "member"
