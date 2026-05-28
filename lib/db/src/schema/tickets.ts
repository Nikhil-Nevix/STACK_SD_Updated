import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const useCaseEnum = pgEnum("use_case", [
  "sharepoint_access",
  "sharepoint_admin",
  "license_bluebeam",
  "license_adobe",
  "license_o365",
  "dl_update",
  "windows_troubleshooting",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "auto_resolved",
  "escalated",
  "closed",
]);

export const priorityEnum = pgEnum("priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const sourceEnum = pgEnum("source", [
  "freshservice",
  "web_dashboard",
  "google_chat",
]);

export const slaStatusEnum = pgEnum("sla_status", [
  "safe",
  "at_risk",
  "breached",
]);

export const resolutionTypeEnum = pgEnum("resolution_type", [
  "auto",
  "manual",
]);

export const ticketsTable = pgTable("tickets", {
  ticket_id: uuid("ticket_id").primaryKey().defaultRandom(),
  freshservice_ticket_id: varchar("freshservice_ticket_id", { length: 255 }).unique(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  use_case: useCaseEnum("use_case").notNull(),
  status: ticketStatusEnum("status").default("open").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  sla_deadline: timestamp("sla_deadline", { withTimezone: true }),
  sla_status: slaStatusEnum("sla_status").default("safe").notNull(),
  sla_breach_predicted: boolean("sla_breach_predicted").default(false).notNull(),
  source: sourceEnum("source").notNull(),
  user_email: varchar("user_email", { length: 255 }),
  assigned_agent_id: uuid("assigned_agent_id"),
  resolution_type: resolutionTypeEnum("resolution_type"),
  confidence_score: text("confidence_score"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  closed_at: timestamp("closed_at", { withTimezone: true }),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  ticket_id: true,
  created_at: true,
  updated_at: true,
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
