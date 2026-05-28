import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assignmentModeEnum = pgEnum("assignment_mode", [
  "round_robin",
  "first_available",
  "priority",
]);

export const agentGroupsTable = pgTable("agent_groups", {
  group_id: uuid("group_id").primaryKey().defaultRandom(),
  group_name: varchar("group_name", { length: 255 }).notNull(),
  use_case: varchar("use_case", { length: 100 }).notNull(),
  assignment_mode: assignmentModeEnum("assignment_mode").default("round_robin").notNull(),
  freshservice_group_id: varchar("freshservice_group_id", { length: 255 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentGroupMembersTable = pgTable("agent_group_members", {
  member_id: uuid("member_id").primaryKey().defaultRandom(),
  group_id: uuid("group_id").notNull(),
  agent_id: uuid("agent_id").notNull(),
  priority_order: integer("priority_order").default(1).notNull(),
  joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAgentGroupSchema = createInsertSchema(agentGroupsTable).omit({
  group_id: true,
  created_at: true,
});
export type InsertAgentGroup = z.infer<typeof insertAgentGroupSchema>;
export type AgentGroup = typeof agentGroupsTable.$inferSelect;
