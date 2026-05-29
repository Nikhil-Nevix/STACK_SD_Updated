"""
Conversation Handler — manages stateful chat sessions for both
Web Dashboard and Google Chat Bot interactions.
Supports all 4 use cases through a guided conversation flow.
"""
import uuid
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.logs import ChatSession
from app.models.tickets import Ticket
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse

logger = logging.getLogger("stack.chat")

USE_CASE_KEYWORDS = {
    "sharepoint_access": ["sharepoint access", "sharepoint permission", "site access", "sp access"],
    "sharepoint_admin": ["sharepoint admin", "create site", "sp admin", "site settings", "ownership"],
    "license_bluebeam": ["bluebeam", "blue beam", "revu"],
    "license_adobe": ["adobe", "creative cloud", "acrobat", "photoshop"],
    "license_o365": ["office 365", "o365", "office license", "microsoft office", "word license", "excel license"],
    "dl_update": ["distribution list", "mailing list", "dl update", "add to dl", "remove from dl", "email group"],
    "windows_troubleshooting": ["password reset", "printer", "slow laptop", "slow pc", "disk space", "software install",
                                 "software uninstall", "network issue", "can't connect", "windows error"],
}

GREETING_RESPONSES = [
    "hello", "hi", "hey", "good morning", "good afternoon", "good evening",
]

GREETING_MESSAGE = """👋 Hello! I'm the **STACK AI Assistant** for Jade Global IT Service Desk.

I can help you with:
• 🔐 SharePoint access & admin requests
• 📦 License requests (BlueBeam, Adobe, O365)
• 📧 Distribution List updates
• 🖥️ Windows troubleshooting (password, printer, software, performance)

Please describe your issue and I'll get started right away!"""

COLLECTING_TEMPLATES = {
    "sharepoint_access": "I'll help with your SharePoint access request. Please provide:\n1. SharePoint site URL\n2. Your email address\n3. Type of access needed (view/edit/admin)",
    "sharepoint_admin": "I'll process your SharePoint admin request. Please provide:\n1. Site URL or name\n2. What change is needed\n3. Your email address",
    "license_bluebeam": "I'll provision your BlueBeam license. Please confirm:\n1. Your email address\n2. Department/project (optional)",
    "license_adobe": "I'll provision your Adobe Creative Cloud license. Please confirm:\n1. Your email address\n2. Which Adobe apps you need",
    "license_o365": "I'll provision your O365 license. Please confirm:\n1. Your email address\n2. License type needed (E1/E3/E5)",
    "dl_update": "I'll update the Distribution List. Please provide:\n1. DL name or email\n2. Action: add/remove/create/modify\n3. Member email(s)\n4. Your email",
    "windows_troubleshooting": "I'll troubleshoot your Windows issue. Please provide:\n1. Device name or hostname\n2. Detailed description of the issue\n3. When it started",
}


def _detect_use_case(text: str) -> Optional[str]:
    text_lower = text.lower()
    for use_case, keywords in USE_CASE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return use_case
    return None


def _is_greeting(text: str) -> bool:
    return any(text.lower().strip().startswith(g) for g in GREETING_RESPONSES)


async def handle_conversation(
    body: ChatMessageRequest,
    db: AsyncSession,
    current_agent,
) -> ChatMessageResponse:
    message = body.message.strip()
    session_id = body.session_id
    user_email = body.user_email or (current_agent.email if current_agent else "unknown@jgsl.com")

    # Load or create session
    session = None
    if session_id:
        try:
            result = await db.execute(
                select(ChatSession).where(ChatSession.session_id == uuid.UUID(session_id))
            )
            session = result.scalar_one_or_none()
        except Exception:
            pass

    if not session:
        session = ChatSession(
            user_email=user_email,
            channel=body.channel,
            space_name=body.space_name,
            messages=[],
            current_state="idle",
        )
        db.add(session)
        await db.flush()

    # Append user message
    messages = list(session.messages or [])
    messages.append({"role": "user", "content": message, "ts": datetime.utcnow().isoformat()})
    session.messages = messages
    session.updated_at = datetime.utcnow()

    # State machine
    reply, use_case, ticket_id, quick_replies = await _process_state(
        session, message, user_email, db
    )

    # Append assistant reply
    messages.append({"role": "assistant", "content": reply, "ts": datetime.utcnow().isoformat()})
    session.messages = messages

    await db.commit()

    return ChatMessageResponse(
        session_id=str(session.session_id),
        reply=reply,
        use_case=use_case or session.current_use_case,
        ticket_id=ticket_id,
        state=session.current_state,
        quick_replies=quick_replies,
    )


