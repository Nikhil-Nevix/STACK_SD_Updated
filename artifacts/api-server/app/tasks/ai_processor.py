"""
AI Processor Celery Tasks.
- compute_daily_roi: Aggregates ROI metrics daily
- embed_all_sops: Triggers embedding for all SOPs (run once after setup)
- process_pending_tickets: Retry AI triage for tickets stuck in 'open'
"""
import logging
from datetime import datetime, timedelta
from app.tasks.celery_app import celery_app

logger = logging.getLogger("stack.ai_processor")


@celery_app.task(name="app.tasks.ai_processor.compute_daily_roi")
def compute_daily_roi():
    import asyncio
    asyncio.run(_async_compute_roi())


@celery_app.task(name="app.tasks.ai_processor.embed_all_sops")
def embed_all_sops():
    import asyncio
    asyncio.run(_async_embed_sops())


@celery_app.task(name="app.tasks.ai_processor.process_pending_tickets")
def process_pending_tickets():
    import asyncio
    asyncio.run(_async_process_pending())


async def _async_compute_roi():
    from app.database import AsyncSessionLocal
    from app.models.tickets import Ticket
    from app.models.config import ROIMetric
    from sqlalchemy import select, func, case

    async with AsyncSessionLocal() as db:
        today = datetime.utcnow().date()
        period_start = str(today - timedelta(days=30))
        period_end = str(today)

        stats = await db.execute(
            select(
                func.count(Ticket.ticket_id).label("total"),
                func.sum(case((Ticket.status == "auto_resolved", 1), else_=0)).label("auto_resolved"),
                func.sum(case((Ticket.status.in_(["auto_resolved", "closed"]), 1), else_=0)).label("resolved"),
            ).where(Ticket.created_at >= datetime.utcnow() - timedelta(days=30))
        )
        row = stats.one()

        hours_saved = (row.auto_resolved or 0) * 0.75  # 45 min avg per ticket
        metric = ROIMetric(
            period_start=period_start,
            period_end=period_end,
            total_tickets=row.total or 0,
            auto_resolved_count=row.auto_resolved or 0,
            manual_resolved_count=(row.total or 0) - (row.auto_resolved or 0),
            avg_auto_resolution_mins=3.0,
            avg_manual_resolution_mins=45.0,
            hours_saved=round(hours_saved, 2),
            cost_saved=round(hours_saved * 25.0, 2),
            agent_hourly_cost=25.0,
        )
        db.add(metric)
        await db.commit()
        logger.info(f"ROI computed: {row.total} tickets, {hours_saved:.1f} hours saved")


async def _async_embed_sops():
    from app.database import AsyncSessionLocal
    from app.models.ai import SOP
    from app.services.ai.rag_pipeline import embed_sop
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SOP).where(SOP.is_active == True))
        sops = result.scalars().all()

    for sop in sops:
        await embed_sop(str(sop.sop_id))
        logger.info(f"Embedded SOP: {sop.title}")


async def _async_process_pending():
    from app.database import AsyncSessionLocal
    from app.models.tickets import Ticket
    from app.services.ai.langchain_agent import triage_ticket
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        since = datetime.utcnow() - timedelta(hours=1)
        result = await db.execute(
            select(Ticket).where(
                Ticket.status == "open",
                Ticket.created_at >= since,
            ).limit(10)
        )
        tickets = result.scalars().all()

    for ticket in tickets:
        await triage_ticket(str(ticket.ticket_id))
        logger.info(f"Retried triage for ticket {ticket.ticket_id}")
