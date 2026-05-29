"""
Freshservice REST API v2 Integration.
Handles ticket creation, status updates, note attachment, and group assignment.
Activates when FRESHSERVICE_DOMAIN and FRESHSERVICE_API_KEY are set.
"""
import logging
import httpx
import base64
from typing import Optional

logger = logging.getLogger("stack.freshservice")


class FreshserviceClient:
    def __init__(self):
        from app.config import get_settings
        s = get_settings()
        self.domain = s.freshservice_domain
        self.api_key = s.freshservice_api_key
        self.base_url = f"https://{self.domain}/api/v2" if self.domain else ""
        auth = base64.b64encode(f"{self.api_key}:X".encode()).decode()
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth}",
        }

    def is_configured(self) -> bool:
        return bool(self.domain and self.api_key)

    async def create_ticket(self, title: str, description: str, email: str, priority: int = 2, group_id: Optional[int] = None) -> dict:
        if not self.is_configured():
            logger.info("[SIMULATION] Freshservice: create_ticket skipped (not configured)")
            return {"id": 0, "simulated": True}

        payload = {
            "subject": title,
            "description": description,
            "email": email,
            "priority": priority,
            "status": 2,  # Open
        }
        if group_id:
            payload["group_id"] = group_id

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{self.base_url}/tickets", json=payload, headers=self.headers)
            resp.raise_for_status()
            return resp.json().get("ticket", {})

    async def update_ticket_status(self, freshservice_ticket_id: str, status: str) -> dict:
        if not self.is_configured() or not freshservice_ticket_id:
            return {"simulated": True}

        status_map = {"open": 2, "in_progress": 3, "auto_resolved": 4, "closed": 5, "escalated": 3}
        fs_status = status_map.get(status, 2)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(
                f"{self.base_url}/tickets/{freshservice_ticket_id}",
                json={"status": fs_status},
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def add_note(self, freshservice_ticket_id: str, body: str, private: bool = True) -> dict:
        if not self.is_configured() or not freshservice_ticket_id:
            return {"simulated": True}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{self.base_url}/tickets/{freshservice_ticket_id}/notes",
                json={"body": body, "private": private},
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def add_ai_note(self, ticket_id: str, resolution) -> None:
        """Attach AI resolution summary to Freshservice ticket."""
        from app.database import AsyncSessionLocal
        from app.models.tickets import Ticket
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Ticket).where(Ticket.ticket_id == ticket_id))
            ticket = result.scalar_one_or_none()
            if not ticket or not ticket.freshservice_ticket_id:
                return

        note_body = (
            f"<b>STACK AI Resolution</b><br>"
            f"Decision: {resolution.decision}<br>"
            f"Confidence: {round((resolution.confidence_score or 0) * 100, 1)}%<br>"
            f"Intent: {resolution.intent_detected}<br>"
            f"Root Cause: {resolution.root_cause}<br>"
            f"Execution Status: {resolution.execution_status}<br>"
        )
        await self.add_note(ticket.freshservice_ticket_id, note_body, private=True)

    async def assign_to_group(self, freshservice_ticket_id: str, group_id: int) -> dict:
        if not self.is_configured():
            return {"simulated": True}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(
                f"{self.base_url}/tickets/{freshservice_ticket_id}",
                json={"group_id": group_id, "status": 3},
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_ticket(self, freshservice_ticket_id: str) -> dict:
        if not self.is_configured():
            return {"simulated": True, "id": freshservice_ticket_id}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/tickets/{freshservice_ticket_id}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json().get("ticket", {})
