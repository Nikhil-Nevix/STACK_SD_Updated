import os
import sys
import asyncio
import uuid
from datetime import datetime, timedelta
import random

# Add api-server directory to Python path so app imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "artifacts", "api-server")))

from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models import (
    Agent, AgentGroup, AgentGroupMember,
    SLAConfig, ConfidenceThreshold, User,
    Ticket, TicketNote, AIResolution, SOP,
    AuditLog, APICallLog, PowerShellExecution, ROIMetric
)

USE_CASES = [
    "sharepoint_access",
    "sharepoint_admin",
    "license_bluebeam",
    "license_adobe",
    "license_o365",
    "dl_update",
    "windows_troubleshooting",
]

SLA_HOURS = {
    "sharepoint_access":     {"low": 24, "medium": 8, "high": 4, "urgent": 2},
    "sharepoint_admin":      {"low": 48, "medium": 16, "high": 8, "urgent": 4},
    "license_bluebeam":      {"low": 24, "medium": 8, "high": 4, "urgent": 2},
    "license_adobe":         {"low": 24, "medium": 8, "high": 4, "urgent": 2},
    "license_o365":          {"low": 24, "medium": 8, "high": 4, "urgent": 2},
    "dl_update":             {"low": 12, "medium": 4, "high": 2, "urgent": 1},
    "windows_troubleshooting":{"low": 8, "medium": 4, "high": 2, "urgent": 1},
}

