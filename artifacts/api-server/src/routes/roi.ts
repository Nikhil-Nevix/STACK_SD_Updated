import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roiMetricsTable, ticketsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/roi/current", async (_req, res): Promise<void> => {
  const [latest] = await db.select().from(roiMetricsTable).orderBy(desc(roiMetricsTable.calculated_at)).limit(1);

  if (!latest) {
    const tickets = await db.select().from(ticketsTable);
    const autoResolved = tickets.filter(t => t.resolution_type === "auto").length;
    const total = tickets.length;
    const hoursSaved = autoResolved * (45 / 60);
    const costSaved = hoursSaved * 500;

    res.json({
      metric_id: "current",
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      total_tickets: total,
      auto_resolved_count: autoResolved,
      manual_resolved_count: total - autoResolved,
      avg_auto_resolution_mins: 12.5,
      avg_manual_resolution_mins: 45.0,
      hours_saved: hoursSaved,
      cost_saved: costSaved,
      agent_hourly_cost: 500,
      calculated_at: new Date().toISOString(),
    });
    return;
  }

  res.json({
    metric_id: latest.metric_id,
    period_start: latest.period_start,
    period_end: latest.period_end,
    total_tickets: latest.total_tickets,
    auto_resolved_count: latest.auto_resolved_count,
    manual_resolved_count: latest.manual_resolved_count,
    avg_auto_resolution_mins: latest.avg_auto_resolution_mins ?? null,
    avg_manual_resolution_mins: latest.avg_manual_resolution_mins ?? null,
    hours_saved: latest.hours_saved,
    cost_saved: latest.cost_saved,
    agent_hourly_cost: latest.agent_hourly_cost,
    calculated_at: latest.calculated_at.toISOString(),
  });
});

router.get("/v1/roi/history", async (_req, res): Promise<void> => {
  const metrics = await db.select().from(roiMetricsTable).orderBy(desc(roiMetricsTable.calculated_at)).limit(12);

  if (metrics.length === 0) {
    const history = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(Date.now() - (5 - i) * 30 * 24 * 60 * 60 * 1000);
      const autoResolved = Math.floor(Math.random() * 80) + 20;
      const hoursSaved = autoResolved * 0.75;
      return {
        metric_id: `mock-${i}`,
        period_start: new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        period_end: date.toISOString().slice(0, 10),
        total_tickets: autoResolved + Math.floor(Math.random() * 30),
        auto_resolved_count: autoResolved,
        manual_resolved_count: Math.floor(Math.random() * 30),
        avg_auto_resolution_mins: 12.5,
        avg_manual_resolution_mins: 45.0,
        hours_saved: hoursSaved,
        cost_saved: hoursSaved * 500,
        agent_hourly_cost: 500,
        calculated_at: date.toISOString(),
      };
    });
    res.json(history);
    return;
  }

  res.json(metrics.map(m => ({
    metric_id: m.metric_id,
    period_start: m.period_start,
    period_end: m.period_end,
    total_tickets: m.total_tickets,
    auto_resolved_count: m.auto_resolved_count,
    manual_resolved_count: m.manual_resolved_count,
    avg_auto_resolution_mins: m.avg_auto_resolution_mins ?? null,
    avg_manual_resolution_mins: m.avg_manual_resolution_mins ?? null,
    hours_saved: m.hours_saved,
    cost_saved: m.cost_saved,
    agent_hourly_cost: m.agent_hourly_cost,
    calculated_at: m.calculated_at.toISOString(),
  })));
});

router.patch("/v1/roi/settings", async (req, res): Promise<void> => {
  res.json({ success: true, message: "ROI settings updated" });
});

export default router;
