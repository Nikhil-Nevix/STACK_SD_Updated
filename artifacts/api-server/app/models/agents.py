import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

AgentRole = Enum("agent", "admin", "readonly", name="agent_role", create_type=False)
AssignmentMode = Enum("round_robin", "first_available", "priority", name="assignment_mode", create_type=False)


class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = {"extend_existing": True}

    agent_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(AgentRole, default="agent", nullable=False)
    password_hash = Column(String(255))
    freshservice_agent_id = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    assigned_tickets = relationship("Ticket", back_populates="assigned_agent", foreign_keys="Ticket.assigned_agent_id")
    group_memberships = relationship("AgentGroupMember", back_populates="agent", cascade="all, delete-orphan")


class AgentGroup(Base):
    __tablename__ = "agent_groups"
    __table_args__ = {"extend_existing": True}

    group_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_name = Column(String(255), nullable=False)
    use_case = Column(String(50))
    assignment_mode = Column(AssignmentMode, default="round_robin")
    freshservice_group_id = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    members = relationship("AgentGroupMember", back_populates="group", cascade="all, delete-orphan")


class AgentGroupMember(Base):
    __tablename__ = "agent_group_members"
    __table_args__ = {"extend_existing": True}

    member_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("agent_groups.group_id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.agent_id", ondelete="CASCADE"), nullable=False)
    priority_order = Column(Integer, default=1)
    joined_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    group = relationship("AgentGroup", back_populates="members")
    agent = relationship("Agent", back_populates="group_memberships")
