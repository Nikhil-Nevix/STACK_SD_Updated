from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = "OK"


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