async def _process_state(session: ChatSession, message: str, user_email: str, db: AsyncSession):
    """State machine: idle → collecting → processing → resolved."""
    use_case = None
    ticket_id = None
    quick_replies = None

    if _is_greeting(message) and session.current_state == "idle":
        return GREETING_MESSAGE, None, None, [
            "SharePoint access", "License request", "DL update", "Windows issue"
        ]

    if session.current_state == "idle":
        use_case = _detect_use_case(message)
        if use_case:
            session.current_use_case = use_case
            session.current_state = "collecting"
            return COLLECTING_TEMPLATES[use_case], use_case, None, None
        else:
            return (
                "I couldn't identify the type of request. Could you describe your issue more specifically?\n\n"
                "Common requests: SharePoint access, BlueBeam/Adobe/O365 license, DL update, Windows troubleshooting.",
                None, None,
                ["SharePoint access", "License request", "DL update", "Windows issue"],
            )

    elif session.current_state == "collecting":
        # User has provided details — create ticket and trigger AI
        use_case = session.current_use_case
        session.current_state = "processing"

        ticket = await _create_ticket_from_chat(
            use_case=use_case,
            description=message,
            user_email=user_email,
            session_id=str(session.session_id),
            db=db,
        )
        session.ticket_id = ticket.ticket_id

        # Trigger AI triage
        from app.services.ai.langchain_agent import triage_ticket
        import asyncio
        asyncio.create_task(triage_ticket(str(ticket.ticket_id)))

        session.current_state = "resolved"
        ticket_id = str(ticket.ticket_id)
        return (
            f"✅ **Ticket created successfully!**\n\n"
            f"🎫 Ticket ID: `{str(ticket.ticket_id)[:8].upper()}`\n"
            f"📋 Use Case: {use_case.replace('_', ' ').title()}\n"
            f"🤖 AI is now processing your request...\n\n"
            f"You'll be notified once resolved. Is there anything else I can help you with?",
            use_case, ticket_id, ["Yes, new request", "Check ticket status"]
        )

    elif session.current_state == "resolved":
        if any(w in message.lower() for w in ["yes", "new", "another", "more"]):
            session.current_state = "idle"
            session.current_use_case = None
            return GREETING_MESSAGE, None, None, [
                "SharePoint access", "License request", "DL update", "Windows issue"
            ]
        elif any(w in message.lower() for w in ["status", "check", "update"]):
            if session.ticket_id:
                result = await db.execute(
                    select(Ticket).where(Ticket.ticket_id == session.ticket_id)
                )
                ticket = result.scalar_one_or_none()
                if ticket:
                    return (
                        f"📊 **Ticket Status Update**\n\n"
                        f"Status: **{ticket.status.replace('_', ' ').title()}**\n"
                        f"Priority: {ticket.priority.title()}\n"
                        f"SLA: {ticket.sla_status or 'safe'}\n"
                        f"Confidence: {round((ticket.confidence_score or 0) * 100, 1)}%",
                        None, str(ticket.ticket_id), None
                    )
            return "I couldn't find your ticket. Please contact the IT service desk directly.", None, None, None
        else:
            session.current_state = "idle"
            return "How else can I help you?", None, None, [
                "SharePoint access", "License request", "DL update", "Windows issue"
            ]

    return "I'm not sure how to help with that. Please describe your IT issue.", None, None, None


async def _create_ticket_from_chat(
    use_case: str,
    description: str,
    user_email: str,
    session_id: str,
    db: AsyncSession,
) -> Ticket:
    from app.services.resolution.engine import compute_sla_deadline

    title_map = {
        "sharepoint_access": "SharePoint Access Request",
        "sharepoint_admin": "SharePoint Admin Request",
        "license_bluebeam": "BlueBeam License Request",
        "license_adobe": "Adobe Creative Cloud License Request",
        "license_o365": "O365 License Request",
        "dl_update": "Distribution List Update Request",
        "windows_troubleshooting": "Windows Troubleshooting Request",
    }

    ticket = Ticket(
        title=title_map.get(use_case, "IT Service Request"),
        description=description,
        use_case=use_case,
        source="google_chat" if "google" in session_id.lower() else "web_dashboard",
        user_email=user_email,
        sla_deadline=compute_sla_deadline(use_case, "medium"),
        sla_status="safe",
    )
    db.add(ticket)
    await db.flush()
    return ticket
