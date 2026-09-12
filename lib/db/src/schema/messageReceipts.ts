import { pgTable, uuid, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { messagesTable } from "./messages";
import { profilesTable } from "./profiles";

/**
 * Replaces the old `messages.delivered_to` / `messages.seen_by` JSONB arrays
 * with a proper table (matches supabase/migrations/001_initial_schema.sql),
 * which is what lets delivered/seen updates flow through Postgres Changes
 * instead of a Socket.io `message:receipt` event.
 */
export const messageReceiptsTable = pgTable(
  "message_receipts",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    seenAt: timestamp("seen_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.messageId, t.userId] }),
    userIdx: index("message_receipts_user_idx").on(t.userId),
  }),
);

export type MessageReceipt = typeof messageReceiptsTable.$inferSelect;
export type InsertMessageReceipt = typeof messageReceiptsTable.$inferInsert;
