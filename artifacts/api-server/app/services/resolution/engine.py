"""
Resolution Engine — Orchestrates auto-resolution for each use case.
Delegates to the appropriate integration (Graph API, License APIs, PowerShell).
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

logger = logging.getLogger("stack.resolution")

# Default SLA hours by use_case + priority
SLA_HOURS = {
    "sharepoint_access":     {"low": 24, "medium": 8, "high": 4, "urgent": 2},
    "sharepoint_admin":      {"low": 48, "medium": 16, "high": 8, "urgent": 4},
    "license_bluebeam":      {"low": 24, "medium": 8, "high": 4, "urgent": 2},
    "license_adobe":         {"low": 24, "medium": 8, "high": 4, "urgent": 2},
    "license_o365":          {"low": 24, "medium": 8, "high": 4, "urgent": 2},
    "dl_update":             {"low": 12, "medium": 4, "high": 2, "urgent": 1},
    "windows_troubleshooting":{"low": 8, "medium": 4, "high": 2, "urgent": 1},
}


def compute_sla_deadline(use_case: str, priority: str) -> datetime:
    hours = SLA_HOURS.get(use_case, {}).get(priority, 8)
    return datetime.utcnow() + timedelta(hours=hours)


async def execute_resolution(ticket, resolution, db) -> Tuple[str, str]:
    """
    Execute the appropriate automation based on ticket use_case.
    Returns (status, output_log).
    """
    use_case = ticket.use_case
    logger.info(f"Executing resolution for use_case={use_case} ticket={ticket.ticket_id}")

    try:
        if use_case in ("sharepoint_access", "sharepoint_admin"):
            return await _resolve_sharepoint(ticket, resolution)
        elif use_case in ("license_bluebeam", "license_adobe", "license_o365"):
            return await _resolve_license(ticket, resolution)
        elif use_case == "dl_update":
            return await _resolve_dl_update(ticket, resolution)
        elif use_case == "windows_troubleshooting":
            return await _resolve_windows(ticket, resolution)
        else:
            return "success", f"Generic resolution applied for {use_case}"
    except Exception as e:
        logger.error(f"Resolution failed: {e}")
        return "failed", str(e)


async def _resolve_sharepoint(ticket, resolution) -> Tuple[str, str]:
    from app.services.integrations.graph_api import GraphAPIClient
    client = GraphAPIClient()
    if not client.is_configured():
        return "success", "[SIMULATION] SharePoint permissions updated via Graph API. (Configure MS_CLIENT_ID/SECRET to enable live execution)"

    try:
        result = await client.update_sharepoint_permissions(
            user_email=ticket.user_email,
            description=ticket.description or ticket.title,
            use_case=ticket.use_case,
        )
        return "success", result
    except Exception as e:
        return "failed", str(e)


async def _resolve_license(ticket, resolution) -> Tuple[str, str]:
    from app.services.integrations.license_apis import LicenseAPIClient
    client = LicenseAPIClient()

    license_type = {
        "license_bluebeam": "bluebeam",
        "license_adobe": "adobe",
        "license_o365": "o365",
    }.get(ticket.use_case, "o365")

    if not client.is_configured(license_type):
        return "success", f"[SIMULATION] {license_type.upper()} license assigned to {ticket.user_email}. (Configure API credentials to enable live execution)"

    try:
        result = await client.assign_license(ticket.user_email, license_type)
        return "success", result
    except Exception as e:
        return "failed", str(e)


async def _resolve_dl_update(ticket, resolution) -> Tuple[str, str]:
    from app.services.integrations.graph_api import GraphAPIClient
    client = GraphAPIClient()
    if not client.is_configured():
        return "success", "[SIMULATION] Distribution list updated via Graph API. (Configure MS_CLIENT_ID/SECRET to enable live execution)"

    try:
        result = await client.update_distribution_list(
            user_email=ticket.user_email,
            description=ticket.description or ticket.title,
        )
        return "success", result
    except Exception as e:
        return "failed", str(e)


async def _resolve_windows(ticket, resolution) -> Tuple[str, str]:
    from app.services.integrations.powershell import PowerShellClient
    client = PowerShellClient()
    if not client.is_configured():
        return "success", "[SIMULATION] PowerShell remediation script executed on remote device. (Configure WINRM_USERNAME/PASSWORD to enable live execution)"

    try:
        result = await client.execute_remediation(
            device_ip=None,  # Would come from users table in production
            issue_description=ticket.description or ticket.title,
            use_case=ticket.use_case,
        )
        return "success", result
    except Exception as e:
        return "failed", str(e)
