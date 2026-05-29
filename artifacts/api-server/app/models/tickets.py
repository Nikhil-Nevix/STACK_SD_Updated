import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, Float, ForeignKey, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

# Reference existing PostgreSQL enum types — create_type=False means SQLAlchemy
# uses the already-defined DB enum rather than trying to recreate it.
UseCase = Enum(
    "sharepoint_access", "sharepoint_admin", "license_bluebeam",
    "license_adobe", "license_o365", "dl_update", "windows_troubleshooting",
    name="use_case", create_type=False,
)
TicketStatus = Enum(
    "open", "in_progress", "auto_resolved", "escalated", "closed",
    name="ticket_status", create_type=False,
)
Priority = Enum("low", "medium", "high", "urgent", name="priority", create_type=False)
SLAStatus = Enum("safe", "at_risk", "breached", name="sla_status", create_type=False)
Source = Enum("web_dashboard", "google_chat", "freshservice", name="source", create_type=False)
ResolutionType = Enum("auto", "manual", name="resolution_type", create_type=False)
NoteType = Enum(
    "human_note", "ai_context", "system_note", "resolution_summary",
    name="note_type", create_type=False,
)


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = {"extend_existing": True}

    ticket_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    freshservice_ticket_id = Column(String(50))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    use_case = Column(UseCase, nullable=False)
    status = Column(TicketStatus, default="open", nullable=False)
    priority = Column(Priority, default="medium", nullable=False)
    sla_deadline = Column(DateTime(timezone=True))
    sla_status = Column(SLAStatus, default="safe")
    sla_breach_predicted = Column(Boolean, default=False)
    source = Column(Source, default="web_dashboard")
    user_email = Column(String(255))
    assigned_agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.agent_id"), nullable=True)
    resolution_type = Column(ResolutionType)
    # confidence_score is TEXT in existing DB
    confidence_score = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime(timezone=True))

    assigned_agent = relationship("Agent", back_populates="assigned_tickets", foreign_keys=[assigned_agent_id])
    notes = relationship("TicketNote", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")
    ai_resolutions = relationship("AIResolution", back_populates="ticket", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="ticket")
    api_call_logs = relationship("APICallLog", back_populates="ticket")
    powershell_executions = relationship("PowerShellExecution", back_populates="ticket")

    @property
    def confidence_score_float(self):
        try:
            return float(self.confidence_score) if self.confidence_score else None
        except (ValueError, TypeError):
            return None


class TicketNote(Base):
    __tablename__ = "ticket_notes"
    __table_args__ = {"extend_existing": True}

    note_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.ticket_id", ondelete="CASCADE"), nullable=False)
    note_type = Column(NoteType, default="human_note")
    content = Column(Text, nullable=False)
    created_by = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="notes")


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"
    __table_args__ = {"extend_existing": True}

    attachment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.ticket_id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer)
    mime_type = Column(String(100))
    storage_path = Column(String(500))
    uploaded_by = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="attachments")
