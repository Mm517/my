import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { messagesTable } from "./messages";
import { profilesTable } from "./profiles";

export const messageReactionsTable = pgTable(
  "message_reactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("message_reactions_unique_idx").on(t.messageId, t.userId, t.emoji),
    msgIdx: index("message_reactions_message_idx").on(t.messageId),
  }),
);

export type MessageReaction = typeof messageReactionsTable.$inferSelect;
export type InsertMessageReaction = typeof messageReactionsTable.$inferInsert;
