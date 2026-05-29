"""
Escalation Engine — Routes tickets to the appropriate agent group
based on use_case and assignment mode (round-robin, first-available, priority).
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.agents import AgentGroup, AgentGroupMember, Agent
from app.models.tickets import Ticket, TicketNote
from app.models.logs import AuditLog

logger = logging.getLogger("stack.escalation")

USE_CASE_GROUP_MAP = {
    "sharepoint_access": "SharePoint Support",
    "sharepoint_admin": "SharePoint Support",
    "license_bluebeam": "License Management",
    "license_adobe": "License Management",
    "license_o365": "License Management",
    "dl_update": "DL Management",
    "windows_troubleshooting": "L2 Windows Support",
}


async def escalate_to_group(ticket: Ticket, conf, sop, db: AsyncSession):
    """Escalate ticket to the appropriate agent group."""
    group_name = USE_CASE_GROUP_MAP.get(ticket.use_case, "SharePoint Support")

    result = await db.execute(
        select(AgentGroup).where(AgentGroup.group_name == group_name)
    )
    group = result.scalar_one_or_none()

    assigned_agent = None
    if group:
        assigned_agent = await _assign_agent(group, db)

    if assigned_agent:
        ticket.assigned_agent_id = assigned_agent.agent_id

    ticket.status = "escalated"
    ticket.priority = "high" if ticket.priority == "medium" else ticket.priority

    context_note = TicketNote(
        ticket_id=ticket.ticket_id,
        note_type="ai_context",
        content=(
            f"AI Escalation Report:\n"
            f"• Confidence Score: {round(conf.total_score * 100, 1)}% (below {round(conf.auto_resolve_threshold * 100)}% threshold)\n"
            f"• Intent Clarity: {round(conf.intent_clarity * 100, 1)}%\n"
            f"• SOP Match: {round(conf.sop_match * 100, 1)}%\n"
            f"• Historical Success: {round(conf.historical_success * 100, 1)}%\n"
            f"• Input Completeness: {round(conf.input_completeness * 100, 1)}%\n"
            f"• Best Matching SOP: {sop.title if sop else 'No SOP found'}\n"
            f"• Assigned Group: {group_name}\n"
            f"• Assigned Agent: {assigned_agent.full_name if assigned_agent else 'Unassigned'}\n\n"
            f"Recommended Actions:\n{sop.content[:500] if sop else 'Please review manually.'}"
        ),
        created_by="ai",
    )
    db.add(context_note)

    audit = AuditLog(
        ticket_id=ticket.ticket_id,
        event_type="ticket_escalated",
        actor="ai",
        actor_type="ai",
        details={
            "group": group_name,
            "assigned_agent": assigned_agent.email if assigned_agent else None,
            "confidence": conf.total_score,
        },
    )
    db.add(audit)
    logger.info(f"Ticket {ticket.ticket_id} escalated to {group_name} → {assigned_agent.email if assigned_agent else 'unassigned'}")


async def _assign_agent(group: AgentGroup, db: AsyncSession) -> Agent | None:
    """Pick an agent based on group assignment mode."""
    members_result = await db.execute(
        select(AgentGroupMember)
        .where(AgentGroupMember.group_id == group.group_id)
        .order_by(AgentGroupMember.priority_order)
    )
    members = members_result.scalars().all()
    if not members:
        return None

    agent_ids = [m.agent_id for m in members]

    if group.assignment_mode == "priority":
        # Assign to highest priority active agent
        for member in members:
            agent_result = await db.execute(
                select(Agent).where(Agent.agent_id == member.agent_id, Agent.is_active == True)
            )
            agent = agent_result.scalar_one_or_none()
            if agent:
                return agent

    elif group.assignment_mode == "first_available":
        # First active agent with fewest open tickets
        from app.models.tickets import Ticket as TicketModel
        least_tickets = None
        least_agent = None
        for agent_id in agent_ids:
            count = (await db.execute(
                select(func.count(TicketModel.ticket_id)).where(
                    TicketModel.assigned_agent_id == agent_id,
                    TicketModel.status.in_(["open", "in_progress"])
                )
            )).scalar_one()
            if least_tickets is None or count < least_tickets:
                least_tickets = count
                least_agent = agent_id

        if least_agent:
            result = await db.execute(select(Agent).where(Agent.agent_id == least_agent))
            return result.scalar_one_or_none()

    else:  # round_robin — pick agent with least recently assigned
        from app.models.tickets import Ticket as TicketModel
        result = await db.execute(
            select(Agent)
            .where(Agent.agent_id.in_(agent_ids), Agent.is_active == True)
            .limit(1)
        )
        return result.scalar_one_or_none()

    return None
