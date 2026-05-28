import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { auditLogsTable, apiCallLogsTable, powershellExecutionsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/logs/audit", async (req, res): Promise<void> => {
  const { event_type, actor_type, date_from, date_to, page = "1", limit = "20" } = req.query as Record<string, string>;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (event_type) conditions.push(eq(auditLogsTable.event_type, event_type));
  if (actor_type) conditions.push(eq(auditLogsTable.actor_type, actor_type as any));
  if (date_from) conditions.push(gte(auditLogsTable.created_at, new Date(date_from)));
  if (date_to) conditions.push(lte(auditLogsTable.created_at, new Date(date_to)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countResult] = await Promise.all([
    db.select().from(auditLogsTable).where(whereClause).orderBy(desc(auditLogsTable.created_at)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(auditLogsTable).where(whereClause),
  ]);

  res.json({
    logs: logs.map(l => ({
      log_id: l.log_id,
      ticket_id: l.ticket_id ?? null,
      event_type: l.event_type,
      actor: l.actor,
      actor_type: l.actor_type,
      details: l.details ?? {},
      ip_address: l.ip_address ?? null,
      created_at: l.created_at.toISOString(),
    })),
    total: Number(countResult[0]?.count ?? 0),
    page: pageNum,
    limit: limitNum,
  });
});

router.get("/v1/logs/api-calls", async (req, res): Promise<void> => {
  const { api_name, date_from, date_to, page = "1", limit = "20" } = req.query as Record<string, string>;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (api_name) conditions.push(eq(apiCallLogsTable.api_name, api_name));
  if (date_from) conditions.push(gte(apiCallLogsTable.called_at, new Date(date_from)));
  if (date_to) conditions.push(lte(apiCallLogsTable.called_at, new Date(date_to)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countResult] = await Promise.all([
    db.select().from(apiCallLogsTable).where(whereClause).orderBy(desc(apiCallLogsTable.called_at)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(apiCallLogsTable).where(whereClause),
  ]);

  res.json({
    logs: logs.map(l => ({
      api_log_id: l.api_log_id,
      ticket_id: l.ticket_id ?? null,
      api_name: l.api_name,
      endpoint: l.endpoint,
      method: l.method,
      request_payload: l.request_payload ?? null,
      response_status: l.response_status,
      response_payload: l.response_payload ?? null,
      duration_ms: l.duration_ms ?? null,
      called_at: l.called_at.toISOString(),
    })),
    total: Number(countResult[0]?.count ?? 0),
    page: pageNum,
    limit: limitNum,
  });
});

router.get("/v1/logs/powershell", async (req, res): Promise<void> => {
  const { date_from, date_to, page = "1", limit = "20" } = req.query as Record<string, string>;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (date_from) conditions.push(gte(powershellExecutionsTable.executed_at, new Date(date_from)));
  if (date_to) conditions.push(lte(powershellExecutionsTable.executed_at, new Date(date_to)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countResult] = await Promise.all([
    db.select().from(powershellExecutionsTable).where(whereClause).orderBy(desc(powershellExecutionsTable.executed_at)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(powershellExecutionsTable).where(whereClause),
  ]);

  res.json({
    logs: logs.map(l => ({
      execution_id: l.execution_id,
      ticket_id: l.ticket_id,
      resolution_id: l.resolution_id ?? null,
      device_name: l.device_name ?? null,
      device_ip: l.device_ip ?? null,
      script_name: l.script_name,
      script_content: l.script_content ?? null,
      execution_status: l.execution_status,
      output_log: l.output_log ?? null,
      executed_at: l.executed_at.toISOString(),
      duration_seconds: l.duration_seconds ?? null,
    })),
    total: Number(countResult[0]?.count ?? 0),
    page: pageNum,
    limit: limitNum,
  });
});

export default router;
