import {
  pgTable,
  uuid,
  varchar,
  real,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const confidenceThresholdsTable = pgTable("confidence_thresholds", {
  threshold_id: uuid("threshold_id").primaryKey().defaultRandom(),
  use_case: varchar("use_case", { length: 100 }).unique().notNull(),
  auto_resolve_min: real("auto_resolve_min").default(85.0).notNull(),
  review_after_min: real("review_after_min").default(60.0).notNull(),
  updated_by: uuid("updated_by"),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const slaConfigsTable = pgTable("sla_configs", {
  sla_id: uuid("sla_id").primaryKey().defaultRandom(),
  use_case: varchar("use_case", { length: 100 }).notNull(),
  priority: varchar("priority", { length: 50 }).notNull(),
  resolution_hours: integer("resolution_hours").notNull(),
  warning_threshold_percent: real("warning_threshold_percent").default(75.0).notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const roiMetricsTable = pgTable("roi_metrics", {
  metric_id: uuid("metric_id").primaryKey().defaultRandom(),
  period_start: varchar("period_start", { length: 20 }).notNull(),
  period_end: varchar("period_end", { length: 20 }).notNull(),
  total_tickets: integer("total_tickets").default(0).notNull(),
  auto_resolved_count: integer("auto_resolved_count").default(0).notNull(),
  manual_resolved_count: integer("manual_resolved_count").default(0).notNull(),
  avg_auto_resolution_mins: real("avg_auto_resolution_mins"),
  avg_manual_resolution_mins: real("avg_manual_resolution_mins"),
  hours_saved: real("hours_saved").default(0).notNull(),
  cost_saved: real("cost_saved").default(0).notNull(),
  agent_hourly_cost: real("agent_hourly_cost").default(500.0).notNull(),
  calculated_at: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertConfidenceThresholdSchema = createInsertSchema(confidenceThresholdsTable).omit({
  threshold_id: true,
  updated_at: true,
});
export type InsertConfidenceThreshold = z.infer<typeof insertConfidenceThresholdSchema>;

export const insertSlaConfigSchema = createInsertSchema(slaConfigsTable).omit({
  sla_id: true,
  updated_at: true,
});
export type InsertSlaConfig = z.infer<typeof insertSlaConfigSchema>;

export const insertRoiMetricSchema = createInsertSchema(roiMetricsTable).omit({
  metric_id: true,
  calculated_at: true,
});
export type InsertRoiMetric = z.infer<typeof insertRoiMetricSchema>;
