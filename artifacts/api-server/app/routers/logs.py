from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.logs import AuditLog, APICallLog, PowerShellExecution
from app.middleware.auth import get_current_agent

router = APIRouter()


@router.get("/audit")
async def get_audit_logs(
    event_type: Optional[str] = None,
    actor_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    q = select(AuditLog).order_by(AuditLog.created_at.desc())
    if event_type:
        q = q.where(AuditLog.event_type == event_type)
    if actor_type:
        q = q.where(AuditLog.actor_type == actor_type)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "log_id": str(l.log_id),
                "ticket_id": str(l.ticket_id) if l.ticket_id else None,
                "event_type": l.event_type,
                "actor": l.actor,
                "actor_type": l.actor_type,
                "details": l.details,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/api-calls")
async def get_api_logs(
    api_name: Optional[str] = None,
    status_code: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    q = select(APICallLog).order_by(APICallLog.called_at.desc())
    if api_name:
        q = q.where(APICallLog.api_name == api_name)
    if status_code:
        q = q.where(APICallLog.response_status == status_code)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "api_log_id": str(l.api_log_id),
                "ticket_id": str(l.ticket_id) if l.ticket_id else None,
                "api_name": l.api_name,
                "endpoint": l.endpoint,
                "method": l.method,
                "request_payload": l.request_payload,
                "response_status": l.response_status,
                "response_payload": l.response_payload,
                "duration_ms": l.duration_ms,
                "called_at": l.called_at.isoformat() if l.called_at else None,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/powershell")
async def get_powershell_logs(
    execution_status: Optional[str] = None,
    device_name: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    q = select(PowerShellExecution).order_by(PowerShellExecution.executed_at.desc())
    if execution_status:
        q = q.where(PowerShellExecution.execution_status == execution_status)
    if device_name:
        q = q.where(PowerShellExecution.device_name.ilike(f"%{device_name}%"))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    execs = result.scalars().all()

    return {
        "logs": [
            {
                "execution_id": str(e.execution_id),
                "ticket_id": str(e.ticket_id) if e.ticket_id else None,
                "resolution_id": str(e.resolution_id) if e.resolution_id else None,
                "device_name": e.device_name,
                "device_ip": e.device_ip,
                "script_name": e.script_name,
                "script_content": e.script_content,
                "execution_status": e.execution_status,
                "output_log": e.output_log,
                "executed_at": e.executed_at.isoformat() if e.executed_at else None,
                "duration_seconds": e.duration_seconds,
            }
            for e in execs
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }
