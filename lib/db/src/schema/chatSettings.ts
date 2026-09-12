import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * VAPID keys no longer live here (moved to Edge Function secrets per
 * MIGRATION_MAP.md risk #5) — this table only holds public chat state now.
 */
export const chatSettingsTable = pgTable("chat_settings", {
  id: integer("id").primaryKey().default(1),
  chatEnabled: boolean("chat_enabled").notNull().default(true),
  announcement: text("announcement"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatSettings = typeof chatSettingsTable.$inferSelect;
