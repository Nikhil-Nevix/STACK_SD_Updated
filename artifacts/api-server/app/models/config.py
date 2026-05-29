import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class SLAConfig(Base):
    __tablename__ = "sla_configs"

    sla_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    use_case = Column(String(50), nullable=False)
    priority = Column(String(20), nullable=False)
    resolution_hours = Column(Integer, nullable=False)
    warning_threshold_percent = Column(Float, default=75.0)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ConfidenceThreshold(Base):
    __tablename__ = "confidence_thresholds"

    threshold_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    use_case = Column(String(50), unique=True, nullable=False)
    auto_resolve_min = Column(Float, default=85.0)
    review_after_min = Column(Float, default=60.0)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ROIMetric(Base):
    __tablename__ = "roi_metrics"

    metric_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start = Column(String(20))
    period_end = Column(String(20))
    total_tickets = Column(Integer, default=0)
    auto_resolved_count = Column(Integer, default=0)
    manual_resolved_count = Column(Integer, default=0)
    avg_auto_resolution_mins = Column(Float, default=0.0)
    avg_manual_resolution_mins = Column(Float, default=0.0)
    hours_saved = Column(Float, default=0.0)
    cost_saved = Column(Float, default=0.0)
    agent_hourly_cost = Column(Float, default=25.0)
    calculated_at = Column(DateTime(timezone=True), default=datetime.utcnow)
