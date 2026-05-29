"""
LangChain AI Agent — Core intelligence engine.
Uses Azure OpenAI GPT-4o + RAG pipeline for intent detection,
root cause analysis, confidence scoring, and auto-resolution decisions.
Falls back to rule-based logic when AI keys are not configured.
"""
import logging
import uuid
from typing import Optional
from datetime import datetime

logger = logging.getLogger("stack.ai")


async def triage_ticket(ticket_id: str):
    """
    Full AI triage pipeline for a ticket.
    1. Load ticket from DB
    2. Detect intent + root cause
    3. Retrieve relevant SOP via RAG
    4. Score confidence
    5. Decide: auto_resolve | review_after | escalate
    6. Execute resolution if confident
    7. Log AI resolution record
    """
    from app.database import AsyncSessionLocal
    from app.models.tickets import Ticket, TicketNote
    from app.models.ai import AIResolution
    from app.models.logs import AuditLog
    from app.models.config import ConfidenceThreshold
    from app.services.ai.rag_pipeline import find_best_sop
    from app.services.ai.confidence_scorer import compute_confidence
    from app.services.resolution.engine import execute_resolution
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Ticket).where(Ticket.ticket_id == uuid.UUID(ticket_id)))
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        # Get configurable thresholds for this use case
        thresh_result = await db.execute(
            select(ConfidenceThreshold).where(ConfidenceThreshold.use_case == ticket.use_case)
        )
        threshold = thresh_result.scalar_one_or_none()
        auto_min = threshold.auto_resolve_min / 100 if threshold else 0.85
        review_min = threshold.review_after_min / 100 if threshold else 0.60

        ticket_text = f"{ticket.title}\n{ticket.description or ''}"
        ticket_data = {"user_email": ticket.user_email, "description": ticket.description}

        # RAG: find best SOP
        sop, sop_score = await find_best_sop(ticket_text, ticket.use_case, db)

        # Get historical success rate for this use case
        from sqlalchemy import func
        from app.models.ai import AIResolution as AIRes
        hist = await db.execute(
            select(
                func.count(AIRes.resolution_id).label("total"),
                func.sum(
                    func.case((AIRes.execution_status == "success", 1), else_=0)
                ).label("success")
            ).where(AIRes.ticket_id.in_(
                select(Ticket.ticket_id).where(Ticket.use_case == ticket.use_case)
            ))
        )
        hist_row = hist.one()
        historical_rate = (
            (hist_row.success or 0) / hist_row.total if hist_row.total and hist_row.total > 0 else 0.7
        )

        # Compute confidence
        conf = compute_confidence(
            text=ticket_text,
            use_case=ticket.use_case,
            ticket_data=ticket_data,
            sop_match_score=sop_score,
            historical_success_rate=historical_rate,
            auto_resolve_threshold=auto_min,
            review_threshold=review_min,
        )

        # Use LLM for richer intent + root cause if available
        intent, root_cause, resolution_steps = await _llm_analyze(ticket_text, ticket.use_case, sop)

        # Create AI resolution record
        resolution = AIResolution(
            ticket_id=ticket.ticket_id,
            intent_detected=intent,
            root_cause=root_cause,
            sop_matched=sop.sop_id if sop else None,
            confidence_score=conf.total_score,
            intent_clarity_score=conf.intent_clarity,
            sop_match_score=conf.sop_match,
            historical_success_score=conf.historical_success,
            input_completeness_score=conf.input_completeness,
            decision=conf.decision,
            resolution_steps=resolution_steps,
        )
        db.add(resolution)

        # Update ticket
        ticket.confidence_score = conf.total_score
        ticket.status = "in_progress"

        # Execute resolution or escalate
        if conf.decision in ("auto_resolve", "review_after"):
            exec_status, exec_output = await execute_resolution(ticket, resolution, db)
            resolution.execution_status = exec_status
            resolution.execution_output = exec_output
            if exec_status == "success":
                ticket.status = "auto_resolved"
                ticket.resolution_type = "auto"
                ticket.closed_at = datetime.utcnow()
                # Add resolution summary note
                note = TicketNote(
                    ticket_id=ticket.ticket_id,
                    note_type="resolution_summary",
                    content=f"AI auto-resolved. Decision: {conf.decision}. "
                            f"Confidence: {round(conf.total_score * 100, 1)}%. "
                            f"SOP: {sop.title if sop else 'N/A'}. "
                            f"Output: {exec_output[:500] if exec_output else 'No output'}",
                    created_by="ai",
                )
                db.add(note)
            elif conf.decision == "review_after":
                ticket.status = "auto_resolved"
                ticket.resolution_type = "auto"
                ticket.closed_at = datetime.utcnow()
        else:
            # Escalate
            from app.services.resolution.escalation import escalate_to_group
            await escalate_to_group(ticket, conf, sop, db)

        # Audit log
        log = AuditLog(
            ticket_id=ticket.ticket_id,
            event_type="ai_triage_complete",
            actor="ai",
            actor_type="ai",
            details={
                "decision": conf.decision,
                "confidence": conf.total_score,
                "sop": sop.title if sop else None,
            },
        )
        db.add(log)

        # Sync to Freshservice
        from app.services.integrations.freshservice import FreshserviceClient
        try:
            client = FreshserviceClient()
            await client.add_ai_note(str(ticket.ticket_id), resolution)
        except Exception:
            pass

        await db.commit()
        logger.info(f"Triage complete for {ticket_id}: {conf.decision} ({conf.total_score:.0%})")


