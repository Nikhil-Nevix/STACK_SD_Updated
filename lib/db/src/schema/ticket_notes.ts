import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const noteTypeEnum = pgEnum("note_type", [
  "ai_context",
  "resolution_summary",
  "human_note",
  "system_note",
]);

export const ticketNotesTable = pgTable("ticket_notes", {
  note_id: uuid("note_id").primaryKey().defaultRandom(),
  ticket_id: uuid("ticket_id").notNull(),
  note_type: noteTypeEnum("note_type").default("human_note").notNull(),
  content: text("content").notNull(),
  created_by: varchar("created_by", { length: 255 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTicketNoteSchema = createInsertSchema(ticketNotesTable).omit({
  note_id: true,
  created_at: true,
});
export type InsertTicketNote = z.infer<typeof insertTicketNoteSchema>;
export type TicketNote = typeof ticketNotesTable.$inferSelect;
