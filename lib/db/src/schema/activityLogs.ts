import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

export const activityLogsTable = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => profilesTable.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    target: text("target"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("activity_logs_created_idx").on(t.createdAt),
    userIdx: index("activity_logs_user_idx").on(t.userId),
  }),
);

export type ActivityLog = typeof activityLogsTable.$inferSelect;
export type InsertActivityLog = typeof activityLogsTable.$inferInsert;