async def _llm_analyze(text: str, use_case: str, sop) -> tuple[str, str, list]:
    """Use GPT-4o via LangChain for deep analysis. Falls back to rule-based."""
    from app.config import get_settings
    settings = get_settings()

    if not settings.ai_enabled:
        return _rule_based_intent(use_case), _rule_based_root_cause(use_case), []

    try:
        from langchain_openai import AzureChatOpenAI
        from langchain.schema import HumanMessage, SystemMessage

        llm = AzureChatOpenAI(
            azure_deployment=settings.azure_openai_deployment,
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
            temperature=0,
            max_tokens=500,
        )

        sop_context = f"\n\nRelevant SOP:\n{sop.content[:800]}" if sop else ""
        prompt = f"""Analyze this IT service desk ticket and respond in JSON.

Ticket: {text}
Use Case: {use_case}{sop_context}

Respond ONLY with JSON:
{{
  "intent": "one-line intent summary",
  "root_cause": "root cause analysis",
  "resolution_steps": ["step 1", "step 2", "step 3"]
}}"""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        import json
        data = json.loads(response.content)
        return data.get("intent", ""), data.get("root_cause", ""), data.get("resolution_steps", [])
    except Exception as e:
        logger.warning(f"LLM analysis failed: {e}")
        return _rule_based_intent(use_case), _rule_based_root_cause(use_case), []


def _rule_based_intent(use_case: str) -> str:
    intents = {
        "sharepoint_access": "User requesting SharePoint site access modification",
        "sharepoint_admin": "SharePoint administrative operation requested",
        "license_bluebeam": "BlueBeam software license provisioning request",
        "license_adobe": "Adobe Creative Cloud license provisioning request",
        "license_o365": "Microsoft O365 license provisioning request",
        "dl_update": "O365 Distribution List update request",
        "windows_troubleshooting": "Windows device troubleshooting request",
    }
    return intents.get(use_case, "General IT service request")


def _rule_based_root_cause(use_case: str) -> str:
    causes = {
        "sharepoint_access": "User lacks required SharePoint permissions for the requested site/content",
        "sharepoint_admin": "Administrative configuration change required on SharePoint tenant",
        "license_bluebeam": "BlueBeam license not assigned to user account",
        "license_adobe": "Adobe Creative Cloud license not provisioned for user",
        "license_o365": "O365 license not assigned in Azure AD",
        "dl_update": "Distribution list membership requires modification in Exchange Online",
        "windows_troubleshooting": "Windows device experiencing technical issue requiring automated remediation",
    }
    return causes.get(use_case, "IT service request requires processing")
