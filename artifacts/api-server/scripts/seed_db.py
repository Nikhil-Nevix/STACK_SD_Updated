"""
Database seed script for STACK Service Desk.
Run: python scripts/seed_db.py
Creates: agents, tickets, SOPs, SLA configs, thresholds, ROI metrics, audit/API logs.
"""
import asyncio
import hashlib
import uuid
import sys
import os
from datetime import datetime, timedelta
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base, AsyncSessionLocal
from app.models.agents import Agent, AgentGroup, AgentGroupMember
from app.models.tickets import Ticket, TicketNote
from app.models.ai import SOP, AIResolution
from app.models.logs import AuditLog, APICallLog, PowerShellExecution
from app.models.config import SLAConfig, ConfidenceThreshold, ROIMetric

USE_CASES = [
    "sharepoint_access", "sharepoint_admin", "license_bluebeam",
    "license_adobe", "license_o365", "dl_update", "windows_troubleshooting"
]
PRIORITIES = ["low", "medium", "high", "urgent"]
STATUSES = ["open", "in_progress", "auto_resolved", "escalated", "closed"]


def pw_hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        print("Seeding agents...")
        agents_data = [
            ("admin@jgsl.com", "Admin User", "admin"),
            ("rajesh.kumar@jgsl.com", "Rajesh Kumar", "agent"),
            ("priya.sharma@jgsl.com", "Priya Sharma", "agent"),
            ("amit.patel@jgsl.com", "Amit Patel", "agent"),
            ("sunita.rao@jgsl.com", "Sunita Rao", "agent"),
        ]
        agents = []
        for email, name, role in agents_data:
            agent = Agent(
                email=email,
                full_name=name,
                role=role,
                password_hash=pw_hash("password123"),
                is_active=True,
            )
            db.add(agent)
            agents.append(agent)
        await db.flush()

        print("Seeding agent groups...")
        groups_data = [
            ("SharePoint Support", "sharepoint_access"),
            ("License Management", "license_o365"),
            ("DL Management", "dl_update"),
            ("L2 Windows Support", "windows_troubleshooting"),
        ]
        groups = []
        for name, uc in groups_data:
            group = AgentGroup(group_name=name, use_case=uc, assignment_mode="round_robin")
            db.add(group)
            groups.append(group)
        await db.flush()

        for i, group in enumerate(groups):
            for j, agent in enumerate(agents[1:]):  # skip admin
                member = AgentGroupMember(
                    group_id=group.group_id,
                    agent_id=agent.agent_id,
                    priority_order=j + 1,
                )
                db.add(member)

        print("Seeding SLA configs...")
        for uc in USE_CASES:
            for priority, hours in [("low", 24), ("medium", 8), ("high", 4), ("urgent", 2)]:
                config = SLAConfig(
                    use_case=uc,
                    priority=priority,
                    resolution_hours=hours,
                    warning_threshold_percent=75.0,
                )
                db.add(config)

        print("Seeding confidence thresholds...")
        for uc in USE_CASES:
            threshold = ConfidenceThreshold(
                use_case=uc,
                auto_resolve_min=85.0,
                review_after_min=60.0,
            )
            db.add(threshold)

        print("Seeding SOPs...")
        sops_data = [
            ("SharePoint Access Request SOP", "sharepoint_access",
             """## SharePoint Access Request Procedure

### Step 1: Verify User Identity
- Confirm the requester's email matches their AD account
- Check user's department and role in HR system

### Step 2: Identify Target Site
- Extract SharePoint site URL from the request
- Verify site owner and access control policy

### Step 3: Grant Access via Azure AD
Use the following PowerShell command:
```powershell
Add-SPOUser -Site https://tenant.sharepoint.com/sites/[SiteName] -LoginName [email] -Group "[Group Name]"
```

### Step 4: Verify and Notify
- Test access with the user's credentials
- Send confirmation email with access details
- Log the change in the change management system

### Resolution Time: 15-30 minutes
### Automated: YES (confidence ≥ 85%)"""),

            ("O365 License Provisioning SOP", "license_o365",
             """## O365 License Assignment Procedure

### Step 1: Identify License Requirements
- Determine which O365 SKU is needed (E1/E3/E5)
- Check available license pool in M365 Admin Center

### Step 2: Assign License via Graph API
```python
# Assign E3 license
client.assign_o365_license(user_email, "6fd2c87f-b296-42f0-b197-1e91e994b900")
```

### Step 3: Validate Services Activation
- Confirm Exchange Online mailbox creation (may take up to 30 min)
- Verify Teams provisioning
- Check SharePoint allocation

### Step 4: User Notification
- Send welcome email with setup instructions
- Include self-service portal URL

### Resolution Time: 10-20 minutes
### Automated: YES (confidence ≥ 85%)"""),

            ("BlueBeam License Assignment SOP", "license_bluebeam",
             """## BlueBeam Revu License Assignment

### Step 1: Check License Availability
- Log into BlueBeam Admin Portal
- Confirm available seat count

### Step 2: Add User to BlueBeam
```http
POST https://api.bluebeam.com/v1/users
{email: "[user@domain.com]", product: "Revu"}
```

### Step 3: Send Download Link
- User receives auto-email from BlueBeam
- Include IT support contact for installation issues

### Step 4: Confirm Installation
- Follow up after 24 hours to confirm successful activation

### Resolution Time: 5-10 minutes
### Automated: YES (confidence ≥ 85%)"""),

            ("Distribution List Update SOP", "dl_update",
             """## Distribution List Modification Procedure

### Step 1: Parse Request
- Identify DL name or email address
- Determine action: add/remove/create
- List all target email addresses

### Step 2: Execute via Graph API
```python
# Add member
client.update_distribution_list(user_email, description)
```

### Step 3: Verify Changes
- Send test email to the DL
- Confirm all recipients receive the message

### Step 4: Document
- Log change in AD change management system
- Notify affected parties

### Resolution Time: 5-10 minutes
### Automated: YES (confidence ≥ 85%)"""),

            ("Windows Troubleshooting SOP", "windows_troubleshooting",
             """## Windows Device Troubleshooting Procedure

### Common Issues and Scripts

#### Password Reset
```powershell
Set-ADAccountPassword -Identity [email] -Reset -NewPassword (ConvertTo-SecureString "TempPass@123!" -AsPlainText -Force)
Unlock-ADAccount -Identity [email]
```

#### Printer Issues
```powershell
Stop-Service Spooler -Force
Remove-Item "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -Recurse
Start-Service Spooler
```

#### Performance Issues
```powershell
Get-Process | Where-Object {$_.CPU -gt 80} | Sort CPU -Descending
Clear-DnsClientCache
```

#### Network Issues
```powershell
ipconfig /release && ipconfig /renew && ipconfig /flushdns
netsh winsock reset catalog
```

### Remote Execution: WinRM over HTTPS
### Resolution Time: 10-30 minutes
### Automated: YES (confidence ≥ 80%)"""),
        ]

        sops = []
        for title, uc, content in sops_data:
            sop = SOP(title=title, use_case=uc, content=content, version="1.0", is_active=True)
            db.add(sop)
            sops.append(sop)
        await db.flush()

        print("Seeding tickets with notes, resolutions, and logs...")
        ticket_templates = [
            ("Need access to Marketing SharePoint site", "sharepoint_access", "john.doe@jgsl.com", 0.92),
            ("Request SharePoint site creation for Project Alpha", "sharepoint_admin", "jane.smith@jgsl.com", 0.78),
            ("BlueBeam Revu license required for CAD team", "license_bluebeam", "mike.jones@jgsl.com", 0.95),
            ("Adobe Creative Cloud license for design team member", "license_adobe", "sara.lee@jgsl.com", 0.88),
            ("O365 E3 license for new hire onboarding", "license_o365", "new.hire@jgsl.com", 0.91),
            ("Add 5 members to ProjectX distribution list", "dl_update", "team.lead@jgsl.com", 0.87),
            ("Laptop running extremely slow, high CPU usage", "windows_troubleshooting", "bob.wilson@jgsl.com", 0.83),
            ("Cannot reset password, account locked out", "windows_troubleshooting", "alice.martin@jgsl.com", 0.90),
            ("Printer not printing after Windows update", "windows_troubleshooting", "charlie.brown@jgsl.com", 0.85),
            ("SharePoint permission error for Finance site", "sharepoint_access", "finance.user@jgsl.com", 0.76),
            ("Bluebeam not launching after license assignment", "license_bluebeam", "eng.user@jgsl.com", 0.65),
            ("Remove former employee from all DLs", "dl_update", "hr.manager@jgsl.com", 0.93),
            ("O365 license not showing after purchase", "license_o365", "admin.user@jgsl.com", 0.72),
            ("Adobe Acrobat DC keeps crashing", "license_adobe", "doc.writer@jgsl.com", 0.68),
            ("Windows update causing network connectivity issue", "windows_troubleshooting", "remote.worker@jgsl.com", 0.79),
            ("Request read-only access to HR SharePoint", "sharepoint_access", "new.manager@jgsl.com", 0.94),
            ("Create new DL for Q4 project team", "dl_update", "proj.manager@jgsl.com", 0.89),
            ("Disk space critically low on dev workstation", "windows_troubleshooting", "developer@jgsl.com", 0.81),
            ("Transfer SharePoint site ownership to new admin", "sharepoint_admin", "outgoing.admin@jgsl.com", 0.70),
            ("O365 Teams not syncing after tenant migration", "license_o365", "it.staff@jgsl.com", 0.86),
            ("BlueBeam license expired, need renewal", "license_bluebeam", "architect@jgsl.com", 0.92),
            ("Adobe license pool exhausted, 3 users waiting", "license_adobe", "design.lead@jgsl.com", 0.75),
            ("Shared mailbox DL not receiving external emails", "dl_update", "support.lead@jgsl.com", 0.88),
            ("SharePoint search not returning results", "sharepoint_admin", "content.admin@jgsl.com", 0.62),
            ("Multiple users locked out after AD sync failure", "windows_troubleshooting", "sysadmin@jgsl.com", 0.55),
        ]

        now = datetime.utcnow()
        for i, (title, use_case, user_email, conf) in enumerate(ticket_templates):
            days_ago = random.randint(0, 30)
            created = now - timedelta(days=days_ago, hours=random.randint(0, 23))

            if conf >= 0.85:
                status = random.choice(["auto_resolved", "auto_resolved", "auto_resolved", "closed"])
                resolution_type = "auto"
            elif conf >= 0.65:
                status = random.choice(["open", "in_progress", "auto_resolved", "escalated"])
                resolution_type = random.choice(["auto", "manual"])
            else:
                status = random.choice(["open", "in_progress", "escalated"])
                resolution_type = None

            priority = random.choice(["low", "medium", "medium", "high", "urgent"])
            from app.services.resolution.engine import compute_sla_deadline
            sla_deadline = compute_sla_deadline(use_case, priority)

            elapsed_pct = days_ago / 30
            if elapsed_pct >= 1.0:
                sla_status = "breached"
            elif elapsed_pct >= 0.75:
                sla_status = "at_risk"
            else:
                sla_status = "safe"

            ticket = Ticket(
                title=title,
                description=f"User reported: {title}. Please assist with this {use_case.replace('_', ' ')} request urgently.",
                use_case=use_case,
                status=status,
                priority=priority,
                sla_deadline=sla_deadline,
                sla_status=sla_status,
                source=random.choice(["web_dashboard", "google_chat", "freshservice"]),
                user_email=user_email,
                assigned_agent_id=random.choice(agents[1:]).agent_id,
                resolution_type=resolution_type,
                confidence_score=conf + random.uniform(-0.05, 0.05),
                created_at=created,
                updated_at=created + timedelta(minutes=random.randint(5, 60)),
                closed_at=created + timedelta(hours=random.randint(1, 8)) if status in ("auto_resolved", "closed") else None,
            )
            db.add(ticket)
            await db.flush()

            # AI Resolution
            if conf >= 0.60:
                matching_sop = next((s for s in sops if s.use_case == use_case), sops[0])
                decision = "auto_resolve" if conf >= 0.85 else "review_after" if conf >= 0.60 else "escalate"
                exec_status = "success" if status in ("auto_resolved", "closed") else "failed"
                resolution = AIResolution(
                    ticket_id=ticket.ticket_id,
                    intent_detected=f"User requesting {use_case.replace('_', ' ')} assistance",
                    root_cause=f"Automated detection: {use_case} issue identified with {round(conf*100)}% confidence",
                    sop_matched=matching_sop.sop_id,
                    confidence_score=conf,
                    intent_clarity_score=round(conf * 0.9 + random.uniform(-0.05, 0.05), 3),
                    sop_match_score=round(conf * 1.05, 3),
                    historical_success_score=round(random.uniform(0.70, 0.95), 3),
                    input_completeness_score=round(random.uniform(0.80, 1.0), 3),
                    decision=decision,
                    resolution_steps=["Verify user identity", "Apply SOP automation", "Confirm resolution"],
                    execution_status=exec_status,
                    execution_output=f"[SIMULATION] {use_case.replace('_', ' ').title()} processed successfully." if exec_status == "success" else "Escalated to L2 team",
                    time_taken_seconds=random.randint(30, 300),
                    created_at=ticket.created_at + timedelta(seconds=random.randint(10, 60)),
                )
                db.add(resolution)

            # Ticket notes
            if status in ("auto_resolved", "closed"):
                note = TicketNote(
                    ticket_id=ticket.ticket_id,
                    note_type="resolution_summary",
                    content=f"AI auto-resolved with {round(conf*100)}% confidence. {use_case.replace('_',' ').title()} request processed via automation.",
                    created_by="ai",
                    created_at=ticket.created_at + timedelta(minutes=random.randint(5, 30)),
                )
                db.add(note)

            # Audit logs
            for event in [("ticket_created", "user"), ("ai_triage_complete", "ai")]:
                audit = AuditLog(
                    ticket_id=ticket.ticket_id,
                    event_type=event[0],
                    actor=user_email if event[1] == "user" else "ai",
                    actor_type=event[1],
                    details={"use_case": use_case, "confidence": conf},
                    created_at=ticket.created_at + timedelta(seconds=random.randint(1, 30)),
                )
                db.add(audit)

            # API call logs
            api_log = APICallLog(
                ticket_id=ticket.ticket_id,
                api_name=random.choice(["freshservice", "graph_api", "license_api"]),
                endpoint=f"/api/v2/tickets/{random.randint(1000, 9999)}",
                method="POST",
                request_payload={"ticket_id": str(ticket.ticket_id)},
                response_status=random.choice([200, 200, 200, 201, 422]),
                duration_ms=random.randint(50, 500),
                called_at=ticket.created_at + timedelta(seconds=random.randint(5, 60)),
            )
            db.add(api_log)

        print("Seeding ROI metrics...")
        for month_offset in range(6):
            period_start = now - timedelta(days=30 * (month_offset + 1))
            period_end = now - timedelta(days=30 * month_offset)
            total = random.randint(80, 150)
            auto_resolved = int(total * random.uniform(0.72, 0.88))
            hours = auto_resolved * 0.75
            roi = ROIMetric(
                period_start=period_start.strftime("%Y-%m-%d"),
                period_end=period_end.strftime("%Y-%m-%d"),
                total_tickets=total,
                auto_resolved_count=auto_resolved,
                manual_resolved_count=total - auto_resolved,
                avg_auto_resolution_mins=3.5,
                avg_manual_resolution_mins=45.0,
                hours_saved=round(hours, 2),
                cost_saved=round(hours * 25.0, 2),
                agent_hourly_cost=25.0,
                calculated_at=period_end,
            )
            db.add(roi)

        await db.commit()
        print(f"\n✅ Seed complete!")
        print(f"   - {len(agents)} agents seeded")
        print(f"   - {len(groups)} agent groups seeded")
        print(f"   - {len(sops_data)} SOPs seeded")
        print(f"   - {len(ticket_templates)} tickets seeded")
        print(f"   - SLA configs, confidence thresholds, ROI metrics seeded")
        print(f"\n🔑 Login: admin@jgsl.com / password123")


if __name__ == "__main__":
    asyncio.run(seed())
