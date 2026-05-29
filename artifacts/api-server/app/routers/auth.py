import base64
import hashlib
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.agents import Agent
from app.schemas.agents import LoginRequest, LoginResponse, AgentOut
from app.middleware.auth import get_current_agent

router = APIRouter()


def make_token(agent_id: str) -> str:
    payload = f"{agent_id}:{datetime.utcnow().isoformat()}"
    return base64.b64encode(payload.encode()).decode()


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Agent).where(Agent.email == body.email, Agent.is_active == True)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Demo mode: accept any password
    token = make_token(str(agent.agent_id))
    return LoginResponse(token=token, agent=AgentOut.model_validate(agent))


@router.get("/me", response_model=AgentOut)
async def me(agent: Agent = Depends(get_current_agent)):
    return AgentOut.model_validate(agent)
