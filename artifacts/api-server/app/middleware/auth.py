import base64
import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.agents import Agent

security = HTTPBearer(auto_error=False)


async def get_current_agent(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Agent:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    try:
        decoded = base64.b64decode(credentials.credentials).decode()
        agent_id_str, _ = decoded.split(":", 1)
        agent_id = uuid.UUID(agent_id_str)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(Agent).where(Agent.agent_id == agent_id, Agent.is_active == True))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Agent not found or inactive")
    return agent


async def require_admin(agent: Agent = Depends(get_current_agent)) -> Agent:
    if agent.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return agent


async def optional_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[Agent]:
    if not credentials:
        return None
    try:
        return await get_current_agent(credentials, db)
    except HTTPException:
        return None
