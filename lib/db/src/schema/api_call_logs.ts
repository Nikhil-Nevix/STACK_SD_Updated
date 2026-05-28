import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiCallLogsTable = pgTable("api_call_logs", {
  api_log_id: uuid("api_log_id").primaryKey().defaultRandom(),
  ticket_id: uuid("ticket_id"),
  api_name: varchar("api_name", { length: 100 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  request_payload: jsonb("request_payload"),
  response_status: integer("response_status").notNull(),
  response_payload: jsonb("response_payload"),
  duration_ms: integer("duration_ms"),
  called_at: timestamp("called_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertApiCallLogSchema = createInsertSchema(apiCallLogsTable).omit({
  api_log_id: true,
  called_at: true,
});
export type InsertApiCallLog = z.infer<typeof insertApiCallLogSchema>;
export type ApiCallLog = typeof apiCallLogsTable.$inferSelect;
