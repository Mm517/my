import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

export const challengesTable = pgTable("challenges", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  details: text("details").notNull(),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Challenge = typeof challengesTable.$inferSelect;
export type InsertChallenge = typeof challengesTable.$inferInsert;
