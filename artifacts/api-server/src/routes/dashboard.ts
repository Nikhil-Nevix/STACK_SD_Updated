import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ticketsTable, auditLogsTable } from "@workspace/db";
import { eq, desc, gte, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [allTickets, resolvedToday, totalWithStatus] = await Promise.all([
    db.select().from(ticketsTable),
    db.select({ count: sql<number>`count(*)` }).from(ticketsTable).where(
      and(eq(ticketsTable.status, "auto_resolved"), gte(ticketsTable.updated_at, today))
    ),
    db.select({ status: ticketsTable.status, count: sql<number>`count(*)` }).from(ticketsTable).groupBy(ticketsTable.status),
  ]);

  const openTickets = allTickets.filter(t => t.status === "open" || t.status === "in_progress");
  const closedTickets = allTickets.filter(t => t.status === "auto_resolved" || t.status === "closed");
  const autoResolved = allTickets.filter(t => t.resolution_type === "auto");
  const slaAtRisk = allTickets.filter(t => t.sla_status === "at_risk" || t.sla_status === "breached");
  const slaMet = allTickets.filter(t => t.sla_status === "safe").length;

  const ticketsByUseCase: Record<string, number> = {};
  const ticketsByStatus: Record<string, number> = {};

  allTickets.forEach(t => {
    ticketsByUseCase[t.use_case] = (ticketsByUseCase[t.use_case] || 0) + 1;
    ticketsByStatus[t.status] = (ticketsByStatus[t.status] || 0) + 1;
  });

  const total = allTickets.length || 1;
  const slaMetPercent = total > 0 ? (slaMet / total) * 100 : 100;
  const autoRate = total > 0 ? (autoResolved.length / total) * 100 : 0;

  res.json({
    total_open: openTickets.length,
    resolved_today: Number(resolvedToday[0]?.count ?? 0),
    sla_met_percent: Math.round(slaMetPercent * 10) / 10,
    auto_resolution_rate: Math.round(autoRate * 10) / 10,
    tickets_by_use_case: ticketsByUseCase,
    tickets_by_status: ticketsByStatus,
    sla_at_risk_count: slaAtRisk.length,
    avg_resolution_time_mins: 18.5,
  });
});

router.get("/v1/dashboard/live-queue", async (_req, res): Promise<void> => {
  const tickets = await db.select().from(ticketsTable)
    .where(eq(ticketsTable.status, "open"))
    .orderBy(desc(ticketsTable.created_at))
    .limit(50);

  res.json(tickets.map(t => ({
    ticket_id: t.ticket_id,
    freshservice_ticket_id: t.freshservice_ticket_id ?? null,
    title: t.title,
    description: t.description ?? null,
    use_case: t.use_case,
    status: t.status,
    priority: t.priority,
    sla_deadline: t.sla_deadline ? t.sla_deadline.toISOString() : null,
    sla_status: t.sla_status,
    sla_breach_predicted: t.sla_breach_predicted,
    source: t.source,
    assigned_agent_id: t.assigned_agent_id ?? null,
    assigned_agent_name: null,
    resolution_type: t.resolution_type ?? null,
    confidence_score: t.confidence_score ? parseFloat(t.confidence_score) : null,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at ? t.updated_at.toISOString() : null,
    closed_at: t.closed_at ? t.closed_at.toISOString() : null,
  })));
});

router.get("/v1/dashboard/sla-at-risk", async (_req, res): Promise<void> => {
  const tickets = await db.select().from(ticketsTable)
    .where(eq(ticketsTable.sla_status, "at_risk"))
    .orderBy(desc(ticketsTable.created_at))
    .limit(20);

  res.json(tickets.map(t => ({
    ticket_id: t.ticket_id,
    freshservice_ticket_id: t.freshservice_ticket_id ?? null,
    title: t.title,
    description: t.description ?? null,
    use_case: t.use_case,
    status: t.status,
    priority: t.priority,
    sla_deadline: t.sla_deadline ? t.sla_deadline.toISOString() : null,
    sla_status: t.sla_status,
    sla_breach_predicted: t.sla_breach_predicted,
    source: t.source,
    assigned_agent_id: t.assigned_agent_id ?? null,
    assigned_agent_name: null,
    resolution_type: t.resolution_type ?? null,
    confidence_score: t.confidence_score ? parseFloat(t.confidence_score) : null,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at ? t.updated_at.toISOString() : null,
    closed_at: t.closed_at ? t.closed_at.toISOString() : null,
  })));
});

router.get("/v1/dashboard/activity", async (_req, res): Promise<void> => {
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.created_at)).limit(20);
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
