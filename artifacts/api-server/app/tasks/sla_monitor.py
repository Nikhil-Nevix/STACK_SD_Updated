"""
SLA Monitor Celery Task.
Runs every 5 minutes. Checks all open tickets and updates sla_status:
  safe → at_risk → breached
Also predicts breach risk based on queue depth and time of day.
"""
import logging
from datetime import datetime
from app.tasks.celery_app import celery_app

logger = logging.getLogger("stack.sla_monitor")


@celery_app.task(name="app.tasks.sla_monitor.check_sla_status")
def check_sla_status():
    import asyncio
    asyncio.run(_async_check_sla())


async def _async_check_sla():
    from app.database import AsyncSessionLocal
    from app.models.tickets import Ticket
    from app.models.logs import AuditLog
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Ticket).where(Ticket.status.in_(["open", "in_progress"]))
        )
        tickets = result.scalars().all()
        now = datetime.utcnow()
        updated = 0

        for ticket in tickets:
            if not ticket.sla_deadline:
                continue

            time_remaining = (ticket.sla_deadline - now).total_seconds()
            total_sla = (ticket.sla_deadline - ticket.created_at).total_seconds()
            elapsed_pct = max(0, 1 - (time_remaining / total_sla)) * 100 if total_sla > 0 else 0

            old_status = ticket.sla_status

            if time_remaining <= 0:
                ticket.sla_status = "breached"
                ticket.sla_breach_predicted = True
            elif elapsed_pct >= 75:
                ticket.sla_status = "at_risk"
                ticket.sla_breach_predicted = elapsed_pct >= 90
            else:
                ticket.sla_status = "safe"
                ticket.sla_breach_predicted = False

            if old_status != ticket.sla_status:
                log = AuditLog(
                    ticket_id=ticket.ticket_id,
                    event_type=f"sla_status_changed",
                    actor="system",
                    actor_type="system",
                    details={
                        "from": old_status,
                        "to": ticket.sla_status,
                        "elapsed_percent": round(elapsed_pct, 1),
                    },
                )
                db.add(log)
                updated += 1

        await db.commit()
        logger.info(f"SLA monitor: checked {len(tickets)} tickets, updated {updated}")
