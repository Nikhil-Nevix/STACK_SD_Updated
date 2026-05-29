import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, Float, ForeignKey, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

Decision = Enum("auto_resolve", "review_after", "escalate", name="decision", create_type=False)
ExecutionStatus = Enum("success", "failed", "timeout", "partial", name="execution_status", create_type=False)


class SOP(Base):
    __tablename__ = "sops"
    __table_args__ = {"extend_existing": True}

    sop_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    use_case = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(String(20), default="1.0")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    # embedding column — added by migration below; nullable so existing rows work
    embedding = Column(JSONB, nullable=True)

    ai_resolutions = relationship("AIResolution", back_populates="sop_matched_rel")


class AIResolution(Base):
    __tablename__ = "ai_resolutions"
    __table_args__ = {"extend_existing": True}

    resolution_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.ticket_id", ondelete="CASCADE"), nullable=False)
    intent_detected = Column(String(255))
    root_cause = Column(Text)
    sop_matched = Column(UUID(as_uuid=True), ForeignKey("sops.sop_id"), nullable=True)
    confidence_score = Column(Float)
    intent_clarity_score = Column(Float)
    sop_match_score = Column(Float)
    historical_success_score = Column(Float)
    input_completeness_score = Column(Float)
    decision = Column(Decision)
    resolution_steps = Column(JSONB)
    execution_status = Column(ExecutionStatus)
    execution_output = Column(Text)
    time_taken_seconds = Column(Integer)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="ai_resolutions")
    sop_matched_rel = relationship("SOP", back_populates="ai_resolutions", foreign_keys=[sop_matched])
