"""
STACK Google Chat Bot — Webhook handler for Google Chat API.
Receives events from Google Chat, delegates to STACK API chat endpoint,
and returns formatted card responses.
"""
import os
import logging
import httpx
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("stack.chatbot")

app = FastAPI(title="STACK Google Chat Bot", version="1.0.0", root_path="")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STACK_API_URL = os.getenv("STACK_API_URL", "http://localhost:8080")
PORT = int(os.getenv("PORT", 9000))

router = APIRouter(prefix="/chatbot")


@router.get("/healthz")
async def health():
    return {"status": "ok", "service": "STACK Google Chat Bot"}


@router.post("")
@router.post("/webhook")
async def handle_event(request: Request):
    """Main Google Chat webhook endpoint."""
    try:
        event = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"text": "Invalid request"})

    event_type = event.get("type", "")
    logger.info(f"Received event type: {event_type}")

    if event_type == "ADDED_TO_SPACE":
        return _welcome_message()

    if event_type == "REMOVED_FROM_SPACE":
        logger.info("Bot removed from space")
        return JSONResponse(content={})

    if event_type == "MESSAGE":
        return await _handle_message(event)

    if event_type == "CARD_CLICKED":
        return await _handle_card_click(event)

    return JSONResponse(content={"text": "Event received"})


def _welcome_message():
    return JSONResponse(content={
        "cards": [{
            "header": {
                "title": "👋 STACK AI Service Desk",
                "subtitle": "Jade Global Software Pvt Ltd",
                "imageUrl": "https://img.icons8.com/color/96/robot-2.png",
                "imageStyle": "AVATAR"
            },
            "sections": [{
                "widgets": [{
                    "textParagraph": {
                        "text": "Hello! I'm the <b>STACK AI Assistant</b>. I can help you with:"
                    }
                }, {
                    "textParagraph": {
                        "text": "🔐 SharePoint access & admin\n📦 License requests (BlueBeam, Adobe, O365)\n📧 Distribution list updates\n🖥️ Windows troubleshooting"
                    }
                }, {
                    "buttons": [
                        {"textButton": {"text": "SharePoint Access", "onClick": {"action": {"actionMethodName": "use_case_selected", "parameters": [{"key": "use_case", "value": "sharepoint_access"}]}}}},
                        {"textButton": {"text": "License Request", "onClick": {"action": {"actionMethodName": "use_case_selected", "parameters": [{"key": "use_case", "value": "license"}]}}}},
                    ]
                }, {
                    "buttons": [
                        {"textButton": {"text": "DL Update", "onClick": {"action": {"actionMethodName": "use_case_selected", "parameters": [{"key": "use_case", "value": "dl_update"}]}}}},
                        {"textButton": {"text": "Windows Troubleshoot", "onClick": {"action": {"actionMethodName": "use_case_selected", "parameters": [{"key": "use_case", "value": "windows_troubleshooting"}]}}}},
                    ]
                }]
            }]
        }]
    })


async def _handle_message(event: dict):
    """Process a text message from Google Chat."""
    message = event.get("message", {})
    text = message.get("text", message.get("argumentText", "")).strip()
    sender = event.get("user", {})
    user_email = sender.get("email", "unknown@user.com")
    space = event.get("space", {})
    space_name = space.get("name", "")

    # Get or create session_id from space+user
    session_id = f"{space_name}_{user_email}".replace("/", "_").replace("@", "_at_")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{STACK_API_URL}/api/v1/chat/message",
                json={
                    "message": text,
                    "session_id": session_id,
                    "user_email": user_email,
                    "channel": "google_chat",
                    "space_name": space_name,
                },
            )
            result = resp.json()
    except Exception as e:
        logger.error(f"Failed to call STACK API: {e}")
        return JSONResponse(content={
            "text": "⚠️ STACK AI is temporarily unavailable. Please try again or contact IT support directly."
        })

    reply_text = result.get("reply", "I couldn't process your request.")
    ticket_id = result.get("ticket_id")
    state = result.get("state", "idle")
    quick_replies = result.get("quick_replies", [])

    # Build rich card response
    return _build_response_card(reply_text, ticket_id, state, quick_replies, user_email)


async def _handle_card_click(event: dict):
    """Handle button clicks on cards."""
    action = event.get("action", {})
    action_name = action.get("actionMethodName", "")
    params = {p["key"]: p["value"] for p in action.get("parameters", [])}

    user_email = event.get("user", {}).get("email", "unknown@user.com")
    space_name = event.get("space", {}).get("name", "")
    session_id = f"{space_name}_{user_email}".replace("/", "_").replace("@", "_at_")

    if action_name == "use_case_selected":
        use_case = params.get("use_case", "")
        message = f"I need help with {use_case.replace('_', ' ')}"
    elif action_name == "check_ticket":
        message = "Check my ticket status"
    elif action_name == "new_request":
        message = "I have a new request"
    else:
        message = "help"

    # Delegate to message handler
    synthetic_event = {
        "type": "MESSAGE",
        "message": {"text": message},
        "user": {"email": user_email},
        "space": {"name": space_name},
    }
    return await _handle_message(synthetic_event)


def _build_response_card(reply: str, ticket_id: str | None, state: str, quick_replies: list, user_email: str):
    """Build a formatted Google Chat card response."""
    widgets = [{"textParagraph": {"text": reply.replace("\n", "<br>").replace("**", "<b>").replace("**", "</b>")}}]

    if ticket_id:
        widgets.append({
            "keyValue": {
                "topLabel": "Ticket ID",
                "content": ticket_id[:8].upper(),
                "icon": "TICKET",
            }
        })

    buttons = []
    for qr in (quick_replies or [])[:4]:
        action_name = "new_request" if "new" in qr.lower() else "check_ticket" if "status" in qr.lower() or "check" in qr.lower() else "use_case_selected"
        buttons.append({
            "textButton": {
                "text": qr,
                "onClick": {
                    "action": {
                        "actionMethodName": action_name,
                        "parameters": [{"key": "use_case", "value": qr.lower().replace(" ", "_")}]
                    }
                }
            }
        })

    if buttons:
        widgets.append({"buttons": buttons[:2]})
        if len(buttons) > 2:
            widgets.append({"buttons": buttons[2:]})

    return JSONResponse(content={
        "cards": [{
            "header": {
                "title": "STACK AI Assistant",
                "subtitle": "Jade Global IT Service Desk",
                "imageUrl": "https://img.icons8.com/color/48/robot-2.png",
                "imageStyle": "AVATAR"
            },
            "sections": [{"widgets": widgets}]
        }]
    })


app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
