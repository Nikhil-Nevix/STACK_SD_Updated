import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ticketsTable,
  ticketNotesTable,
  auditLogsTable,
  agentsTable,
  aiResolutionsTable,
} from "@workspace/db";
import { eq, and, desc, or, ilike, sql, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

function buildTicketResponse(ticket: any, agentName?: string | null) {
  return {
    ticket_id: ticket.ticket_id,
    freshservice_ticket_id: ticket.freshservice_ticket_id ?? null,
    title: ticket.title,
    description: ticket.description ?? null,
    use_case: ticket.use_case,
    status: ticket.status,
    priority: ticket.priority,
    sla_deadline: ticket.sla_deadline ? ticket.sla_deadline.toISOString() : null,
    sla_status: ticket.sla_status,
    sla_breach_predicted: ticket.sla_breach_predicted,
    source: ticket.source,
    assigned_agent_id: ticket.assigned_agent_id ?? null,
    assigned_agent_name: agentName ?? null,
    resolution_type: ticket.resolution_type ?? null,
    confidence_score: ticket.confidence_score ? parseFloat(ticket.confidence_score) : null,
    created_at: ticket.created_at.toISOString(),
    updated_at: ticket.updated_at ? ticket.updated_at.toISOString() : null,
    closed_at: ticket.closed_at ? ticket.closed_at.toISOString() : null,
  };
}

router.get("/v1/tickets", async (req, res): Promise<void> => {
  const { status, use_case, priority, sla_status, search, date_from, date_to, page = "1", limit = "20" } = req.query as Record<string, string>;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) conditions.push(eq(ticketsTable.status, status as any));
  if (use_case) conditions.push(eq(ticketsTable.use_case, use_case as any));
  if (priority) conditions.push(eq(ticketsTable.priority, priority as any));
  if (sla_status) conditions.push(eq(ticketsTable.sla_status, sla_status as any));
  if (date_from) conditions.push(gte(ticketsTable.created_at, new Date(date_from)));
  if (date_to) conditions.push(lte(ticketsTable.created_at, new Date(date_to)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [tickets, countResult] = await Promise.all([
    db.select().from(ticketsTable).where(whereClause).orderBy(desc(ticketsTable.created_at)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(ticketsTable).where(whereClause),
  ]);

  const agentIds = tickets.map(t => t.assigned_agent_id).filter(Boolean) as string[];
  const agentMap: Record<string, string> = {};
  if (agentIds.length > 0) {
    const agents = await db.select({ agent_id: agentsTable.agent_id, full_name: agentsTable.full_name }).from(agentsTable);
    agents.forEach(a => { agentMap[a.agent_id] = a.full_name; });
  }

  res.json({
    tickets: tickets.map(t => buildTicketResponse(t, t.assigned_agent_id ? agentMap[t.assigned_agent_id] : null)),
    total: Number(countResult[0]?.count ?? 0),
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/v1/tickets", async (req, res): Promise<void> => {
  const { title, description, use_case, priority = "medium", source } = req.body;

  if (!title || !use_case || !source) {
    res.status(400).json({ error: "title, use_case, and source are required" });
    return;
  }

  const [ticket] = await db.insert(ticketsTable).values({
    title,
    description,
    use_case,
    priority,
    source,
    status: "open",
    sla_status: "safe",
    sla_breach_predicted: false,
  }).returning();

  await db.insert(auditLogsTable).values({
    ticket_id: ticket.ticket_id,
    event_type: "ticket_created",
    actor: "system",
    actor_type: "system",
    details: { title, use_case, source },
  });

  res.status(201).json(buildTicketResponse(ticket));
});

router.get("/v1/tickets/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.ticket_id, id));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  let agentName: string | null = null;
  if (ticket.assigned_agent_id) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.agent_id, ticket.assigned_agent_id));
    agentName = agent?.full_name ?? null;
  }

  const [aiRes] = await db.select().from(aiResolutionsTable).where(eq(aiResolutionsTable.ticket_id, id)).orderBy(desc(aiResolutionsTable.created_at)).limit(1);
  const notes = await db.select().from(ticketNotesTable).where(eq(ticketNotesTable.ticket_id, id)).orderBy(desc(ticketNotesTable.created_at));

  const base = buildTicketResponse(ticket, agentName);
  res.json({
    ...base,
    ai_resolution: aiRes ? {
      resolution_id: aiRes.resolution_id,
      ticket_id: aiRes.ticket_id,
      intent_detected: aiRes.intent_detected ?? null,
      root_cause: aiRes.root_cause ?? null,
      confidence_score: aiRes.confidence_score,
      intent_clarity_score: aiRes.intent_clarity_score ?? null,
      sop_match_score: aiRes.sop_match_score ?? null,
      historical_success_score: aiRes.historical_success_score ?? null,
      input_completeness_score: aiRes.input_completeness_score ?? null,
      decision: aiRes.decision,
      resolution_steps: (aiRes.resolution_steps as string[]) ?? null,
      execution_status: aiRes.execution_status ?? null,
      execution_output: aiRes.execution_output ?? null,
      time_taken_seconds: aiRes.time_taken_seconds ?? null,
      created_at: aiRes.created_at.toISOString(),
    } : null,
    notes: notes.map(n => ({
      note_id: n.note_id,
      ticket_id: n.ticket_id,
      note_type: n.note_type,
      content: n.content,
      created_by: n.created_by ?? null,
      created_at: n.created_at.toISOString(),
    })),
  });
});

router.patch("/v1/tickets/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status, priority, assigned_agent_id } = req.body;

  const updateData: any = { updated_at: new Date() };
  if (status) updateData.status = status;
  if (priority) updateData.priority = priority;
  if (assigned_agent_id !== undefined) updateData.assigned_agent_id = assigned_agent_id;
  if (status === "closed") updateData.closed_at = new Date();

  const [ticket] = await db.update(ticketsTable).set(updateData).where(eq(ticketsTable.ticket_id, id)).returning();
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(buildTicketResponse(ticket));
});

