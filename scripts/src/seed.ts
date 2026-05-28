import { db } from "@workspace/db";
import {
  agentsTable,
  ticketsTable,
  ticketNotesTable,
  aiResolutionsTable,
  auditLogsTable,
  apiCallLogsTable,
  powershellExecutionsTable,
  sopsTable,
  confidenceThresholdsTable,
  slaConfigsTable,
  agentGroupsTable,
  agentGroupMembersTable,
  roiMetricsTable,
} from "@workspace/db";

const USE_CASES = [
  "sharepoint_access",
  "sharepoint_admin",
  "license_bluebeam",
  "license_adobe",
  "license_o365",
  "dl_update",
  "windows_troubleshooting",
] as const;

const STATUSES = ["open", "in_progress", "auto_resolved", "escalated", "closed"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const SLA_STATUSES = ["safe", "at_risk", "breached"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

async function seed() {
  console.log("Starting seed...");

  // Agents
  console.log("Seeding agents...");
  const agentData = [
    { email: "admin@jgsl.com", full_name: "Admin User", role: "admin" as const, password_hash: "hash123", freshservice_agent_id: "FS001", is_active: true },
    { email: "datta@jgsl.com", full_name: "Datta Patil", role: "agent" as const, password_hash: "hash123", freshservice_agent_id: "FS002", is_active: true },
    { email: "priya@jgsl.com", full_name: "Priya Sharma", role: "agent" as const, password_hash: "hash123", freshservice_agent_id: "FS003", is_active: true },
    { email: "rahul@jgsl.com", full_name: "Rahul Mehta", role: "agent" as const, password_hash: "hash123", freshservice_agent_id: "FS004", is_active: true },
    { email: "neha@jgsl.com", full_name: "Neha Singh", role: "readonly" as const, password_hash: "hash123", freshservice_agent_id: "FS005", is_active: true },
  ];

  const agents = await db.insert(agentsTable).values(agentData).onConflictDoNothing().returning();
  console.log(`Seeded ${agents.length} agents`);

  const allAgents = await db.select().from(agentsTable);

  // Confidence Thresholds
  console.log("Seeding confidence thresholds...");
  for (const uc of USE_CASES) {
    await db.insert(confidenceThresholdsTable).values({
      use_case: uc,
      auto_resolve_min: 85.0,
      review_after_min: 60.0,
    }).onConflictDoNothing();
  }

  // SLA Configs
  console.log("Seeding SLA configs...");
  for (const uc of USE_CASES) {
    for (const p of PRIORITIES) {
      const hours = p === "urgent" ? 4 : p === "high" ? 8 : p === "medium" ? 24 : 48;
      await db.insert(slaConfigsTable).values({
        use_case: uc,
        priority: p,
        resolution_hours: hours,
        warning_threshold_percent: 75.0,
      }).onConflictDoNothing();
    }
  }

  // Agent Groups
  console.log("Seeding agent groups...");
  const groups = await db.insert(agentGroupsTable).values([
    { group_name: "SharePoint Support", use_case: "sharepoint_access", assignment_mode: "round_robin" as const, freshservice_group_id: "GRP001" },
    { group_name: "Licensing Team", use_case: "license_o365", assignment_mode: "first_available" as const, freshservice_group_id: "GRP002" },
    { group_name: "Windows Support", use_case: "windows_troubleshooting", assignment_mode: "priority" as const, freshservice_group_id: "GRP003" },
    { group_name: "DL Admin Team", use_case: "dl_update", assignment_mode: "round_robin" as const, freshservice_group_id: "GRP004" },
  ]).returning();

  if (allAgents.length > 0 && groups.length > 0) {
    for (const group of groups) {
      const memberAgents = allAgents.slice(0, 2);
      for (let i = 0; i < memberAgents.length; i++) {
        await db.insert(agentGroupMembersTable).values({
          group_id: group.group_id,
          agent_id: memberAgents[i].agent_id,
          priority_order: i + 1,
        }).onConflictDoNothing();
      }
    }
  }

  // SOPs
  console.log("Seeding SOPs...");
  await db.insert(sopsTable).values([
    {
      title: "SharePoint Access Request Process",
      use_case: "sharepoint_access",
      version: "2.1",
      is_active: true,
      content: `# SharePoint Access Request SOP

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
\`\`\`powershell
# Connect to SharePoint Online
Connect-PnPOnline -Url "https://jadeglobal.sharepoint.com/sites/[SiteName]" -Interactive

# Add user to appropriate SharePoint group
Add-PnPGroupMember -LoginName "[email]" -Group "Members"
\`\`\`

### 4. Send Confirmation
- Notify requester via email
- Update ticket with access grant details
- Log action in audit trail

## Escalation
If access requires approval from site owner, escalate to SharePoint Admin team (Group: GRP001).

## Notes
- SharePoint access is granted within 30 minutes for auto-resolution
- Bulk requests (>5 users) must be manually reviewed`,
    },
    {
      title: "O365 License Assignment",
      use_case: "license_o365",
      version: "1.4",
      is_active: true,
      content: `# Office 365 License Assignment SOP

## Overview
Process for assigning and managing O365 licenses for Jade Global employees.

## License Types Available
- Microsoft 365 Business Premium
- Microsoft 365 Apps for Business
- Exchange Online Plan 1

## Steps

### 1. Check License Availability
\`\`\`powershell
# Check available licenses
Connect-MsolService
Get-MsolAccountSku | Select AccountSkuId, ActiveUnits, ConsumedUnits
\`\`\`

### 2. Assign License
\`\`\`powershell
# Assign O365 license
Set-MsolUserLicense -UserPrincipalName "[email]" -AddLicenses "[tenantname]:ENTERPRISEPACK"
\`\`\`

### 3. Verify Assignment
- Confirm license shows in M365 Admin Center
- Test user can login to O365 services

### 4. Document
- Update asset tracker with license assignment
- Log in audit trail

## SLA
- Standard: 24 hours
- Urgent (new hire): 4 hours`,
    },
    {
      title: "Distribution List Update Process",
      use_case: "dl_update",
      version: "1.2",
      is_active: true,
      content: `# Distribution List Update SOP

## Overview
Managing Exchange Online distribution lists for Jade Global.

## Common Operations
- Add member to DL
- Remove member from DL
- Create new DL
- Modify DL properties

## Steps

### Add Member
\`\`\`powershell
Connect-ExchangeOnline
Add-DistributionGroupMember -Identity "[DL Name]" -Member "[email]"
\`\`\`

### Remove Member
\`\`\`powershell
Remove-DistributionGroupMember -Identity "[DL Name]" -Member "[email]" -Confirm:$false
\`\`\`

### Verify Change
\`\`\`powershell
Get-DistributionGroupMember -Identity "[DL Name]" | Select Name, PrimarySmtpAddress
\`\`\`

## Approval
- Changes to leadership DLs require manager approval
- All-company DLs require IT Manager approval`,
    },
    {
      title: "Windows Troubleshooting Guide",
      use_case: "windows_troubleshooting",
      version: "3.0",
      is_active: true,
      content: `# Windows Troubleshooting SOP

## Common Issues & Automated Fixes

### Password Reset
\`\`\`powershell
# Force password reset on next login
Set-ADUser -Identity "[username]" -ChangePasswordAtLogon $true
\`\`\`

### Disk Cleanup
\`\`\`powershell
# Run automated disk cleanup
Start-Process -FilePath cleanmgr.exe -ArgumentList "/sagerun:1" -Wait
\`\`\`

### Restart Services
\`\`\`powershell
# Restart Windows Update service
Restart-Service -Name wuauserv -Force
# Restart Print Spooler
Restart-Service -Name Spooler -Force
\`\`\`

### Drive Mapping
\`\`\`powershell
# Map network drive
New-PSDrive -Name "Z" -PSProvider FileSystem -Root "\\\\server\\share" -Persist
\`\`\`

## Escalation Triggers
- Blue screen errors (BSOD)
- Hardware failures
- Domain join issues
- Issues persisting after 2 automated attempts`,
    },
    {
      title: "Bluebeam License Management",
      use_case: "license_bluebeam",
      version: "1.0",
      is_active: true,
      content: `# Bluebeam License Management SOP

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
- Internal: IT Service Desk`,
    },
  ]).onConflictDoNothing();

  // Tickets
  console.log("Seeding tickets...");
  const ticketTitles = [
    ["SharePoint site access needed for Project Alpha", "sharepoint_access"],
    ["Cannot access SharePoint document library", "sharepoint_access"],
    ["SharePoint admin rights required for IT dept", "sharepoint_admin"],
    ["Bluebeam license not activating on new laptop", "license_bluebeam"],
    ["Need Adobe Acrobat Pro for document processing", "license_adobe"],
    ["O365 license required for new hire Amit Kumar", "license_o365"],
    ["Distribution list update: add 3 members to IT-All", "dl_update"],
    ["Windows laptop freezing on startup", "windows_troubleshooting"],
    ["Cannot print from workstation - spooler error", "windows_troubleshooting"],
    ["SharePoint permissions issue - read only instead of edit", "sharepoint_access"],
    ["License transfer from Priya to new team member", "license_o365"],
    ["Add user to Finance-Leads distribution list", "dl_update"],
    ["Bluebeam Studio session not syncing", "license_bluebeam"],
    ["Windows update stuck at 35% for 3 days", "windows_troubleshooting"],
    ["New SharePoint site creation request for PMO", "sharepoint_admin"],
    ["Adobe Reader update needed - version out of date", "license_adobe"],
    ["DL: Remove ex-employee from all company DLs", "dl_update"],
    ["O365 Teams not connecting - license issue", "license_o365"],
    ["SharePoint search not returning results", "sharepoint_access"],
    ["Windows network drive mapping failing", "windows_troubleshooting"],
    ["Bluebeam crashing when opening large PDF", "license_bluebeam"],
    ["SharePoint site storage quota exceeded", "sharepoint_admin"],
    ["O365 license reallocation - 5 seats", "license_o365"],
    ["Windows defender blocking company software", "windows_troubleshooting"],
    ["DL update: new project team distribution list", "dl_update"],
  ] as const;

  const createdTickets: typeof ticketsTable.$inferSelect[] = [];

  for (let i = 0; i < ticketTitles.length; i++) {
    const [title, use_case] = ticketTitles[i];
    const daysBack = Math.floor(Math.random() * 30);
    const status = i < 8 ? "open" : i < 12 ? "in_progress" : i < 18 ? "auto_resolved" : i < 21 ? "escalated" : "closed";
    const priority = pick(PRIORITIES);
    const sla_status: typeof SLA_STATUSES[number] = status === "escalated" ? "breached" : status === "in_progress" ? "at_risk" : "safe";
    const confidence = 0.65 + Math.random() * 0.30;
    const agent = pick(allAgents);
    const createdAt = daysAgo(daysBack);
    const slaDeadline = new Date(createdAt.getTime() + (priority === "urgent" ? 4 : priority === "high" ? 8 : 24) * 60 * 60 * 1000);

    const [ticket] = await db.insert(ticketsTable).values({
      freshservice_ticket_id: `FS-${1000 + i}`,
      title,
      description: `User reported: ${title}. Please assist.`,
      use_case: use_case as any,
      status: status as any,
      priority,
      sla_deadline: slaDeadline,
      sla_status,
      sla_breach_predicted: sla_status === "at_risk",
      source: pick(["freshservice", "web_dashboard", "google_chat"] as const),
      user_email: `user${i}@jgsl.com`,
      assigned_agent_id: allAgents.length > 0 ? agent.agent_id : undefined,
      resolution_type: status === "auto_resolved" ? "auto" : status === "closed" ? "manual" : undefined,
      confidence_score: status !== "open" ? String(confidence) : undefined,
      created_at: createdAt,
      updated_at: new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000),
      closed_at: (status === "auto_resolved" || status === "closed") ? new Date() : undefined,
    }).returning();

    createdTickets.push(ticket);

    // Add notes to some tickets
    if (i % 3 === 0) {
      await db.insert(ticketNotesTable).values({
        ticket_id: ticket.ticket_id,
        note_type: "human_note",
        content: "Investigated the issue. Working on a fix.",
        created_by: agent.email,
        created_at: new Date(createdAt.getTime() + 30 * 60 * 1000),
      });
    }

    // Add AI resolutions to resolved tickets
    if (status === "auto_resolved" || status === "closed") {
      const intentClarity = 0.75 + Math.random() * 0.2;
      const sopMatch = 0.70 + Math.random() * 0.25;
      const historicalSuccess = 0.80 + Math.random() * 0.15;
      const inputCompleteness = 0.85 + Math.random() * 0.1;
      const confScore = (intentClarity * 0.30 + sopMatch * 0.35 + historicalSuccess * 0.25 + inputCompleteness * 0.10);

      await db.insert(aiResolutionsTable).values({
        ticket_id: ticket.ticket_id,
        intent_detected: use_case.replace(/_/g, " "),
        root_cause: `AI analysis identified root cause for: ${title}`,
        confidence_score: confScore,
        intent_clarity_score: intentClarity,
        sop_match_score: sopMatch,
        historical_success_score: historicalSuccess,
        input_completeness_score: inputCompleteness,
        decision: "auto_resolve",
        resolution_steps: [
          `Analyzed request: "${title}"`,
          `Matched SOP: ${use_case} v2.1`,
          "Executed automated resolution steps via PowerShell",
          "Verified resolution and notified user",
        ],
        execution_status: "success",
        execution_output: `Resolution completed successfully.\nUser notified via email at user${i}@jgsl.com.\nTicket auto-closed at ${new Date().toISOString()}`,
        time_taken_seconds: Math.floor(Math.random() * 60) + 10,
        created_at: new Date(createdAt.getTime() + 15 * 60 * 1000),
      });

      // Add PowerShell execution log
      await db.insert(powershellExecutionsTable).values({
        ticket_id: ticket.ticket_id,
        script_name: `${use_case}_handler.ps1`,
        device_name: `JGSL-PC-${100 + i}`,
        device_ip: `10.0.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 254)}`,
        execution_status: "success",
        output_log: `[INFO] Starting script execution for ticket ${ticket.ticket_id}\n[INFO] Connecting to services...\n[SUCCESS] Operation completed.\n[INFO] User notified.`,
        executed_at: new Date(createdAt.getTime() + 20 * 60 * 1000),
        duration_seconds: Math.floor(Math.random() * 45) + 5,
      });
    }

    // Audit logs
    await db.insert(auditLogsTable).values({
      ticket_id: ticket.ticket_id,
      event_type: "ticket_created",
      actor: `user${i}@jgsl.com`,
      actor_type: "user",
      details: { source: "freshservice", use_case },
      created_at: createdAt,
    });

    if (status !== "open") {
      await db.insert(auditLogsTable).values({
        ticket_id: ticket.ticket_id,
        event_type: status === "auto_resolved" ? "auto_resolved" : "status_changed",
        actor: "STACK AI",
        actor_type: "ai",
        details: { from: "open", to: status, confidence: confidence.toFixed(2) },
        created_at: new Date(createdAt.getTime() + 15 * 60 * 1000),
      });
    }
  }

  // API Call Logs
  console.log("Seeding API call logs...");
  const apiNames = ["Freshservice API", "Microsoft Graph API", "SharePoint REST API", "Exchange Online API"];
  const endpoints = [
    "/api/v2/tickets", "/users/me/memberOf", "/sites/root/lists", "/groups/members",
    "/api/v2/agents", "/users/{id}/licenses", "/drive/items/{id}/permissions",
  ];
  const methods = ["GET", "POST", "PATCH", "DELETE"];
  const statuses = [200, 201, 200, 200, 200, 404, 500, 200, 200, 200];

  for (let i = 0; i < 40; i++) {
    const responseStatus = statuses[Math.floor(Math.random() * statuses.length)];
    await db.insert(apiCallLogsTable).values({
      ticket_id: createdTickets.length > 0 ? pick(createdTickets).ticket_id : undefined,
      api_name: pick(apiNames),
      endpoint: pick(endpoints),
      method: pick(methods as any),
      request_payload: { data: "sample_request" },
      response_status: responseStatus,
      response_payload: responseStatus < 300 ? { success: true } : { error: "Not found" },
      duration_ms: Math.floor(Math.random() * 500) + 50,
      called_at: hoursAgo(Math.floor(Math.random() * 72)),
    });
  }

  // ROI Metrics
  console.log("Seeding ROI metrics...");
  for (let i = 5; i >= 0; i--) {
    const periodEnd = new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000);
    const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    const autoResolved = Math.floor(Math.random() * 80) + 30;
    const total = autoResolved + Math.floor(Math.random() * 40) + 10;
    const hoursSaved = autoResolved * (45 / 60);
    const agentHourlyCost = 500;

    await db.insert(roiMetricsTable).values({
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      total_tickets: total,
      auto_resolved_count: autoResolved,
      manual_resolved_count: total - autoResolved,
      avg_auto_resolution_mins: 12.5,
      avg_manual_resolution_mins: 45.0,
      hours_saved: hoursSaved,
      cost_saved: hoursSaved * agentHourlyCost,
      agent_hourly_cost: agentHourlyCost,
      calculated_at: periodEnd,
    });
  }

  console.log("Seed completed successfully!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
}).finally(async () => {
  process.exit(0);
});
