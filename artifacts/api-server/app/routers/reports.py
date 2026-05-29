from datetime import datetime, timedelta
from typing import Optional
import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, text, literal_column

from app.database import get_db
from app.models.tickets import Ticket
from app.models.agents import Agent as AgentModel
from app.middleware.auth import get_current_agent

router = APIRouter()


def _parse_date_range(date_from: Optional[str], date_to: Optional[str]):
    now = datetime.utcnow()
    try:
        df = datetime.fromisoformat(date_from) if date_from else now - timedelta(days=30)
    except ValueError:
        df = now - timedelta(days=30)
    try:
        dt = datetime.fromisoformat(date_to + "T23:59:59") if date_to else now
    except ValueError:
        dt = now
    return df, dt


@router.get("/resolution-rate")
async def resolution_rate(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    df, dt = _parse_date_range(date_from, date_to)
    result = await db.execute(
        select(
            Ticket.use_case,
            func.count(Ticket.ticket_id).label("total"),
            func.sum(case((Ticket.status == "auto_resolved", 1), else_=0)).label("auto_count"),
            func.sum(case((Ticket.resolution_type == "manual", 1), else_=0)).label("manual_count"),
        )
        .where(Ticket.created_at >= df, Ticket.created_at <= dt)
        .group_by(Ticket.use_case)
    )
    rows = result.all()
    items = [
        {
            "use_case": r.use_case,
            "auto_count": r.auto_count or 0,
            "manual_count": r.manual_count or 0,
            "total": r.total,
            "auto_rate": round((r.auto_count / r.total * 100) if r.total > 0 else 0, 1),
        }
        for r in rows
    ]
    return {
        "items": items,
        "date_from": df.strftime("%Y-%m-%d"),
        "date_to": dt.strftime("%Y-%m-%d"),
    }


@router.get("/sla-compliance")
async def sla_compliance(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    df, dt = _parse_date_range(date_from, date_to)

    result = await db.execute(
        select(
            func.count(Ticket.ticket_id).label("total"),
            func.sum(case((Ticket.sla_status == "safe", 1), else_=0)).label("met"),
            func.sum(case((Ticket.sla_status == "breached", 1), else_=0)).label("breached"),
            func.sum(case((Ticket.sla_status == "at_risk", 1), else_=0)).label("at_risk"),
        )
        .where(Ticket.created_at >= df, Ticket.created_at <= dt)
    )
    row = result.one()
    total = row.total or 0
    met = row.met or 0
    breached = row.breached or 0
    at_risk = row.at_risk or 0

    # Build daily trend over the date range
    _day = text("'day'")
    trend_result = await db.execute(
        select(
            func.date_trunc(_day, Ticket.created_at).label("day"),
            func.count(Ticket.ticket_id).label("total"),
            func.sum(case((Ticket.sla_status == "safe", 1), else_=0)).label("met"),
        )
        .where(Ticket.created_at >= df, Ticket.created_at <= dt)
        .group_by(func.date_trunc(_day, Ticket.created_at))
        .order_by(func.date_trunc(_day, Ticket.created_at))
    )
    trend = [
        {
            "date": str(r.day)[:10],
            "compliance": round((r.met / r.total * 100) if r.total > 0 else 0, 1),
        }
        for r in trend_result.all()
    ]

    return {
        "met_count": met,
        "breached_count": breached,
        "at_risk_count": at_risk,
        "compliance_percent": round((met / total * 100) if total > 0 else 0, 1),
        "trend": trend,
    }


@router.get("/ticket-trends")
async def ticket_trends(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    granularity: str = Query("daily"),
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    df, dt = _parse_date_range(date_from, date_to)
    trunc_unit = "week" if granularity == "weekly" else ("month" if granularity == "monthly" else "day")
    _trunc = text(f"'{trunc_unit}'")

    result = await db.execute(
        select(
            func.date_trunc(_trunc, Ticket.created_at).label("period"),
            func.count(Ticket.ticket_id).label("total"),
            func.sum(case((Ticket.status == "auto_resolved", 1), else_=0)).label("auto_resolved"),
            func.sum(case((Ticket.status == "escalated", 1), else_=0)).label("escalated"),
        )
        .where(Ticket.created_at >= df, Ticket.created_at <= dt)
        .group_by(func.date_trunc(_trunc, Ticket.created_at))
        .order_by(func.date_trunc(_trunc, Ticket.created_at))
    )
    trend = [
        {
            "date": str(r.period)[:10],
            "total": r.total,
            "auto_resolved": r.auto_resolved or 0,
            "escalated": r.escalated or 0,
        }
        for r in result.all()
    ]
    return {"trend": trend}


@router.get("/ai-accuracy")
async def ai_accuracy(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    df, dt = _parse_date_range(date_from, date_to)
    from app.models.ai import AIResolution

    summary = await db.execute(
        select(
            func.avg(AIResolution.confidence_score).label("avg_conf"),
            func.count(AIResolution.resolution_id).label("total"),
        )
        .where(AIResolution.created_at >= df, AIResolution.created_at <= dt)
    )
    row = summary.one()
    avg_conf = round((row.avg_conf or 0) * 100, 1)

    # Distribution buckets (by percentage)
    _range_expr = case(
        (AIResolution.confidence_score >= 0.85, "85-100"),
        (AIResolution.confidence_score >= 0.70, "70-84"),
        (AIResolution.confidence_score >= 0.50, "50-69"),
        else_="0-49",
    ).label("range")
    dist = await db.execute(
        select(
            _range_expr,
            func.count(AIResolution.resolution_id).label("count"),
        )
        .where(AIResolution.created_at >= df, AIResolution.created_at <= dt)
        .group_by(text("1"))
    )
    distribution = [{"range": r.range, "count": r.count} for r in dist.all()]

    # By use-case
    uc_result = await db.execute(
        select(
            Ticket.use_case,
            func.avg(AIResolution.confidence_score).label("avg_conf"),
            func.count(AIResolution.resolution_id).label("count"),
        )
        .join(Ticket, AIResolution.ticket_id == Ticket.ticket_id)
        .where(AIResolution.created_at >= df, AIResolution.created_at <= dt)
        .group_by(Ticket.use_case)
    )
    by_use_case = [
        {"use_case": r.use_case, "avg_confidence": round((r.avg_conf or 0) * 100, 1), "count": r.count}
        for r in uc_result.all()
    ]

    # Daily trend
    _ai_day = text("'day'")
    trend_result = await db.execute(
        select(
            func.date_trunc(_ai_day, AIResolution.created_at).label("day"),
            func.avg(AIResolution.confidence_score).label("avg_conf"),
        )
        .where(AIResolution.created_at >= df, AIResolution.created_at <= dt)
        .group_by(func.date_trunc(_ai_day, AIResolution.created_at))
        .order_by(func.date_trunc(_ai_day, AIResolution.created_at))
    )
    trend = [
        {"date": str(r.day)[:10], "avg_confidence": round((r.avg_conf or 0) * 100, 1)}
        for r in trend_result.all()
    ]

    return {
        "avg_confidence": avg_conf,
        "distribution": distribution,
        "by_use_case": by_use_case,
        "trend": trend,
    }


@router.get("/agent-performance")
async def agent_performance(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    df, dt = _parse_date_range(date_from, date_to)

    result = await db.execute(
        select(
            AgentModel.agent_id,
            AgentModel.full_name,
            func.count(Ticket.ticket_id).label("tickets_handled"),
            func.avg(
                func.extract("epoch", Ticket.closed_at - Ticket.created_at) / 60
            ).label("avg_mins"),
        )
        .outerjoin(
            Ticket,
            (Ticket.assigned_agent_id == AgentModel.agent_id) &
            (Ticket.created_at >= df) &
            (Ticket.created_at <= dt),
        )
        .group_by(AgentModel.agent_id, AgentModel.full_name)
        .where(AgentModel.is_active == True)
    )
    rows = result.all()
    return [
        {
            "agent_id": str(r.agent_id),
            "full_name": r.full_name,
            "tickets_handled": r.tickets_handled or 0,
            "avg_resolution_mins": round(r.avg_mins or 0, 1),
        }
        for r in rows
    ]


@router.get("/export")
async def export_report(
    report_type: str = Query("tickets", pattern="^(tickets|sla|resolution)$"),
    period: str = Query("monthly"),
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    days = 7 if period == "weekly" else 30
    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(Ticket).where(Ticket.created_at >= since).order_by(Ticket.created_at.desc())
    )
    tickets = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ticket_id", "title", "use_case", "status", "priority",
        "sla_status", "confidence_score", "user_email", "created_at", "closed_at",
    ])
    for t in tickets:
        writer.writerow([
            str(t.ticket_id), t.title, t.use_case, t.status, t.priority,
            t.sla_status, t.confidence_score, t.user_email,
            str(t.created_at)[:19], str(t.closed_at)[:19] if t.closed_at else "",
        ])

    output.seek(0)
    filename = f"stack_{report_type}_{period}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