router.delete("/v1/tickets/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [ticket] = await db.delete(ticketsTable).where(eq(ticketsTable.ticket_id, id)).returning();
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json({ success: true, message: "Ticket deleted" });
});

router.post("/v1/tickets/:id/resolve", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.ticket_id, id));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const intentClarity = 0.75 + Math.random() * 0.2;
  const sopMatch = 0.70 + Math.random() * 0.25;
  const historicalSuccess = 0.80;
  const inputCompleteness = 0.90;
  const confidence = (intentClarity * 0.30 + sopMatch * 0.35 + historicalSuccess * 0.25 + inputCompleteness * 0.10) * 100;

  let decision: "auto_resolve" | "review_after" | "escalate" = "escalate";
  if (confidence >= 85) decision = "auto_resolve";
  else if (confidence >= 60) decision = "review_after";

  const steps = [
    `Analyzed ticket: "${ticket.title}"`,
    `Intent detected: ${ticket.use_case.replace(/_/g, " ")}`,
    `SOP match score: ${(sopMatch * 100).toFixed(1)}%`,
    decision === "auto_resolve" ? "Auto-resolution initiated successfully" : "Escalation recommended based on confidence score",
  ];

  const [resolution] = await db.insert(aiResolutionsTable).values({
    ticket_id: id,
    intent_detected: ticket.use_case.replace(/_/g, " "),
    root_cause: `AI analysis of: ${ticket.title}`,
    confidence_score: confidence / 100,
    intent_clarity_score: intentClarity,
    sop_match_score: sopMatch,
    historical_success_score: historicalSuccess,
    input_completeness_score: inputCompleteness,
    decision,
    resolution_steps: steps,
    execution_status: decision === "auto_resolve" ? "success" : "partial",
    execution_output: decision === "auto_resolve" ? "Resolution completed successfully." : "Requires human review.",
    time_taken_seconds: Math.floor(Math.random() * 30) + 5,
  }).returning();

  const newStatus = decision === "auto_resolve" ? "auto_resolved" : decision === "escalate" ? "escalated" : "in_progress";
  await db.update(ticketsTable).set({
    status: newStatus,
    confidence_score: String(confidence / 100),
    resolution_type: decision === "auto_resolve" ? "auto" : "manual",
    updated_at: new Date(),
    ...(newStatus === "auto_resolved" ? { closed_at: new Date() } : {}),
  }).where(eq(ticketsTable.ticket_id, id));

  await db.insert(auditLogsTable).values({
    ticket_id: id,
    event_type: decision === "auto_resolve" ? "auto_resolved" : "escalated",
    actor: "STACK AI",
    actor_type: "ai",
    details: { confidence: confidence.toFixed(1), decision },
  });

  res.json({
    resolution_id: resolution.resolution_id,
    ticket_id: resolution.ticket_id,
    intent_detected: resolution.intent_detected,
    root_cause: resolution.root_cause,
    confidence_score: resolution.confidence_score,
    intent_clarity_score: resolution.intent_clarity_score,
    sop_match_score: resolution.sop_match_score,
    historical_success_score: resolution.historical_success_score,
    input_completeness_score: resolution.input_completeness_score,
    decision: resolution.decision,
    resolution_steps: resolution.resolution_steps,
    execution_status: resolution.execution_status,
    execution_output: resolution.execution_output,
    time_taken_seconds: resolution.time_taken_seconds,
    created_at: resolution.created_at.toISOString(),
  });
});

router.post("/v1/tickets/:id/escalate", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { reason } = req.body;

  const [ticket] = await db.update(ticketsTable).set({ status: "escalated", updated_at: new Date() }).where(eq(ticketsTable.ticket_id, id)).returning();
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    ticket_id: id,
    event_type: "escalated",
    actor: "agent",
    actor_type: "agent",
    details: { reason },
  });

  res.json({ success: true, message: "Ticket escalated" });
});

router.get("/v1/tickets/:id/notes", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const notes = await db.select().from(ticketNotesTable).where(eq(ticketNotesTable.ticket_id, id)).orderBy(desc(ticketNotesTable.created_at));
  res.json(notes.map(n => ({
    note_id: n.note_id,
    ticket_id: n.ticket_id,
    note_type: n.note_type,
    content: n.content,
    created_by: n.created_by ?? null,
    created_at: n.created_at.toISOString(),
  })));
});

router.post("/v1/tickets/:id/notes", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { content, note_type = "human_note" } = req.body;

  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const [note] = await db.insert(ticketNotesTable).values({
    ticket_id: id,
    content,
    note_type,
    created_by: "agent",
  }).returning();

  res.status(201).json({
    note_id: note.note_id,
    ticket_id: note.ticket_id,
    note_type: note.note_type,
    content: note.content,
    created_by: note.created_by ?? null,
    created_at: note.created_at.toISOString(),
  });
});

router.get("/v1/tickets/:id/timeline", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const logs = await db.select().from(auditLogsTable).where(eq(auditLogsTable.ticket_id, id)).orderBy(desc(auditLogsTable.created_at));
  res.json(logs.map(l => ({
    log_id: l.log_id,
    ticket_id: l.ticket_id ?? null,
    event_type: l.event_type,
    actor: l.actor,
    actor_type: l.actor_type,
    details: l.details ?? {},
    ip_address: l.ip_address ?? null,
    created_at: l.created_at.toISOString(),
  })));
});

export default router;