async def seed():
    print("Starting database seed...")
    
    # Ensure tables are created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        # 1. Seed Agents (9 default + Admin)
        print("Seeding agents...")
        agent_names = [
            ("Bhaskar", "bhaskar@jgsl.com", "agent"),
            ("Neha", "neha@jgsl.com", "readonly"),
            ("Madhura", "madhura@jgsl.com", "agent"),
            ("Yogesh", "yogesh@jgsl.com", "agent"),
            ("Datta Patil", "datta@jgsl.com", "agent"),
            ("Ajay", "ajay@jgsl.com", "agent"),
            ("Ankit", "ankit@jgsl.com", "agent"),
            ("Hadi", "hadi@jgsl.com", "agent"),
            ("Shameem", "shameem@jgsl.com", "agent"),
            ("Admin User", "admin@jgsl.com", "admin"),
        ]
        
        db_agents = []
        for name, email, role in agent_names:
            stmt = select(Agent).where(Agent.email == email)
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                agent = Agent(
                    email=email,
                    full_name=name,
                    role=role,
                    password_hash="pbkdf2:sha256:260000$somehashvalue",
                    freshservice_agent_id=f"FS-{name[:3].upper()}",
                    is_active=True
                )
                session.add(agent)
                db_agents.append(agent)
            else:
                db_agents.append(existing)
        
        await session.flush()
        
        # Find datta for linking to all groups
        datta_agent = None
        for a in db_agents:
            if a.email == "datta@jgsl.com":
                datta_agent = a
                break
                
        # 2. Seed Agent Groups (4 groups)
        print("Seeding agent groups...")
        group_data = [
            ("SharePoint Support Group", "sharepoint_access", "round_robin", "GRP001"),
            ("License Management Group", "license_o365", "first_available", "GRP002"),
            ("DL Management Group", "dl_update", "round_robin", "GRP004"),
            ("L2 Windows Support Group", "windows_troubleshooting", "priority", "GRP003"),
        ]
        
        db_groups = []
        for gname, uc, amode, fsgid in group_data:
            stmt = select(AgentGroup).where(AgentGroup.group_name == gname)
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                grp = AgentGroup(
                    group_name=gname,
                    use_case=uc,
                    assignment_mode=amode,
                    freshservice_group_id=fsgid
                )
                session.add(grp)
                db_groups.append(grp)
            else:
                db_groups.append(existing)
                
        await session.flush()
        
        # 3. Seed Group Memberships (Datta linked to all groups, other agents distributed)
        print("Seeding group memberships...")
        for grp in db_groups:
            # Datta linked to all groups with priority 99
            if datta_agent:
                stmt = select(AgentGroupMember).where(
                    AgentGroupMember.group_id == grp.group_id,
                    AgentGroupMember.agent_id == datta_agent.agent_id
                )
                res = await session.execute(stmt)
                if not res.scalar_one_or_none():
                    session.add(AgentGroupMember(
                        group_id=grp.group_id,
                        agent_id=datta_agent.agent_id,
                        priority_order=99
                    ))
            
            # Distribute other agents
            for a in db_agents:
                if a.email in ("datta@jgsl.com", "admin@jgsl.com", "neha@jgsl.com"):
                    continue
                
                stmt = select(AgentGroupMember).where(
                    AgentGroupMember.group_id == grp.group_id,
                    AgentGroupMember.agent_id == a.agent_id
                )
                res = await session.execute(stmt)
                if not res.scalar_one_or_none():
                    # Pick randomly to distribute
                    if random.random() > 0.3:
                        session.add(AgentGroupMember(
                            group_id=grp.group_id,
                            agent_id=a.agent_id,
                            priority_order=random.randint(1, 5)
                        ))
                        
        # 4. Seed Users
        print("Seeding users...")
        user_data = [
            ("Nikhil Rokade", "nikhil@jgsl.com", "Engineering", "NIKHIL-LAPTOP", "192.168.1.52", "manager@jgsl.com"),
            ("Amit Kumar", "amit.kumar@jgsl.com", "HR", "AMIT-HR", "192.168.1.60", "manager2@jgsl.com"),
            ("Priya Sharma", "priya.sharma@jgsl.com", "Marketing", "PRIYA-MKT", "192.168.1.65", "manager@jgsl.com"),
            ("John Doe", "john.doe@jgsl.com", "Finance", "JOHN-FIN", "192.168.1.70", "manager3@jgsl.com"),
            ("Jane Smith", "jane.smith@jgsl.com", "Sales", "JANE-SALES", "192.168.1.75", "manager2@jgsl.com"),
        ]
        
        db_users = []
        for name, email, dept, dev_name, dev_ip, mgr in user_data:
            stmt = select(User).where(User.email == email)
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                u = User(
                    email=email,
                    full_name=name,
                    department=dept,
                    device_name=dev_name,
                    device_ip=dev_ip,
                    manager_email=mgr,
                    is_active=True
                )
                session.add(u)
                db_users.append(u)
            else:
                db_users.append(existing)
                
        await session.flush()
        
        # 5. Seed Confidence Thresholds
        print("Seeding confidence thresholds...")
        for uc in USE_CASES:
            stmt = select(ConfidenceThreshold).where(ConfidenceThreshold.use_case == uc)
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                session.add(ConfidenceThreshold(
                    use_case=uc,
                    auto_resolve_min=85.0,
                    review_after_min=60.0
                ))
                
        # 6. Seed SLA Configs
        print("Seeding SLA configs...")
        for uc in USE_CASES:
            for priority, hours in SLA_HOURS[uc].items():
                stmt = select(SLAConfig).where(
                    SLAConfig.use_case == uc,
                    SLAConfig.priority == priority
                )
                res = await session.execute(stmt)
                if not res.scalar_one_or_none():
                    session.add(SLAConfig(
                        use_case=uc,
                        priority=priority,
                        resolution_hours=hours,
                        warning_threshold_percent=75.0
                    ))
                    
        # 7. Seed SOPs
        print("Seeding SOPs...")
        sop_data = [
            {
                "title": "SharePoint Access Request Process",
                "use_case": "sharepoint_access",
                "version": "2.1",
                "content": """# SharePoint Access Request SOP

## Overview
This SOP covers granting SharePoint site access to Jade Global employees.

## Prerequisites
- Active employee account in Azure AD
- Valid business justification

## Steps

### 1. Verify Requester Identity
- Check that requester email matches Azure AD directory
- Confirm employee is active in HRMS

### 2. Validate Business Justification
- Access request must come from requester or their manager
- Check project assignment or department alignment

### 3. Grant Access
```powershell
# Connect to SharePoint Online
Connect-PnPOnline -Url "https://jadeglobal.sharepoint.com/sites/[SiteName]" -Interactive

# Add user to appropriate SharePoint group
Add-PnPGroupMember -LoginName "[email]" -Group "Members"
```

### 4. Send Confirmation
- Notify requester via email
- Update ticket with access grant details
- Log action in audit trail

## Escalation
If access requires approval from site owner, escalate to SharePoint Admin team.

## Notes
- SharePoint access is granted within 30 minutes for auto-resolution
- Bulk requests (>5 users) must be manually reviewed"""
            },
            {
                "title": "O365 License Assignment",
                "use_case": "license_o365",
                "version": "1.4",
                "content": """# Office 365 License Assignment SOP

## Overview
Process for assigning and managing O365 licenses for Jade Global employees.

## License Types Available
- Microsoft 365 Business Premium
- Microsoft 365 Apps for Business
- Exchange Online Plan 1

## Steps

### 1. Check License Availability
```powershell
# Check available licenses
Connect-MsolService
Get-MsolAccountSku | Select AccountSkuId, ActiveUnits, ConsumedUnits
```

### 2. Assign License
```powershell
# Assign O365 license
Set-MsolUserLicense -UserPrincipalName "[email]" -AddLicenses "[tenantname]:ENTERPRISEPACK"
```

### 3. Verify Assignment
- Confirm license shows in M365 Admin Center
- Test user can login to O365 services

### 4. Document
- Update asset tracker with license assignment
- Log in audit trail

## SLA
- Standard: 24 hours
- Urgent (new hire): 4 hours"""
            },
            {
                "title": "Distribution List Update Process",
                "use_case": "dl_update",
                "version": "1.2",
                "content": """# Distribution List Update SOP

## Overview
Managing Exchange Online distribution lists for Jade Global.

## Common Operations
- Add member to DL
- Remove member from DL
- Create new DL
- Modify DL properties

## Steps

### Add Member
```powershell
Connect-ExchangeOnline
Add-DistributionGroupMember -Identity "[DL Name]" -Member "[email]"
```

### Remove Member
```powershell
Remove-DistributionGroupMember -Identity "[DL Name]" -Member "[email]" -Confirm:$false
```

### Verify Change
```powershell
Get-DistributionGroupMember -Identity "[DL Name]" | Select Name, PrimarySmtpAddress
```

## Approval
- Changes to leadership DLs require manager approval
- All-company DLs require IT Manager approval"""
            },
            {
                "title": "Windows Troubleshooting Guide",
                "use_case": "windows_troubleshooting",
                "version": "3.0",
                "content": """# Windows Troubleshooting SOP

## Common Issues & Automated Fixes

### Password Reset
```powershell
# Force password reset on next login
Set-ADUser -Identity "[username]" -ChangePasswordAtLogon $true
```

### Disk Cleanup
```powershell
# Run automated disk cleanup
Start-Process -FilePath cleanmgr.exe -ArgumentList "/sagerun:1" -Wait
```

### Restart Services
```powershell
# Restart Windows Update service
Restart-Service -Name wuauserv -Force
# Restart Print Spooler
Restart-Service -Name Spooler -Force
```

### Drive Mapping
```powershell
# Map network drive
New-PSDrive -Name "Z" -PSProvider FileSystem -Root "\\\\server\\share" -Persist
```

## Escalation Triggers
- Blue screen errors (BSOD)
- Hardware failures
- Domain join issues
- Issues persisting after 2 automated attempts"""
            },
            {
                "title": "Bluebeam License Management",
                "use_case": "license_bluebeam",
                "version": "1.0",
                "content": """# Bluebeam License Management SOP

## Overview
Managing Bluebeam Revu licenses for engineering and construction teams.

## Seat Allocation
- Current seat count: 25 licenses
- Department allocation: Engineering (15), Architecture (7), PM (3)

## Assignment Process
1. Verify requester is in eligible department
2. Check available seats via Bluebeam Studio portal
3. Assign seat to user account
4. Send activation instructions

## Deactivation
- Floating licenses auto-return after 30-day inactivity
- Permanent seats require manual deactivation via portal

## Support Contacts
- Bluebeam Support: support.bluebeam.com
- Internal: IT Service Desk"""
            }
        ]
        
        db_sops = []
        for s in sop_data:
            stmt = select(SOP).where(SOP.title == s["title"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                sop = SOP(
                    title=s["title"],
                    use_case=s["use_case"],
                    version=s["version"],
                    content=s["content"],
                    is_active=True
                )
                session.add(sop)
                db_sops.append(sop)
            else:
                db_sops.append(existing)
                
        await session.flush()
        
        # 8. Seed Tickets (representing historical & open data)
        print("Seeding tickets...")
        ticket_titles = [
            ("SharePoint site access needed for Project Alpha", "sharepoint_access"),
            ("Cannot access SharePoint document library", "sharepoint_access"),
            ("SharePoint admin rights required for IT dept", "sharepoint_admin"),
            ("Bluebeam license not activating on new laptop", "license_bluebeam"),
            ("Need Adobe Acrobat Pro for document processing", "license_adobe"),
            ("O365 license required for new hire Amit Kumar", "license_o365"),
            ("Distribution list update: add 3 members to IT-All", "dl_update"),
            ("Windows laptop freezing on startup", "windows_troubleshooting"),
            ("Cannot print from workstation - spooler error", "windows_troubleshooting"),
            ("SharePoint permissions issue - read only instead of edit", "sharepoint_access"),
            ("License transfer from Priya to new team member", "license_o365"),
            ("Add user to Finance-Leads distribution list", "dl_update"),
            ("Bluebeam Studio session not syncing", "license_bluebeam"),
            ("Windows update stuck at 35% for 3 days", "windows_troubleshooting"),
            ("New SharePoint site creation request for PMO", "sharepoint_admin"),
            ("Adobe Reader update needed - version out of date", "license_adobe"),
            ("DL: Remove ex-employee from all company DLs", "dl_update"),
            ("O365 Teams not connecting - license issue", "license_o365"),
            ("SharePoint search not returning results", "sharepoint_access"),
            ("Windows network drive mapping failing", "windows_troubleshooting"),
            ("Bluebeam crashing when opening large PDF", "license_bluebeam"),
            ("SharePoint site storage quota exceeded", "sharepoint_admin"),
            ("O365 license reallocation - 5 seats", "license_o365"),
            ("Windows defender blocking company software", "windows_troubleshooting"),
            ("DL update: new project team distribution list", "dl_update"),
        ]
        
        created_tickets = []
        for i, (title, use_case) in enumerate(ticket_titles):
            stmt = select(Ticket).where(Ticket.freshservice_ticket_id == f"FS-{1000 + i}")
            res = await session.execute(stmt)
            if res.scalar_one_or_none():
                continue
                
            days_back = random.randint(1, 30)
            created_at = datetime.utcnow() - timedelta(days=days_back)
            
            # Distribute statuses
            if i < 8:
                status = "open"
            elif i < 12:
                status = "in_progress"
            elif i < 18:
                status = "auto_resolved"
            elif i < 21:
                status = "escalated"
            else:
                status = "closed"
                
            priority = random.choice(["low", "medium", "high", "urgent"])
            sla_status = "breached" if status == "escalated" else ("at_risk" if status == "in_progress" else "safe")
            confidence = 0.65 + random.random() * 0.30
            agent = random.choice(db_agents)
            user = random.choice(db_users) if db_users else None
            
            # calculate sla_deadline
            hours = SLA_HOURS[use_case].get(priority, 8)
            sla_deadline = created_at + timedelta(hours=hours)
            
            ticket = Ticket(
                freshservice_ticket_id=f"FS-{1000 + i}",
                title=title,
                description=f"User reported: {title}. Please assist.",
                use_case=use_case,
                status=status,
                priority=priority,
                sla_deadline=sla_deadline,
                sla_status=sla_status,
                sla_breach_predicted=(sla_status == "at_risk"),
                source=random.choice(["freshservice", "web_dashboard", "google_chat"]),
                user_email=user.email if user else f"user{i}@jgsl.com",
                assigned_agent_id=agent.agent_id,
                resolution_type="auto" if status == "auto_resolved" else ("manual" if status == "closed" else None),
                confidence_score=f"{confidence:.2f}" if status != "open" else None,
                created_at=created_at,
                updated_at=created_at + timedelta(minutes=random.randint(5, 120)),
                closed_at=datetime.utcnow() if status in ("auto_resolved", "closed") else None
            )
            session.add(ticket)
            created_tickets.append(ticket)
            
        await session.flush()
        
        # 9. Seed Notes, Audits & PowerShell executions for resolved tickets
        print("Seeding notes, AI resolutions, PowerShell logs and audits...")
        for ticket in created_tickets:
            # Audit log for creation
            session.add(AuditLog(
                ticket_id=ticket.ticket_id,
                event_type="ticket_created",
                actor=ticket.user_email,
                actor_type="user",
                details={"source": ticket.source, "use_case": ticket.use_case},
                created_at=ticket.created_at
            ))
            
            if ticket.status in ("auto_resolved", "closed"):
                # Pick matched SOP
                matched_sop = None
                for s in db_sops:
                    if s.use_case == ticket.use_case:
                        matched_sop = s
                        break
                        
                intent_clarity = 0.75 + random.random() * 0.2
                sop_match = 0.70 + random.random() * 0.25
                historical_success = 0.80 + random.random() * 0.15
                input_completeness = 0.85 + random.random() * 0.1
                conf = float(ticket.confidence_score) if ticket.confidence_score else 0.85
                
                # Add AI Resolution details
                ai_res = AIResolution(
                    ticket_id=ticket.ticket_id,
                    intent_detected=ticket.use_case.replace("_", " "),
                    root_cause=f"AI analysis identified root cause for: {ticket.title}",
                    sop_matched=matched_sop.sop_id if matched_sop else None,
                    confidence_score=conf,
                    intent_clarity_score=intent_clarity,
                    sop_match_score=sop_match,
                    historical_success_score=historical_success,
                    input_completeness_score=input_completeness,
                    decision="auto_resolve",
                    resolution_steps=[
                        f"Analyzed request: '{ticket.title}'",
                        f"Matched SOP: {ticket.use_case} v1.0",
                        "Executed automated resolution steps via APIs/scripts",
                        "Verified resolution and notified user"
                    ],
                    execution_status="success",
                    execution_output=f"Resolution completed successfully.\nUser notified at {ticket.user_email}.",
                    time_taken_seconds=random.randint(15, 60),
                    created_at=ticket.created_at + timedelta(minutes=5)
                )
                session.add(ai_res)
                
                # Add PowerShell Execution if it's windows troubleshooting
                if ticket.use_case == "windows_troubleshooting":
                    session.add(PowerShellExecution(
                        ticket_id=ticket.ticket_id,
                        script_name="Fix-Performance.ps1",
                        device_name="JGSL-PC-LPT",
                        device_ip="192.168.1.52",
                        execution_status="success",
                        output_log="[INFO] Initiating connection via WinRM\n[INFO] Remote executing Fix-Performance.ps1\n[SUCCESS] RAM/CPU usage optimized\n[INFO] Process complete",
                        duration_seconds=random.randint(10, 40),
                        executed_at=ticket.created_at + timedelta(minutes=4)
                    ))
                
                # Audit log for resolution
                session.add(AuditLog(
                    ticket_id=ticket.ticket_id,
                    event_type="auto_resolved",
                    actor="STACK AI",
                    actor_type="ai",
                    details={"from": "open", "to": "auto_resolved", "confidence": ticket.confidence_score},
                    created_at=ticket.created_at + timedelta(minutes=5)
                ))
                
        # 10. Seed APICallLogs
        print("Seeding API Call logs...")
        api_names = ["Freshservice API", "Microsoft Graph API", "SharePoint REST API", "Exchange Online API"]
        endpoints = [
            "/api/v2/tickets", "/users/me/memberOf", "/sites/root/lists", "/groups/members",
            "/api/v2/agents", "/users/{id}/licenses", "/drive/items/{id}/permissions"
        ]
        
        for ticket in created_tickets[:15]:
            for _ in range(random.randint(1, 3)):
                session.add(APICallLog(
                    ticket_id=ticket.ticket_id,
                    api_name=random.choice(api_names),
                    endpoint=random.choice(endpoints),
                    method=random.choice(["GET", "POST", "PATCH"]),
                    request_payload={"sample": "data"},
                    response_status=random.choice([200, 201, 200, 400, 200]),
                    response_payload={"status": "success"},
                    duration_ms=random.randint(40, 450),
                    called_at=ticket.created_at + timedelta(minutes=2)
                ))
                
        # 11. Seed ROI Metrics
        print("Seeding ROI metrics...")
        for i in range(5, -1, -1):
            period_end = datetime.utcnow() - timedelta(days=i*30)
            period_start = period_end - timedelta(days=30)
            
            auto_resolved = random.randint(30, 110)
            total = auto_resolved + random.randint(10, 50)
            hours_saved = auto_resolved * 0.75  # 45 mins saved per ticket
            agent_hourly_cost = 50.0
            
            stmt = select(ROIMetric).where(
                ROIMetric.period_start == period_start.strftime("%Y-%m-%d"),
                ROIMetric.period_end == period_end.strftime("%Y-%m-%d")
            )
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                session.add(ROIMetric(
                    period_start=period_start.strftime("%Y-%m-%d"),
                    period_end=period_end.strftime("%Y-%m-%d"),
                    total_tickets=total,
                    auto_resolved_count=auto_resolved,
                    manual_resolved_count=total - auto_resolved,
                    avg_auto_resolution_mins=12.5,
                    avg_manual_resolution_mins=45.0,
                    hours_saved=hours_saved,
                    cost_saved=hours_saved * agent_hourly_cost,
                    agent_hourly_cost=agent_hourly_cost,
                    calculated_at=period_end
                ))
                
        await session.commit()
        print("Database seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
