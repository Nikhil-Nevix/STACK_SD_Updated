from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, text
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.tickets import Ticket
from app.models.logs import AuditLog
from app.models.agents import Agent
from app.middleware.auth import get_current_agent

router = APIRouter()


@router.get("/summary")
async def summary(db: AsyncSession = Depends(get_db), agent: Agent = Depends(get_current_agent)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Core counts
    open_count = (await db.execute(
        select(func.count(Ticket.ticket_id)).where(Ticket.status == "open")
    )).scalar_one()

    in_progress = (await db.execute(
        select(func.count(Ticket.ticket_id)).where(Ticket.status == "in_progress")
    )).scalar_one()

    auto_resolved = (await db.execute(
        select(func.count(Ticket.ticket_id)).where(Ticket.status == "auto_resolved")
    )).scalar_one()

    total = (await db.execute(select(func.count(Ticket.ticket_id)))).scalar_one()

    resolved_today = (await db.execute(
        select(func.count(Ticket.ticket_id)).where(
            Ticket.status.in_(["auto_resolved", "closed"]),
            Ticket.closed_at >= today_start,
        )
    )).scalar_one()

    resolved_total = (await db.execute(
        select(func.count(Ticket.ticket_id)).where(Ticket.status.in_(["auto_resolved", "closed"]))
    )).scalar_one()

    sla_met = (await db.execute(
        select(func.count(Ticket.ticket_id)).where(
            Ticket.status.in_(["auto_resolved", "closed"]),
            Ticket.sla_status == "safe",
        )
    )).scalar_one()

    sla_met_percent = round((sla_met / resolved_total * 100) if resolved_total > 0 else 0, 1)
    auto_rate = round((auto_resolved / total * 100) if total > 0 else 0, 1)

    at_risk = (await db.execute(
        select(func.count(Ticket.ticket_id)).where(
            Ticket.status.in_(["open", "in_progress"]),
            Ticket.sla_status.in_(["at_risk", "breached"]),
        )
    )).scalar_one()

    # tickets_by_use_case
    uc_result = await db.execute(
        select(Ticket.use_case, func.count(Ticket.ticket_id).label("cnt"))
        .group_by(Ticket.use_case)
    )
    tickets_by_use_case = {r.use_case: r.cnt for r in uc_result.all()}

    # tickets_by_status
    status_result = await db.execute(
        select(Ticket.status, func.count(Ticket.ticket_id).label("cnt"))
        .group_by(Ticket.status)
    )
    tickets_by_status = {r.status: r.cnt for r in status_result.all()}

    # avg_resolution_time_mins (for closed/resolved tickets this month)
    thirty_ago = now - timedelta(days=30)
    avg_result = await db.execute(
        select(func.avg(
            func.extract("epoch", Ticket.closed_at - Ticket.created_at) / 60
        )).where(
            Ticket.status.in_(["auto_resolved", "closed"]),
            Ticket.closed_at.isnot(None),
            Ticket.created_at >= thirty_ago,
        )
    )
    avg_res_mins = round(avg_result.scalar_one() or 0, 1)

    return {
        "total_open": open_count + in_progress,
        "resolved_today": resolved_today,
        "sla_met_percent": sla_met_percent,
        "auto_resolution_rate": auto_rate,
        "tickets_by_use_case": tickets_by_use_case,
        "tickets_by_status": tickets_by_status,
        "sla_at_risk_count": at_risk,
        "avg_resolution_time_mins": avg_res_mins,
    }


@router.get("/sla-at-risk")
async def sla_at_risk(db: AsyncSession = Depends(get_db), agent: Agent = Depends(get_current_agent)):
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.assigned_agent))
        .where(
            Ticket.status.in_(["open", "in_progress"]),
            Ticket.sla_status.in_(["at_risk", "breached"]),
        )
        .order_by(Ticket.sla_deadline)
        .limit(20)
    )
    tickets = result.scalars().all()
    return [
        {
            "ticket_id": str(t.ticket_id),
            "title": t.title,
            "use_case": t.use_case,
            "priority": t.priority,
            "sla_status": t.sla_status,
            "sla_deadline": t.sla_deadline.isoformat() if t.sla_deadline else None,
            "assigned_agent": t.assigned_agent.full_name if t.assigned_agent else None,
        }
        for t in tickets
    ]


@router.get("/activity")
async def activity(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "log_id": str(l.log_id),
            "event_type": l.event_type,
            "actor": l.actor,
            "actor_type": l.actor_type,
            "ticket_id": str(l.ticket_id) if l.ticket_id else None,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/live-queue")
async def live_queue(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.assigned_agent))
        .where(Ticket.status.in_(["open", "in_progress", "escalated"]))
        .order_by(Ticket.created_at.desc())
        .limit(limit)
    )
    tickets = result.scalars().all()
    return [
        {
            "ticket_id": str(t.ticket_id),
            "title": t.title,
            "use_case": t.use_case,
            "status": t.status,
            "priority": t.priority,
            "sla_status": t.sla_status,
            "user_email": t.user_email,
            "assigned_agent": t.assigned_agent.full_name if t.assigned_agent else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tickets
    ]


@router.get("/volume-trend")
async def volume_trend(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    since = datetime.utcnow() - timedelta(days=days)
    _day = text("'day'")
    result = await db.execute(
        select(
            func.date_trunc(_day, Ticket.created_at).label("day"),
            func.count(Ticket.ticket_id).label("total"),
            func.sum(case((Ticket.status == "auto_resolved", 1), else_=0)).label("auto_resolved"),
        )
        .where(Ticket.created_at >= since)
        .group_by(func.date_trunc(_day, Ticket.created_at))
        .order_by(func.date_trunc(_day, Ticket.created_at))
    )
    rows = result.all()
    return [{"day": str(r.day)[:10], "total": r.total, "auto_resolved": r.auto_resolved or 0} for r in rows]
