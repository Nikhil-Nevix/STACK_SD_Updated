import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.ai import SOP
from app.schemas.sops import SOPOut, SOPCreate, SOPUpdate, SOPSearchRequest
from app.middleware.auth import get_current_agent

router = APIRouter()


@router.get("", response_model=list[SOPOut])
async def list_sops(
    use_case: str = None,
    is_active: bool = None,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    q = select(SOP).order_by(SOP.created_at.desc())
    if use_case:
        q = q.where(SOP.use_case == use_case)
    if is_active is not None:
        q = q.where(SOP.is_active == is_active)
    result = await db.execute(q)
    return [SOPOut.model_validate(s) for s in result.scalars().all()]


@router.post("", response_model=SOPOut, status_code=201)
async def create_sop(
    body: SOPCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    sop = SOP(**body.model_dump())
    db.add(sop)
    await db.flush()
    background_tasks.add_task(_embed_sop, str(sop.sop_id))
    return SOPOut.model_validate(sop)


@router.post("/search")
async def search_sops(
    body: SOPSearchRequest,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    from app.services.ai.rag_pipeline import search_sops_semantic
    results = await search_sops_semantic(body.query, body.use_case, body.limit, db)
    return results


@router.get("/{sop_id}", response_model=SOPOut)
async def get_sop(
    sop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    result = await db.execute(select(SOP).where(SOP.sop_id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(404, "SOP not found")
    return SOPOut.model_validate(sop)


@router.patch("/{sop_id}", response_model=SOPOut)
async def update_sop(
    sop_id: uuid.UUID,
    body: SOPUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    result = await db.execute(select(SOP).where(SOP.sop_id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(404, "SOP not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(sop, field, val)
    if body.content:
        background_tasks.add_task(_embed_sop, str(sop_id))
    return SOPOut.model_validate(sop)


@router.delete("/{sop_id}", status_code=204)
async def delete_sop(
    sop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    agent=Depends(get_current_agent),
):
    result = await db.execute(select(SOP).where(SOP.sop_id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(404, "SOP not found")
    await db.delete(sop)


async def _embed_sop(sop_id: str):
    from app.services.ai.rag_pipeline import embed_sop
    try:
        await embed_sop(sop_id)
    except Exception:
        pass
