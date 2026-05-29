from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid


class SOPOut(BaseModel):
    sop_id: uuid.UUID
    title: str
    use_case: str
    content: str
    version: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class SOPCreate(BaseModel):
    title: str
    use_case: str
    content: str
    version: str = "1.0"


class SOPUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    version: Optional[str] = None
    is_active: Optional[bool] = None


class SOPSearchRequest(BaseModel):
    query: str
    use_case: Optional[str] = None
    limit: int = 5
