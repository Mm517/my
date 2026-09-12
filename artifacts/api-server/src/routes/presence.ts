import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { markOnline, getOnlineUserIds } from "../lib/presence";

const router: IRouter = Router();

const lastDbWrite = new Map<string, number>();
const DB_WRITE_INTERVAL_MS = 30_000;

router.post("/presence/heartbeat", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  markOnline(userId);

  const last = lastDbWrite.get(userId) ?? 0;
  const now = Date.now();
  if (now - last >= DB_WRITE_INTERVAL_MS) {
    lastDbWrite.set(userId, now);
    try {
      await db
        .update(profilesTable)
        .set({ lastSeenAt: new Date() })
        .where(eq(profilesTable.id, userId));
    } catch {
      /* ignore */
    }
  }

  res.json({ ok: true });
});

router.get("/presence", requireAuth, async (_req: Request, res: Response) => {
  const online = getOnlineUserIds();
  res.json({ online, count: online.length });
});

export default router;
