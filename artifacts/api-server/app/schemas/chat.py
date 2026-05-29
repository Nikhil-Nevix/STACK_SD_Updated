from pydantic import BaseModel
from typing import Optional, Any, List
from datetime import datetime
import uuid


class ChatMessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_email: Optional[str] = None
    channel: str = "web_dashboard"
    space_name: Optional[str] = None
    # Google Chat event format
    type: Optional[str] = None
    space: Optional[dict] = None
    user: Optional[dict] = None


class ChatMessageResponse(BaseModel):
    session_id: str
    reply: str
    use_case: Optional[str] = None
    ticket_id: Optional[str] = None
    state: str = "idle"
    quick_replies: Optional[List[str]] = None


class GoogleChatWebhookEvent(BaseModel):
    type: str
    eventTime: Optional[str] = None
    message: Optional[dict] = None
    space: Optional[dict] = None
    user: Optional[dict] = None
