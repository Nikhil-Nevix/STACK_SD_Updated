from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid


class AgentOut(BaseModel):
    agent_id: uuid.UUID
    email: str
    full_name: str
    role: str
    freshservice_agent_id: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AgentCreate(BaseModel):
    email: str
    full_name: str
    role: str = "agent"
    password: str
    freshservice_agent_id: Optional[str] = None


class AgentUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    freshservice_agent_id: Optional[str] = None


class AgentGroupMemberOut(BaseModel):
    member_id: uuid.UUID
    agent_id: uuid.UUID
    priority_order: int
    joined_at: datetime
    agent: Optional[AgentOut]

    class Config:
        from_attributes = True


class AgentGroupOut(BaseModel):
    group_id: uuid.UUID
    group_name: str
    use_case: Optional[str]
    assignment_mode: str
    freshservice_group_id: Optional[str]
    created_at: datetime
    members: Optional[List[AgentGroupMemberOut]] = []

    class Config:
        from_attributes = True


class AgentGroupUpdate(BaseModel):
    assignment_mode: Optional[str] = None
    group_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    agent: AgentOut
