import { pgTable, pgSchema, uuid, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";

// auth.users is managed entirely by Supabase Auth — we only ever reference
// its id (uuid), never read/write it directly from this app.
const authSchema = pgSchema("auth");
export const authUsersTable = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const profilesTable = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsersTable.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().default("Student"),
    username: text("username"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    grade: text("grade"),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    isBanned: boolean("is_banned").notNull().default(false),
    isMuted: boolean("is_muted").notNull().default(false),
    messagesSent: integer("messages_sent").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usernameIdx: index("profiles_username_idx").on(t.username),
    lastSeenIdx: index("profiles_last_seen_idx").on(t.lastSeenAt),
  }),
);

export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = typeof profilesTable.$inferInsert;
