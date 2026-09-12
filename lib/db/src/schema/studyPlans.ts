import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

export const studyPlansTable = pgTable("study_plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subject: text("subject"),
  details: text("details").notNull(),
  targetDate: timestamp("target_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StudyPlan = typeof studyPlansTable.$inferSelect;
export type InsertStudyPlan = typeof studyPlansTable.$inferInsert;
