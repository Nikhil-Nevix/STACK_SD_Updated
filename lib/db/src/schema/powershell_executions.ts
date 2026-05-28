import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const powershellExecutionsTable = pgTable("powershell_executions", {
  execution_id: uuid("execution_id").primaryKey().defaultRandom(),
  ticket_id: uuid("ticket_id").notNull(),
  resolution_id: uuid("resolution_id"),
  device_name: varchar("device_name", { length: 255 }),
  device_ip: varchar("device_ip", { length: 100 }),
  script_name: varchar("script_name", { length: 255 }).notNull(),
  script_content: text("script_content"),
  execution_status: varchar("execution_status", { length: 50 }).notNull(),
  output_log: text("output_log"),
  executed_at: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
  duration_seconds: integer("duration_seconds"),
});

export const insertPsExecutionSchema = createInsertSchema(powershellExecutionsTable).omit({
  execution_id: true,
  executed_at: true,
});
export type InsertPsExecution = z.infer<typeof insertPsExecutionSchema>;
export type PsExecution = typeof powershellExecutionsTable.$inferSelect;
