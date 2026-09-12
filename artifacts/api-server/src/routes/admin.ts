import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import {
  db,
  profilesTable,
  messagesTable,
  studyPlansTable,
  challengesTable,
  chatSettingsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { AdminUpdateUserBody } from "@workspace/api-zod";
import { anonymizeName } from "../lib/anonymize";
import { isUserOnline } from "../lib/presence";
import { logActivity } from "../lib/activity";
import { routeParam } from "../lib/routeParam";

const router: IRouter = Router();

router.use(requireAuth, requireAdmin);

// messages/chat_settings are in the supabase_realtime publication — deletes
// below stream to clients automatically, no broadcast() needed.

function adminUserShape(u: typeof profilesTable.$inferSelect) {
  return {
    id: u.id,
    name: u.displayName,
    anonymousName: anonymizeName(u.displayName),
    grade: u.grade,
    isAdmin: u.role === "admin",
    isBanned: u.isBanned,
    isMuted: u.isMuted,
    messagesSent: u.messagesSent,
    joinedAt: u.joinedAt,
    lastSeenAt: u.lastSeenAt,
    isOnline: isUserOnline(u.id),
  };
}

router.get("/admin/users", async (_req: Request, res: Response) => {
  const rows = await db.select().from(profilesTable).orderBy(desc(profilesTable.joinedAt));
  res.json(rows.map(adminUserShape));
});

router.patch("/admin/users/:id", async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.isBanned !== undefined) updates.isBanned = parsed.data.isBanned;
  if (parsed.data.isMuted !== undefined) updates.isMuted = parsed.data.isMuted;
  if (parsed.data.isAdmin !== undefined) updates.role = parsed.data.isAdmin ? "admin" : "user";

  if (Object.keys(updates).length === 0) {
    const [u] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
    if (!u) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(adminUserShape(u));
    return;
  }

  const [updated] = await db
    .update(profilesTable)
    .set(updates)
    .where(eq(profilesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await logActivity(req.user!.id, "admin.user.update", id, updates);
  res.json(adminUserShape(updated));
});

router.get("/admin/users/:id/study-plans", async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const rows = await db
    .select()
    .from(studyPlansTable)
    .where(eq(studyPlansTable.userId, id))
    .orderBy(desc(studyPlansTable.createdAt));
  res.json(rows);
});

router.get("/admin/users/:id/challenges", async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const rows = await db
    .select()
    .from(challengesTable)
    .where(eq(challengesTable.userId, id))
    .orderBy(desc(challengesTable.createdAt));
  res.json(rows);
});

router.get("/admin/stats", async (_req: Request, res: Response) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ count: totalUsers }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(profilesTable);
  const [{ count: totalMessages }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(messagesTable)
    .where(eq(messagesTable.deleted, false));
  const [{ count: bannedUsers }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(profilesTable)
    .where(eq(profilesTable.isBanned, true));
  const [{ count: mutedUsers }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(profilesTable)
    .where(eq(profilesTable.isMuted, true));
  const [{ count: messagesToday }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(messagesTable)
    .where(and(eq(messagesTable.deleted, false), gte(messagesTable.createdAt, startOfDay)));
  const [settings] = await db.select().from(chatSettingsTable).limit(1);

  const [{ count: flaggedMessages }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(messagesTable)
    .where(and(eq(messagesTable.deleted, false), eq(messagesTable.filtered, true)));

  res.json({
    totalUsers,
    totalMessages,
    bannedUsers,
    mutedUsers,
    messagesToday,
    flaggedMessages,
    chatEnabled: settings?.chatEnabled ?? true,
  });
});

// Recent flagged messages (profanity filter triggered). Slim shape so the
// admin can quickly review and delete them without pulling reactions/polls.
// Email is intentionally not included: it now lives in Supabase's
// auth.users, not public.profiles, and isn't exposed to this app's DB role.
router.get("/admin/messages/flagged", async (req: Request, res: Response) => {
  const limitRaw = Number(req.query.limit ?? 50);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
  const rows = await db
    .select({
      id: messagesTable.id,
      userId: messagesTable.userId,
      content: messagesTable.content,
      attachment: messagesTable.attachment,
      createdAt: messagesTable.createdAt,
      authorName: profilesTable.displayName,
    })
    .from(messagesTable)
    .innerJoin(profilesTable, eq(messagesTable.userId, profilesTable.id))
    .where(and(eq(messagesTable.deleted, false), eq(messagesTable.filtered, true)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);
  res.json(
    rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      anonymousName: anonymizeName(r.authorName),
      authorRealName: r.authorName,
      content: r.content,
      attachment: r.attachment ?? null,
      createdAt: r.createdAt,
    })),
  );
});

// Soft-delete a flagged message from the admin queue.
router.delete("/admin/messages/:id", async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.update(messagesTable).set({ deleted: true }).where(eq(messagesTable.id, id));
  await logActivity(req.user!.id, "admin.message.delete", id, { reason: "flagged" });
  res.status(204).end();
});

export default router;
