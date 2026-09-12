import { db, activityLogsTable } from "@workspace/db";
import { logger } from "./logger";

export type ActivityAction =
  | "user.signup"
  | "user.login"
  | "user.profile.update"
  | "message.create"
  | "message.update"
  | "message.delete"
  | "studyPlan.create"
  | "studyPlan.delete"
  | "challenge.create"
  | "challenge.delete"
  | "admin.user.update"
  | "admin.chat.update"
  | "admin.message.delete"
  | "poll.vote"
  | "poll.close";

export async function logActivity(
  userId: string | null,
  action: ActivityAction,
  target?: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.insert(activityLogsTable).values({
      userId: userId ?? null,
      action,
      target: target ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    logger.warn({ err, action }, "failed to log activity");
  }
}
