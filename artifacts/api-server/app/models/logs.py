import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

ActorType = Enum("user", "ai", "agent", "system", name="actor_type", create_type=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = {"extend_existing": True}

    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.ticket_id"), nullable=True)
    event_type = Column(String(100), nullable=False)
    actor = Column(String(255))
    actor_type = Column(ActorType)
    details = Column(JSONB)
    ip_address = Column(String(45))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="audit_logs")


class APICallLog(Base):
    # The existing table may be api_logs — create api_call_logs as new table
    __tablename__ = "api_call_logs"
    __table_args__ = {"extend_existing": True}

    api_log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.ticket_id"), nullable=True)
    api_name = Column(String(100), nullable=False)
    endpoint = Column(String(500))
    method = Column(String(10))
    request_payload = Column(JSONB)
    response_status = Column(Integer)
    response_payload = Column(JSONB)
    duration_ms = Column(Integer)
    called_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="api_call_logs")


class PowerShellExecution(Base):
    __tablename__ = "powershell_executions"
    __table_args__ = {"extend_existing": True}

    execution_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.ticket_id"), nullable=True)
    resolution_id = Column(UUID(as_uuid=True), ForeignKey("ai_resolutions.resolution_id"), nullable=True)
    device_name = Column(String(255))
    device_ip = Column(String(45))
    script_name = Column(String(255))
    script_content = Column(Text)
    execution_status = Column(String(30))
    output_log = Column(Text)
    executed_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    duration_seconds = Column(Integer)

    ticket = relationship("Ticket", back_populates="powershell_executions")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = {"extend_existing": True}

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email = Column(String(255))
    channel = Column(String(30), default="web_dashboard")
    space_name = Column(String(255))
    messages = Column(JSONB, default=list)
    current_use_case = Column(String(50))
    current_state = Column(String(50), default="idle")
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.ticket_id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
