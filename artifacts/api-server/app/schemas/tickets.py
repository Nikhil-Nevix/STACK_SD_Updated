from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime
import uuid


class TicketNoteOut(BaseModel):
    note_id: uuid.UUID
    ticket_id: uuid.UUID
    note_type: str
    content: str
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AIResolutionOut(BaseModel):
    resolution_id: uuid.UUID
    intent_detected: Optional[str]
    root_cause: Optional[str]
    sop_matched: Optional[uuid.UUID]
    confidence_score: Optional[float]
    intent_clarity_score: Optional[float]
    sop_match_score: Optional[float]
    historical_success_score: Optional[float]
    input_completeness_score: Optional[float]
    decision: Optional[str]
    resolution_steps: Optional[Any]
    execution_status: Optional[str]
    execution_output: Optional[str]
    time_taken_seconds: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AgentSummary(BaseModel):
    agent_id: uuid.UUID
    full_name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    ticket_id: uuid.UUID
    freshservice_ticket_id: Optional[str]
    title: str
    description: Optional[str]
    use_case: str
    status: str
    priority: str
    sla_deadline: Optional[datetime]
    sla_status: Optional[str]
    sla_breach_predicted: Optional[bool]
    source: Optional[str]
    user_email: Optional[str]
    assigned_agent_id: Optional[uuid.UUID]
    assigned_agent: Optional[AgentSummary]
    resolution_type: Optional[str]
    confidence_score: Optional[float]
    created_at: datetime
    updated_at: Optional[datetime]
    closed_at: Optional[datetime]
    notes: Optional[List[TicketNoteOut]] = []
    ai_resolutions: Optional[List[AIResolutionOut]] = []

    class Config:
        from_attributes = True


class TicketCreate(BaseModel):
    title: str
    description: Optional[str] = None
    use_case: str
    priority: str = "medium"
    source: str = "web_dashboard"
    user_email: Optional[str] = None
    assigned_agent_id: Optional[uuid.UUID] = None


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_agent_id: Optional[uuid.UUID] = None
    sla_status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


class TicketNoteCreate(BaseModel):
    content: str
    note_type: str = "human_note"
    created_by: Optional[str] = None


class TicketResolveRequest(BaseModel):
    force: bool = False
    resolution_notes: Optional[str] = None


class TicketEscalateRequest(BaseModel):
    reason: Optional[str] = None
    target_group: Optional[str] = None
