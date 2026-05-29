"""Celery application setup with Redis broker."""
from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "stack",
    broker=settings.celery_broker_url,
    backend=settings.celery_broker_url.replace("redis://", "redis://").replace("/0", "/1"),
    include=["app.tasks.sla_monitor", "app.tasks.ai_processor"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "sla-monitor-every-5min": {
            "task": "app.tasks.sla_monitor.check_sla_status",
            "schedule": 300.0,  # every 5 minutes
        },
        "roi-metrics-daily": {
            "task": "app.tasks.ai_processor.compute_daily_roi",
            "schedule": 86400.0,  # every 24 hours
        },
    },
)
