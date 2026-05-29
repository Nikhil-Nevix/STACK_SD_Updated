from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.database import get_db
from app.models.config import ROIMetric
from app.models.tickets import Ticket
from app.middleware.auth import get_current_agent

router = APIRouter()

DEFAULT_AGENT_HOURLY_COST = 25.0
DEFAULT_AVG_MANUAL_MINS = 45.0
DEFAULT_AVG_AUTO_MINS = 3.0


@router.get("/current")
async def current_roi(db: AsyncSession = Depends(get_db), agent=Depends(get_current_agent)):
    # Get latest metric or compute on-the-fly
    metric_result = await db.execute(
        select(ROIMetric).order_by(ROIMetric.calculated_at.desc()).limit(1)
    )
    metric = metric_result.scalar_one_or_none()

    # Live computation
    stats = await db.execute(
        select(
            func.count(Ticket.ticket_id).label("total"),
            func.sum(case((Ticket.status == "auto_resolved", 1), else_=0)).label("auto_resolved"),
        )
    )
    row = stats.one()
    total = row.total or 0
    auto_resolved = row.auto_resolved or 0
    manual_resolved = total - auto_resolved

    hourly_cost = metric.agent_hourly_cost if metric else DEFAULT_AGENT_HOURLY_COST
    manual_mins = metric.avg_manual_resolution_mins if metric else DEFAULT_AVG_MANUAL_MINS
    auto_mins = metric.avg_auto_resolution_mins if metric else DEFAULT_AVG_AUTO_MINS

    hours_saved = (auto_resolved * manual_mins) / 60
    cost_saved = hours_saved * hourly_cost
    capacity_freed_pct = round((auto_resolved / total * 100) if total > 0 else 0, 1)
    ai_cost_per_ticket = round((auto_mins / 60 * hourly_cost), 2)
    human_cost_per_ticket = round((manual_mins / 60 * hourly_cost), 2)

    return {
        "total_tickets": total,
        "auto_resolved_count": auto_resolved,
        "manual_resolved_count": manual_resolved,
        "auto_resolution_rate_percent": round((auto_resolved / total * 100) if total > 0 else 0, 1),
        "hours_saved": round(hours_saved, 1),
        "cost_saved_usd": round(cost_saved, 2),
        "agent_capacity_freed_percent": capacity_freed_pct,
        "ai_cost_per_ticket_usd": ai_cost_per_ticket,
        "human_cost_per_ticket_usd": human_cost_per_ticket,
        "roi_multiple": round(cost_saved / max((total - auto_resolved) * human_cost_per_ticket, 1), 2),
        "payback_period_months": round(100000 / max(cost_saved / max(total, 1) * 200, 1), 1),
        "settings": {
            "agent_hourly_cost": hourly_cost,
            "avg_manual_resolution_mins": manual_mins,
            "avg_auto_resolution_mins": auto_mins,
        },
    }


@router.get("/history")
async def roi_history(db: AsyncSession = Depends(get_db), agent=Depends(get_current_agent)):
    result = await db.execute(
        select(ROIMetric).order_by(ROIMetric.period_start.asc()).limit(12)
    )
    metrics = result.scalars().all()
    return [
        {
            "period_start": m.period_start,
            "period_end": m.period_end,
            "total_tickets": m.total_tickets,
            "auto_resolved_count": m.auto_resolved_count,
            "hours_saved": m.hours_saved,
            "cost_saved": m.cost_saved,
        }
        for m in metrics
    ]


@router.patch("/settings")
async def update_roi_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    result = await db.execute(
        select(ROIMetric).order_by(ROIMetric.calculated_at.desc()).limit(1)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        metric = ROIMetric()
        db.add(metric)

    if "agent_hourly_cost" in body:
        metric.agent_hourly_cost = float(body["agent_hourly_cost"])
    if "avg_manual_resolution_mins" in body:
        metric.avg_manual_resolution_mins = float(body["avg_manual_resolution_mins"])
    if "avg_auto_resolution_mins" in body:
        metric.avg_auto_resolution_mins = float(body["avg_auto_resolution_mins"])

    return {"success": True, "message": "ROI settings updated"}
