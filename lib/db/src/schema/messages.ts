import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

export type MessageAttachment = {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "image" | "pdf" | "doc" | "file";
};

export type MessagePoll = {
  question: string;
  options: { id: string; text: string }[];
  allowMultiple: boolean;
  closesAt: string | null;
  isClosed: boolean;
};

export const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    groupId: uuid("group_id"),
    content: text("content").notNull().default(""),
    attachment: jsonb("attachment").$type<MessageAttachment | null>(),
    poll: jsonb("poll").$type<MessagePoll | null>(),
    parentId: uuid("parent_id").references((): AnyPgColumn => messagesTable.id, {
      onDelete: "set null",
    }),
    isPinned: boolean("is_pinned").notNull().default(false),
    edited: boolean("edited").notNull().default(false),
    filtered: boolean("filtered").notNull().default(false),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("messages_created_idx").on(t.createdAt),
    userIdx: index("messages_user_idx").on(t.userId),
    parentIdx: index("messages_parent_idx").on(t.parentId),
    pinnedIdx: index("messages_pinned_idx").on(t.isPinned),
  }),
);

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;
