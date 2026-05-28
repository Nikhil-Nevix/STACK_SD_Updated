import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentRoleEnum = pgEnum("agent_role", ["admin", "agent", "readonly"]);

export const agentsTable = pgTable("agents", {
  agent_id: uuid("agent_id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  full_name: varchar("full_name", { length: 255 }).notNull(),
  role: agentRoleEnum("role").default("agent").notNull(),
  password_hash: varchar("password_hash", { length: 255 }),
  freshservice_agent_id: varchar("freshservice_agent_id", { length: 255 }),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  agent_id: true,
  created_at: true,
});
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
