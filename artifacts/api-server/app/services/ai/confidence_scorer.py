"""
Confidence Scorer — 4-factor weighted scoring as per STACK documentation:
  - Intent Clarity:       30%
  - SOP Match:            35%
  - Historical Success:   25%
  - Input Completeness:   10%
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class ConfidenceResult:
    total_score: float          # 0.0 - 1.0
    intent_clarity: float
    sop_match: float
    historical_success: float
    input_completeness: float
    decision: str               # auto_resolve | review_after | escalate
    auto_resolve_threshold: float = 0.85
    review_threshold: float = 0.60


REQUIRED_FIELDS_BY_USE_CASE = {
    "sharepoint_access": ["user_email", "description"],
    "sharepoint_admin": ["user_email", "description"],
    "license_bluebeam": ["user_email", "description"],
    "license_adobe": ["user_email", "description"],
    "license_o365": ["user_email", "description"],
    "dl_update": ["user_email", "description"],
    "windows_troubleshooting": ["user_email", "description"],
}

KNOWN_INTENTS = {
    "sharepoint_access": ["grant access", "revoke access", "permission", "site access", "sharepoint"],
    "sharepoint_admin": ["create site", "settings", "ownership", "admin", "transfer"],
    "license_bluebeam": ["bluebeam", "license", "install bluebeam"],
    "license_adobe": ["adobe", "creative cloud", "acrobat"],
    "license_o365": ["office 365", "o365", "microsoft office", "word", "excel"],
    "dl_update": ["distribution list", "mailing list", "dl", "add member", "remove member"],
    "windows_troubleshooting": ["windows", "password", "printer", "slow", "disk", "software", "install", "network"],
}


def compute_intent_clarity(text: str, use_case: str) -> float:
    """Score how clearly the text matches the use case intent."""
    text_lower = text.lower()
    keywords = KNOWN_INTENTS.get(use_case, [])
    if not keywords:
        return 0.5
    matches = sum(1 for kw in keywords if kw in text_lower)
    return min(1.0, matches / max(len(keywords) * 0.4, 1))


def compute_input_completeness(ticket_data: dict, use_case: str) -> float:
    """Check that required fields are populated."""
    required = REQUIRED_FIELDS_BY_USE_CASE.get(use_case, ["user_email"])
    present = sum(1 for f in required if ticket_data.get(f))
    return present / len(required) if required else 1.0


def compute_confidence(
    text: str,
    use_case: str,
    ticket_data: dict,
    sop_match_score: float = 0.5,
    historical_success_rate: float = 0.7,
    auto_resolve_threshold: float = 0.85,
    review_threshold: float = 0.60,
) -> ConfidenceResult:
    intent_clarity = compute_intent_clarity(text, use_case)
    input_completeness = compute_input_completeness(ticket_data, use_case)

    total = (
        intent_clarity * 0.30
        + sop_match_score * 0.35
        + historical_success_rate * 0.25
        + input_completeness * 0.10
    )
    total = min(1.0, max(0.0, total))

    if total >= auto_resolve_threshold:
        decision = "auto_resolve"
    elif total >= review_threshold:
        decision = "review_after"
    else:
        decision = "escalate"

    return ConfidenceResult(
        total_score=round(total, 4),
        intent_clarity=round(intent_clarity, 4),
        sop_match=round(sop_match_score, 4),
        historical_success=round(historical_success_rate, 4),
        input_completeness=round(input_completeness, 4),
        decision=decision,
        auto_resolve_threshold=auto_resolve_threshold,
        review_threshold=review_threshold,
    )
