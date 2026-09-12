import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { messagesTable } from "./messages";
import { profilesTable } from "./profiles";

export const pollVotesTable = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    optionId: text("option_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    msgIdx: index("poll_votes_message_idx").on(t.messageId),
    uniqVote: uniqueIndex("poll_votes_unique").on(t.messageId, t.userId, t.optionId),
  }),
);

export type PollVote = typeof pollVotesTable.$inferSelect;
export type InsertPollVote = typeof pollVotesTable.$inferInsert;
