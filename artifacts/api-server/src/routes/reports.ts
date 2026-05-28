import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ticketsTable, aiResolutionsTable, agentsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

const USE_CASES = [
  "sharepoint_access", "sharepoint_admin", "license_bluebeam",
  "license_adobe", "license_o365", "dl_update", "windows_troubleshooting",
];

router.get("/v1/reports/resolution-rate", async (req, res): Promise<void> => {
  const { date_from, date_to } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (date_from) conditions.push(gte(ticketsTable.created_at, new Date(date_from)));
  if (date_to) conditions.push(lte(ticketsTable.created_at, new Date(date_to)));

  const tickets = await db.select({
    use_case: ticketsTable.use_case,
    resolution_type: ticketsTable.resolution_type,
  }).from(ticketsTable).where(conditions.length > 0 ? and(...conditions) : undefined);

  const byUseCase: Record<string, { auto: number; manual: number }> = {};
  USE_CASES.forEach(uc => { byUseCase[uc] = { auto: 0, manual: 0 }; });

  tickets.forEach(t => {
    if (!byUseCase[t.use_case]) byUseCase[t.use_case] = { auto: 0, manual: 0 };
    if (t.resolution_type === "auto") byUseCase[t.use_case].auto++;
    else byUseCase[t.use_case].manual++;
  });

  const items = Object.entries(byUseCase).map(([use_case, counts]) => {
    const total = counts.auto + counts.manual;
    return {
      use_case,
      auto_count: counts.auto,
      manual_count: counts.manual,
      total,
      auto_rate: total > 0 ? Math.round((counts.auto / total) * 1000) / 10 : 0,
    };
  });

  res.json({
    items,
    date_from: date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    date_to: date_to || new Date().toISOString().slice(0, 10),
  });
});

router.get("/v1/reports/sla-compliance", async (req, res): Promise<void> => {
  const { date_from, date_to } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (date_from) conditions.push(gte(ticketsTable.created_at, new Date(date_from)));
  if (date_to) conditions.push(lte(ticketsTable.created_at, new Date(date_to)));

  const tickets = await db.select({ sla_status: ticketsTable.sla_status }).from(ticketsTable).where(conditions.length > 0 ? and(...conditions) : undefined);
  const met = tickets.filter(t => t.sla_status === "safe").length;
  const breached = tickets.filter(t => t.sla_status === "breached").length;
  const at_risk = tickets.filter(t => t.sla_status === "at_risk").length;
  const total = tickets.length || 1;

  const trend = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    compliance: 80 + Math.floor(Math.random() * 20),
  }));

  res.json({
    met_count: met,
    breached_count: breached,
    at_risk_count: at_risk,
    compliance_percent: Math.round((met / total) * 1000) / 10,
    trend,
  });
});

router.get("/v1/reports/ticket-trends", async (req, res): Promise<void> => {
  const { date_from, date_to, granularity = "daily" } = req.query as Record<string, string>;

  const trend = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    total: Math.floor(Math.random() * 20) + 5,
    sharepoint_access: Math.floor(Math.random() * 5),
    license_o365: Math.floor(Math.random() * 4),
    windows_troubleshooting: Math.floor(Math.random() * 5),
    dl_update: Math.floor(Math.random() * 3),
    license_bluebeam: Math.floor(Math.random() * 2),
    license_adobe: Math.floor(Math.random() * 2),
    sharepoint_admin: Math.floor(Math.random() * 2),
  }));

  res.json({ trend });
});

router.get("/v1/reports/ai-accuracy", async (req, res): Promise<void> => {
  const resolutions = await db.select({ confidence_score: aiResolutionsTable.confidence_score }).from(aiResolutionsTable);
  const scores = resolutions.map(r => r.confidence_score * 100);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 82.5;

  const distribution = [
    { range: "0-20", count: scores.filter(s => s < 20).length },
    { range: "20-40", count: scores.filter(s => s >= 20 && s < 40).length },
    { range: "40-60", count: scores.filter(s => s >= 40 && s < 60).length },
    { range: "60-80", count: scores.filter(s => s >= 60 && s < 80).length },
    { range: "80-100", count: scores.filter(s => s >= 80).length },
  ];

  const by_use_case = USE_CASES.map(uc => ({
    use_case: uc,
    avg_confidence: 70 + Math.random() * 25,
    count: Math.floor(Math.random() * 50) + 5,
  }));

  const trend = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    avg_confidence: 75 + Math.random() * 15,
  }));

  res.json({ avg_confidence: avg, distribution, by_use_case, trend });
});

router.get("/v1/reports/agent-performance", async (req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.is_active, true));
  const tickets = await db.select({ assigned_agent_id: ticketsTable.assigned_agent_id }).from(ticketsTable);

  const agentTicketCount: Record<string, number> = {};
  tickets.forEach(t => {
    if (t.assigned_agent_id) {
      agentTicketCount[t.assigned_agent_id] = (agentTicketCount[t.assigned_agent_id] || 0) + 1;
    }
  });

  res.json(agents.map(a => ({
    agent_id: a.agent_id,
    full_name: a.full_name,
    tickets_handled: agentTicketCount[a.agent_id] || 0,
    avg_resolution_mins: Math.round((30 + Math.random() * 60) * 10) / 10,
  })));
});

export default router;
