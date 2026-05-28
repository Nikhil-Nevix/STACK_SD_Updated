import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const actorTypeEnum = pgEnum("actor_type", [
  "user",
  "ai",
  "agent",
  "system",
]);

export const auditLogsTable = pgTable("audit_logs", {
  log_id: uuid("log_id").primaryKey().defaultRandom(),
  ticket_id: uuid("ticket_id"),
  event_type: varchar("event_type", { length: 100 }).notNull(),
  actor: varchar("actor", { length: 255 }).notNull(),
  actor_type: actorTypeEnum("actor_type").notNull(),
  details: jsonb("details"),
  ip_address: varchar("ip_address", { length: 100 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  log_id: true,
  created_at: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
