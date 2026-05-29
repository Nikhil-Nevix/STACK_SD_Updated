import uuid
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.config import ConfidenceThreshold, SLAConfig
from app.models.agents import Agent, AgentGroup, AgentGroupMember
from app.schemas.agents import AgentOut, AgentCreate, AgentUpdate, AgentGroupOut, AgentGroupUpdate
from app.middleware.auth import get_current_agent, require_admin

router = APIRouter()


# --- Confidence Thresholds ---

@router.get("/thresholds")
async def get_thresholds(db: AsyncSession = Depends(get_db), agent=Depends(get_current_agent)):
    result = await db.execute(select(ConfidenceThreshold))
    thresholds = result.scalars().all()
    return [
        {
            "threshold_id": str(t.threshold_id),
            "use_case": t.use_case,
            "auto_resolve_min": t.auto_resolve_min,
            "review_after_min": t.review_after_min,
            "updated_at": t.updated_at,
        }
        for t in thresholds
    ]


@router.patch("/thresholds/{threshold_id}")
async def update_threshold(
    threshold_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_admin),
):
    result = await db.execute(select(ConfidenceThreshold).where(ConfidenceThreshold.threshold_id == threshold_id))
    threshold = result.scalar_one_or_none()
    if not threshold:
        raise HTTPException(404, "Threshold not found")
    if "auto_resolve_min" in body:
        threshold.auto_resolve_min = float(body["auto_resolve_min"])
    if "review_after_min" in body:
        threshold.review_after_min = float(body["review_after_min"])
    threshold.updated_by = agent.agent_id
    return {"success": True}


# --- SLA Configs ---

@router.get("/sla-configs")
async def get_sla_configs(db: AsyncSession = Depends(get_db), agent=Depends(get_current_agent)):
    result = await db.execute(select(SLAConfig))
    configs = result.scalars().all()
    return [
        {
            "sla_id": str(c.sla_id),
            "use_case": c.use_case,
            "priority": c.priority,
            "resolution_hours": c.resolution_hours,
            "warning_threshold_percent": c.warning_threshold_percent,
            "updated_at": c.updated_at,
        }
        for c in configs
    ]


@router.patch("/sla-configs/{sla_id}")
async def update_sla_config(
    sla_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_admin),
):
    result = await db.execute(select(SLAConfig).where(SLAConfig.sla_id == sla_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(404, "SLA config not found")
    for field in ("resolution_hours", "warning_threshold_percent"):
        if field in body:
            setattr(config, field, body[field])
    return {"success": True}


# --- Agent Groups ---

@router.get("/groups")
async def get_groups(db: AsyncSession = Depends(get_db), agent=Depends(get_current_agent)):
    result = await db.execute(
        select(AgentGroup).options(
            selectinload(AgentGroup.members).selectinload(AgentGroupMember.agent)
        )
    )
    groups = result.scalars().all()
    return [AgentGroupOut.model_validate(g) for g in groups]


@router.patch("/groups/{group_id}")
async def update_group(
    group_id: uuid.UUID,
    body: AgentGroupUpdate,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_admin),
):
    result = await db.execute(select(AgentGroup).where(AgentGroup.group_id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Group not found")
    if body.assignment_mode:
        group.assignment_mode = body.assignment_mode
    if body.group_name:
        group.group_name = body.group_name
    return {"success": True}


# --- Agents ---

@router.get("/agents")
async def list_agents(db: AsyncSession = Depends(get_db), agent=Depends(get_current_agent)):
    result = await db.execute(select(Agent))
    agents = result.scalars().all()
    return [AgentOut.model_validate(a) for a in agents]


@router.post("/agents", response_model=AgentOut, status_code=201)
async def create_agent(
    body: AgentCreate,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_admin),
):
    pw_hash = hashlib.sha256(body.password.encode()).hexdigest()
    new_agent = Agent(
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        password_hash=pw_hash,
        freshservice_agent_id=body.freshservice_agent_id,
    )
    db.add(new_agent)
    await db.flush()
    return AgentOut.model_validate(new_agent)


@router.patch("/agents/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: uuid.UUID,
    body: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_agent=Depends(require_admin),
):
    result = await db.execute(select(Agent).where(Agent.agent_id == agent_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Agent not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(target, field, val)
    return AgentOut.model_validate(target)
