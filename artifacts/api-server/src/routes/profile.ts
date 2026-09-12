import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  profilesTable,
  studyPlansTable,
  challengesTable,
} from "@workspace/db";
import { requireAuth, publicUser } from "../middlewares/auth";
import {
  UpdateMyProfileBody,
  CreateStudyPlanBody,
  CreateChallengeBody,
} from "@workspace/api-zod";
import { routeParam } from "../lib/routeParam";

const router: IRouter = Router();

router.patch("/me/profile", requireAuth, async (req: Request, res: Response) => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.displayName = parsed.data.name;
  if (parsed.data.grade !== undefined) updates.grade = parsed.data.grade;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  if (Object.keys(updates).length === 0) {
    res.json(publicUser(req.user!));
    return;
  }

  const [updated] = await db
    .update(profilesTable)
    .set(updates)
    .where(eq(profilesTable.id, req.user!.id))
    .returning();

  res.json(publicUser(updated));
});

// Study plans
router.get("/study-plans", requireAuth, async (req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(studyPlansTable)
    .where(eq(studyPlansTable.userId, req.user!.id))
    .orderBy(desc(studyPlansTable.createdAt));
  res.json(rows);
});

router.post("/study-plans", requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateStudyPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(studyPlansTable)
    .values({
      userId: req.user!.id,
      title: parsed.data.title,
      details: parsed.data.details,
      subject: parsed.data.subject ?? null,
      targetDate: parsed.data.targetDate ?? null,
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/study-plans/:id", requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  await db
    .delete(studyPlansTable)
    .where(and(eq(studyPlansTable.id, id), eq(studyPlansTable.userId, req.user!.id)));
  res.status(204).end();
});

// Challenges
router.get("/challenges", requireAuth, async (req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(challengesTable)
    .where(eq(challengesTable.userId, req.user!.id))
    .orderBy(desc(challengesTable.createdAt));
  res.json(rows);
});

router.post("/challenges", requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateChallengeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(challengesTable)
    .values({
      userId: req.user!.id,
      title: parsed.data.title,
      details: parsed.data.details,
      difficulty: parsed.data.difficulty,
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/challenges/:id", requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  await db
    .delete(challengesTable)
    .where(and(eq(challengesTable.id, id), eq(challengesTable.userId, req.user!.id)));
  res.status(204).end();
});

export default router;
