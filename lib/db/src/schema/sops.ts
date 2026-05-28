import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sopsTable = pgTable("sops", {
  sop_id: uuid("sop_id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  use_case: varchar("use_case", { length: 100 }).notNull(),
  content: text("content").notNull(),
  version: varchar("version", { length: 50 }).default("1.0").notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSopSchema = createInsertSchema(sopsTable).omit({
  sop_id: true,
  created_at: true,
  updated_at: true,
});
export type InsertSop = z.infer<typeof insertSopSchema>;
export type Sop = typeof sopsTable.$inferSelect;
