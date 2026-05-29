import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.tickets import Ticket, TicketNote
from app.models.agents import Agent
from app.models.logs import AuditLog
from app.schemas.tickets import (
    TicketOut, TicketCreate, TicketUpdate, TicketNoteCreate,
    TicketNoteOut, TicketResolveRequest, TicketEscalateRequest,
)
from app.middleware.auth import get_current_agent

router = APIRouter()


async def _log_event(db, ticket_id, event_type, actor, actor_type="agent", details=None):
    log = AuditLog(
        ticket_id=ticket_id,
        event_type=event_type,
        actor=actor,
        actor_type=actor_type,
        details=details or {},
    )
    db.add(log)


@router.get("")
async def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    use_case: Optional[str] = None,
    sla_status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    q = select(Ticket).options(
        selectinload(Ticket.assigned_agent),
        selectinload(Ticket.ai_resolutions),
    )
    if status:
        q = q.where(Ticket.status == status)
    if priority:
        q = q.where(Ticket.priority == priority)
    if use_case:
        q = q.where(Ticket.use_case == use_case)
    if sla_status:
        q = q.where(Ticket.sla_status == sla_status)
    if search:
        q = q.where(or_(
            Ticket.title.ilike(f"%{search}%"),
            Ticket.user_email.ilike(f"%{search}%"),
        ))
    if date_from:
        try:
            q = q.where(Ticket.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.where(Ticket.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))
        except ValueError:
            pass

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    q = q.order_by(Ticket.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    tickets = result.scalars().all()

    return {
        "tickets": [_ticket_to_dict(t) for t in tickets],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("", status_code=201)
async def create_ticket(
    body: TicketCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    from app.services.resolution.engine import compute_sla_deadline
    deadline = compute_sla_deadline(body.use_case, body.priority)

    ticket = Ticket(
        title=body.title,
        description=body.description,
        use_case=body.use_case,
        priority=body.priority or "medium",
        source=body.source or "web_dashboard",
        user_email=body.user_email,
        assigned_agent_id=body.assigned_agent_id,
        sla_deadline=deadline,
        sla_status="safe",
    )
    db.add(ticket)
    await db.flush()
    await _log_event(db, ticket.ticket_id, "ticket_created", agent.email, "agent",
                     {"title": ticket.title, "use_case": ticket.use_case})

    background_tasks.add_task(_trigger_ai_triage, str(ticket.ticket_id))

    await db.refresh(ticket, ["assigned_agent", "ai_resolutions"])
    return _ticket_to_dict(ticket)


async def _trigger_ai_triage(ticket_id: str):
    from app.services.ai.langchain_agent import triage_ticket
    try:
        await triage_ticket(ticket_id)
    except Exception:
        pass


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Ticket).options(
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.notes),
            selectinload(Ticket.ai_resolutions),
            selectinload(Ticket.attachments),
        ).where(Ticket.ticket_id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _ticket_detail_to_dict(ticket)


@router.patch("/{ticket_id}")
async def update_ticket(
    ticket_id: uuid.UUID,
    body: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Ticket).options(
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.ai_resolutions),
            selectinload(Ticket.notes),
        ).where(Ticket.ticket_id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    changes = {}
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(ticket, field, val)
        changes[field] = val

    if body.status in ("auto_resolved", "closed"):
        ticket.closed_at = datetime.utcnow()

    await _log_event(db, ticket_id, "ticket_updated", agent.email, "agent", changes)
    return _ticket_to_dict(ticket)


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(select(Ticket).where(Ticket.ticket_id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.delete(ticket)
    return {"success": True, "message": "Ticket deleted"}


@router.post("/{ticket_id}/resolve")
async def resolve_ticket(
    ticket_id: uuid.UUID,
    body: TicketResolveRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Ticket).options(
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.ai_resolutions),
        ).where(Ticket.ticket_id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = "auto_resolved"
    ticket.resolution_type = "manual" if body.force else "auto"
    ticket.closed_at = datetime.utcnow()

    if body.resolution_notes:
        note = TicketNote(
            ticket_id=ticket_id,
            note_type="resolution_summary",
            content=body.resolution_notes,
            created_by=agent.email,
        )
        db.add(note)

    await _log_event(db, ticket_id, "ticket_resolved", agent.email, "agent",
                     {"force": body.force, "resolution_type": ticket.resolution_type})
    background_tasks.add_task(_sync_to_freshservice, str(ticket_id), "resolved")
    return _ticket_to_dict(ticket)


@router.post("/{ticket_id}/escalate")
async def escalate_ticket(
    ticket_id: uuid.UUID,
    body: TicketEscalateRequest,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Ticket).options(
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.ai_resolutions),
        ).where(Ticket.ticket_id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = "escalated"
    ticket.priority = "high" if ticket.priority == "medium" else ticket.priority

    if body.reason:
        note = TicketNote(
            ticket_id=ticket_id,
            note_type="ai_context",
            content=f"Escalated: {body.reason}",
            created_by="system",
        )
        db.add(note)

    await _log_event(db, ticket_id, "ticket_escalated", agent.email, "agent",
                     {"reason": body.reason, "target_group": body.target_group})
    return _ticket_to_dict(ticket)


@router.get("/{ticket_id}/notes", response_model=list[TicketNoteOut])
async def get_notes(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(TicketNote).where(TicketNote.ticket_id == ticket_id).order_by(TicketNote.created_at)
    )
    return [TicketNoteOut.model_validate(n) for n in result.scalars().all()]


@router.post("/{ticket_id}/notes", response_model=TicketNoteOut, status_code=201)
async def add_note(
    ticket_id: uuid.UUID,
    body: TicketNoteCreate,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    note = TicketNote(
        ticket_id=ticket_id,
        note_type=body.note_type or "human_note",
        content=body.content,
        created_by=body.created_by or agent.email,
    )
    db.add(note)
    await db.flush()
    return TicketNoteOut.model_validate(note)


@router.get("/{ticket_id}/timeline")
async def get_timeline(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(AuditLog).where(AuditLog.ticket_id == ticket_id).order_by(AuditLog.created_at)
    )
    logs = result.scalars().all()
    return [
        {
            "log_id": str(l.log_id),
            "event_type": l.event_type,
            "actor": l.actor,
            "actor_type": l.actor_type,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


def _ticket_to_dict(t: Ticket) -> dict:
    conf = t.confidence_score_float if hasattr(t, 'confidence_score_float') else None
    return {
        "ticket_id": str(t.ticket_id),
        "freshservice_ticket_id": t.freshservice_ticket_id,
        "title": t.title,
        "description": t.description,
        "use_case": t.use_case,
        "status": t.status,
        "priority": t.priority,
        "sla_deadline": t.sla_deadline.isoformat() if t.sla_deadline else None,
        "sla_status": t.sla_status,
        "sla_breach_predicted": t.sla_breach_predicted or False,
        "source": t.source,
        "user_email": t.user_email,
        "assigned_agent_id": str(t.assigned_agent_id) if t.assigned_agent_id else None,
        "assigned_agent_name": t.assigned_agent.full_name if t.assigned_agent else None,
        "resolution_type": t.resolution_type,
        "confidence_score": conf,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
    }


def _ticket_detail_to_dict(t: Ticket) -> dict:
    base = _ticket_to_dict(t)
    ai_res = None
    if t.ai_resolutions:
        r = t.ai_resolutions[-1]
        ai_res = {
            "resolution_id": str(r.resolution_id),
            "ticket_id": str(r.ticket_id),
            "intent_detected": r.intent_detected,
            "root_cause": r.root_cause,
            "confidence_score": r.confidence_score or 0,
            "intent_clarity_score": r.intent_clarity_score,
            "sop_match_score": r.sop_match_score,
            "historical_success_score": r.historical_success_score,
            "input_completeness_score": r.input_completeness_score,
            "decision": r.decision,
            "resolution_steps": r.resolution_steps or [],
            "execution_status": r.execution_status,
            "execution_output": r.execution_output,
            "time_taken_seconds": r.time_taken_seconds,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
    base["ai_resolution"] = ai_res
    base["notes"] = [
        {
            "note_id": str(n.note_id),
            "ticket_id": str(n.ticket_id),
            "note_type": n.note_type,
            "content": n.content,
            "created_by": n.created_by,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in (t.notes or [])
    ]
    return base


async def _sync_to_freshservice(ticket_id: str, status: str):
    from app.services.integrations.freshservice import FreshserviceClient
    try:
        client = FreshserviceClient()
        await client.update_ticket_status(ticket_id, status)
    except Exception:
        pass
