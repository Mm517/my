import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { anonymizeName } from "../lib/anonymize";
import { isUserOnline } from "../lib/presence";

const router: IRouter = Router();

router.get("/users/directory", requireAuth, async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: profilesTable.id,
      name: profilesTable.displayName,
      grade: profilesTable.grade,
    })
    .from(profilesTable)
    .where(eq(profilesTable.isBanned, false));
  const seen = new Map<string, { anonymousName: string; ids: string[]; isOnline: boolean; grade: string | null }>();
  for (const r of rows) {
    const anon = anonymizeName(r.name);
    const entry = seen.get(anon);
    if (entry) {
      entry.ids.push(r.id);
      if (isUserOnline(r.id)) entry.isOnline = true;
    } else {
      seen.set(anon, { anonymousName: anon, ids: [r.id], isOnline: isUserOnline(r.id), grade: r.grade });
    }
  }
  const directory = Array.from(seen.values()).sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.anonymousName.localeCompare(b.anonymousName);
  });
  res.json(directory);
});

export default router;
