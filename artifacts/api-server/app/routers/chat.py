from fastapi import APIRouter, Depends, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, GoogleChatWebhookEvent
from app.middleware.auth import optional_auth

router = APIRouter()


@router.post("/message", response_model=ChatMessageResponse)
async def handle_message(
    body: ChatMessageRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    agent=Depends(optional_auth),
):
    from app.services.chat.conversation import handle_conversation
    return await handle_conversation(body, db, agent)


@router.post("/google-webhook")
async def google_chat_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Google Chat event webhook endpoint."""
    event = await request.json()
    body = ChatMessageRequest(
        message=event.get("message", {}).get("text", ""),
        channel="google_chat",
        space_name=event.get("space", {}).get("name", ""),
        user_email=event.get("user", {}).get("email", ""),
    )
    from app.services.chat.conversation import handle_conversation
    result = await handle_conversation(body, db, None)
    # Google Chat expects a specific response format
    return {"text": result.reply}
