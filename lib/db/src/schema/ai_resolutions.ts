import {
  pgTable,
  uuid,
  varchar,
  text,
  real,
  integer,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const decisionEnum = pgEnum("decision", [
  "auto_resolve",
  "review_after",
  "escalate",
]);

export const executionStatusEnum = pgEnum("execution_status", [
  "success",
  "failed",
  "timeout",
  "partial",
]);

export const aiResolutionsTable = pgTable("ai_resolutions", {
  resolution_id: uuid("resolution_id").primaryKey().defaultRandom(),
  ticket_id: uuid("ticket_id").notNull(),
  intent_detected: varchar("intent_detected", { length: 255 }),
  root_cause: text("root_cause"),
  sop_matched: uuid("sop_matched"),
  confidence_score: real("confidence_score").notNull().default(0),
  intent_clarity_score: real("intent_clarity_score"),
  sop_match_score: real("sop_match_score"),
  historical_success_score: real("historical_success_score"),
  input_completeness_score: real("input_completeness_score"),
  decision: decisionEnum("decision").notNull(),
  resolution_steps: jsonb("resolution_steps"),
  execution_status: executionStatusEnum("execution_status"),
  execution_output: text("execution_output"),
  time_taken_seconds: integer("time_taken_seconds"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAiResolutionSchema = createInsertSchema(aiResolutionsTable).omit({
  resolution_id: true,
  created_at: true,
});
export type InsertAiResolution = z.infer<typeof insertAiResolutionSchema>;
export type AiResolution = typeof aiResolutionsTable.$inferSelect;
