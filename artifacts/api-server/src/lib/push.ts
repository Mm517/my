import webpush from "web-push";
import { ne, inArray } from "drizzle-orm";

import { db, pushSubscriptionsTable } from "@workspace/db";
import { logger } from "./logger";

let initialized = false;

/**
 * VAPID keys now come from Edge Function / server secrets (VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY, VAPID_SUBJECT) instead of chat_settings.vapid_private_key.
 * Storing a private key in a Postgres table readable by any admin query was
 * flagged as risk #5 in MIGRATION_MAP.md — generate a fresh pair for
 * production and never reuse whatever was in the old table.
 */
export async function initPush(): Promise<void> {
  if (initialized) return;

  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"];

  if (!publicKey || !privateKey || !subject) {
    logger.warn(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT not set — push notifications disabled. " +
        "Generate a pair with `npx web-push generate-vapid-keys` and set them as server secrets.",
    );
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialized = true;
  logger.info("Web Push initialized");
}

export function getVapidPublicKey(): string {
  return process.env["VAPID_PUBLIC_KEY"] ?? "";
}

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  mention?: boolean;
  messageId?: string;
};

async function deliver(subs: (typeof pushSubscriptionsTable.$inferSelect)[], payload: PushPayload) {
  if (subs.length === 0) return;
  const data = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
          { TTL: 60 },
        );
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err !== null && "statusCode" in err
            ? Number((err as { statusCode?: unknown }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          stale.push(s.id);
        } else {
          logger.warn({ err, endpoint: s.endpoint }, "Push send failed");
        }
      }
    }),
  );

  if (stale.length > 0) {
    try {
      await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.id, stale));
    } catch (err) {
      logger.error({ err }, "Failed to prune stale push subscriptions");
    }
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!initialized || userIds.length === 0) return;
  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(inArray(pushSubscriptionsTable.userId, userIds));
    await deliver(subs, payload);
  } catch (err) {
    logger.error({ err }, "Failed to load push subscriptions");
  }
}

export async function sendPushToOthers(excludeUserId: string, payload: PushPayload): Promise<void> {
  if (!initialized) return;
  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(ne(pushSubscriptionsTable.userId, excludeUserId));
    await deliver(subs, payload);
  } catch (err) {
    logger.error({ err }, "Failed to load push subscriptions");
  }
}
