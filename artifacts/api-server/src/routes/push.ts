import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";

import { db, pushSubscriptionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getVapidPublicKey } from "../lib/push";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: "Push not initialized" });
    return;
  }
  res.json({ publicKey: key });
});

router.post("/push/subscribe", requireAuth, async (req, res) => {
  const me = req.user!;
  const body = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  } | null;

  const endpoint = body?.endpoint?.trim();
  const p256dh = body?.keys?.p256dh?.trim();
  const auth = body?.keys?.auth?.trim();
  const userAgent = body?.userAgent?.toString().slice(0, 500) ?? null;

  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "Invalid subscription payload" });
    return;
  }

  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({
        userId: me.id,
        endpoint,
        p256dh,
        auth,
        userAgent,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: {
          userId: me.id,
          p256dh,
          auth,
          userAgent,
          lastSeenAt: new Date(),
        },
      });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to upsert push subscription");
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.post("/push/unsubscribe", requireAuth, async (req, res) => {
  const me = req.user!;
  const body = req.body as { endpoint?: string } | null;
  const endpoint = body?.endpoint?.trim();
  if (!endpoint) {
    res.status(400).json({ error: "Missing endpoint" });
    return;
  }
  try {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.endpoint, endpoint),
          eq(pushSubscriptionsTable.userId, me.id),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete push subscription");
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

export default router;
