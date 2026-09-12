import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, chatSettingsTable, profilesTable, messagesTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { UpdateChatStateBody } from "@workspace/api-zod";
import { logActivity } from "../lib/activity";
import { getOnlineUserIds } from "../lib/presence";

const router: IRouter = Router();

async function getOrCreateSettings() {
  const [row] = await db.select().from(chatSettingsTable).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(chatSettingsTable)
    .values({ id: 1, chatEnabled: true })
    .returning();
  return created;
}

async function buildState() {
  const settings = await getOrCreateSettings();
  const [{ count: memberCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(profilesTable)
    .where(eq(profilesTable.isBanned, false));
  const [{ count: pinnedCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(messagesTable)
    .where(and(eq(messagesTable.deleted, false), eq(messagesTable.isPinned, true)));
  const onlineCount = getOnlineUserIds().length;
  return {
    chatEnabled: settings.chatEnabled,
    announcement: settings.announcement,
    memberCount,
    pinnedCount,
    onlineCount,
    updatedAt: settings.updatedAt,
  };
}

// chat_settings is in the supabase_realtime publication, so admin updates
// below stream to clients automatically — no broadcast() call needed.

router.get("/chat/state", requireAuth, async (_req: Request, res: Response) => {
  res.json(await buildState());
});

router.patch(
  "/chat/state",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const parsed = UpdateChatStateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    await getOrCreateSettings();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.chatEnabled !== undefined) updates.chatEnabled = parsed.data.chatEnabled;
    if (parsed.data.announcement !== undefined) updates.announcement = parsed.data.announcement;

    await db
      .update(chatSettingsTable)
      .set(updates)
      .where(eq(chatSettingsTable.id, 1))
      .returning();

    const payload = await buildState();
    await logActivity(req.user!.id, "admin.chat.update", null, parsed.data);
    res.json(payload);
  },
);

export default router;
