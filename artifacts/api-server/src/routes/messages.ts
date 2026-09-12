import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  db,
  messagesTable,
  messageReactionsTable,
  messageReceiptsTable,
  profilesTable,
  chatSettingsTable,
  pollVotesTable,
  type Message as DbMessage,
  type MessagePoll,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { containsProfanity, cleanProfanity } from "../lib/profanity";
import { anonymizeName, extractMentions } from "../lib/anonymize";
import { sendPushToOthers } from "../lib/push";
import { logActivity } from "../lib/activity";
import { routeParam } from "../lib/routeParam";

const router: IRouter = Router();

// NOTE on realtime: this route file no longer calls any broadcast()/io.emit.
// messages, message_reactions, poll_votes, message_receipts and chat_settings
// are all part of the `supabase_realtime` Postgres publication (see
// supabase/migrations/001_initial_schema.sql), so every insert/update below
// streams to connected clients automatically via Supabase Realtime — the
// client subscribes with `lib/realtime.ts` + `hooks/useChatRealtime.ts`.

type MessageRow = Pick<
  DbMessage,
  "id" | "userId" | "content" | "attachment" | "poll" | "edited" | "filtered" | "deleted" | "createdAt" | "parentId" | "isPinned"
> & {
  authorName: string;
  authorGrade: string | null;
};

type ReactionUser = {
  id: string;
  anonymousName: string;
};

type ReactionAggregate = {
  emoji: string;
  count: number;
  userIds: string[];
  users: ReactionUser[];
};

type FormattedPollOption = {
  id: string;
  text: string;
  votes: number;
  voters: { id: string; anonymousName: string }[];
};

type FormattedPoll = {
  question: string;
  options: FormattedPollOption[];
  allowMultiple: boolean;
  closesAt: string | null;
  isClosed: boolean;
  totalVoters: number;
  myVotes: string[];
};

type FormattedMessage = {
  id: string;
  userId: string;
  anonymousName: string;
  grade: string | null;
  content: string;
  attachment: DbMessage["attachment"];
  poll: FormattedPoll | null;
  edited: boolean;
  filtered: boolean;
  isPinned: boolean;
  parent: { id: string; anonymousName: string; preview: string } | null;
  reactions: ReactionAggregate[];
  mentions: string[];
  deliveredTo: string[];
  seenBy: string[];
  createdAt: Date;
};

async function loadDirectoryMap(): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ id: profilesTable.id, name: profilesTable.displayName })
    .from(profilesTable)
    .where(eq(profilesTable.isBanned, false));
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const anon = anonymizeName(r.name);
    const arr = map.get(anon) ?? [];
    arr.push(r.id);
    map.set(anon, arr);
  }
  return map;
}

function previewOf(text: string): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > 80 ? clean.slice(0, 77) + "…" : clean;
}

async function loadParents(
  parentIds: string[],
): Promise<Map<string, { id: string; anonymousName: string; preview: string }>> {
  const map = new Map<string, { id: string; anonymousName: string; preview: string }>();
  if (parentIds.length === 0) return map;
  const rows = await db
    .select({
      id: messagesTable.id,
      content: messagesTable.content,
      attachment: messagesTable.attachment,
      authorName: profilesTable.displayName,
    })
    .from(messagesTable)
    .innerJoin(profilesTable, eq(messagesTable.userId, profilesTable.id))
    .where(inArray(messagesTable.id, parentIds));
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      anonymousName: anonymizeName(r.authorName),
      preview: r.content ? previewOf(r.content) : r.attachment ? `[${r.attachment.kind}] ${r.attachment.name}` : "",
    });
  }
  return map;
}

async function loadReactions(messageIds: string[]): Promise<Map<string, ReactionAggregate[]>> {
  const map = new Map<string, ReactionAggregate[]>();
  if (messageIds.length === 0) return map;
  const rows = await db
    .select({
      messageId: messageReactionsTable.messageId,
      emoji: messageReactionsTable.emoji,
      userId: messageReactionsTable.userId,
      authorName: profilesTable.displayName,
    })
    .from(messageReactionsTable)
    .innerJoin(profilesTable, eq(messageReactionsTable.userId, profilesTable.id))
    .where(inArray(messageReactionsTable.messageId, messageIds));

  const tmp = new Map<string, Map<string, ReactionUser[]>>();
  for (const r of rows) {
    let perMsg = tmp.get(r.messageId);
    if (!perMsg) {
      perMsg = new Map();
      tmp.set(r.messageId, perMsg);
    }
    const arr = perMsg.get(r.emoji) ?? [];
    arr.push({ id: r.userId, anonymousName: anonymizeName(r.authorName) });
    perMsg.set(r.emoji, arr);
  }
  for (const [mid, perMsg] of tmp) {
    map.set(
      mid,
      Array.from(perMsg, ([emoji, users]) => ({
        emoji,
        count: users.length,
        userIds: users.map((u) => u.id),
        users,
      })),
    );
  }
  return map;
}

async function loadReceipts(
  messageIds: string[],
): Promise<Map<string, { deliveredTo: string[]; seenBy: string[] }>> {
  const map = new Map<string, { deliveredTo: string[]; seenBy: string[] }>();
  if (messageIds.length === 0) return map;
  const rows = await db
    .select({
      messageId: messageReceiptsTable.messageId,
      userId: messageReceiptsTable.userId,
      deliveredAt: messageReceiptsTable.deliveredAt,
      seenAt: messageReceiptsTable.seenAt,
    })
    .from(messageReceiptsTable)
    .where(inArray(messageReceiptsTable.messageId, messageIds));
  for (const r of rows) {
    const entry = map.get(r.messageId) ?? { deliveredTo: [], seenBy: [] };
    if (r.deliveredAt) entry.deliveredTo.push(r.userId);
    if (r.seenAt) entry.seenBy.push(r.userId);
    map.set(r.messageId, entry);
  }
  return map;
}

async function loadPollVotes(
  messageIds: string[],
): Promise<Map<string, { userId: string; optionId: string; authorName: string }[]>> {
  const map = new Map<string, { userId: string; optionId: string; authorName: string }[]>();
  if (messageIds.length === 0) return map;
  const rows = await db
    .select({
      messageId: pollVotesTable.messageId,
      userId: pollVotesTable.userId,
      optionId: pollVotesTable.optionId,
      authorName: profilesTable.displayName,
    })
    .from(pollVotesTable)
    .innerJoin(profilesTable, eq(pollVotesTable.userId, profilesTable.id))
    .where(inArray(pollVotesTable.messageId, messageIds));
  for (const r of rows) {
    const arr = map.get(r.messageId) ?? [];
    arr.push({ userId: r.userId, optionId: r.optionId, authorName: r.authorName });
    map.set(r.messageId, arr);
  }
  return map;
}

function buildFormattedPoll(
  poll: MessagePoll | null,
  votes: { userId: string; optionId: string; authorName: string }[] | undefined,
  meId: string,
): FormattedPoll | null {
  if (!poll) return null;
  const allVotes = votes ?? [];
  const byOption = new Map<string, { userId: string; anonymousName: string }[]>();
  const voterIds = new Set<string>();
  const myVotes: string[] = [];
  for (const v of allVotes) {
    voterIds.add(v.userId);
    if (v.userId === meId) myVotes.push(v.optionId);
    const arr = byOption.get(v.optionId) ?? [];
    arr.push({ userId: v.userId, anonymousName: anonymizeName(v.authorName) });
    byOption.set(v.optionId, arr);
  }
  return {
    question: poll.question,
    options: poll.options.map((o) => {
      const list = byOption.get(o.id) ?? [];
      return {
        id: o.id,
        text: o.text,
        votes: list.length,
        voters: list.map((u) => ({ id: u.userId, anonymousName: u.anonymousName })),
      };
    }),
    allowMultiple: poll.allowMultiple,
    closesAt: poll.closesAt,
    isClosed: poll.isClosed,
    totalVoters: voterIds.size,
    myVotes,
  };
}

async function buildFormatted(rows: MessageRow[], meId: string): Promise<FormattedMessage[]> {
  const parentIds = rows.map((r) => r.parentId).filter((v): v is string => typeof v === "string");
  const messageIds = rows.map((r) => r.id);
  const pollMessageIds = rows.filter((r) => r.poll).map((r) => r.id);
  const [parents, reactions, directory, pollVotes, receipts] = await Promise.all([
    loadParents(parentIds),
    loadReactions(messageIds),
    loadDirectoryMap(),
    loadPollVotes(pollMessageIds),
    loadReceipts(messageIds),
  ]);
  return rows.map((m) => ({
    id: m.id,
    userId: m.userId,
    anonymousName: anonymizeName(m.authorName),
    grade: m.authorGrade,
    content: m.content,
    attachment: m.attachment ?? null,
    poll: buildFormattedPoll(m.poll ?? null, pollVotes.get(m.id), meId),
    edited: m.edited,
    filtered: m.filtered,
    isPinned: m.isPinned,
    parent: m.parentId ? parents.get(m.parentId) ?? null : null,
    reactions: reactions.get(m.id) ?? [],
    mentions: extractMentions(m.content, directory, m.userId),
    deliveredTo: receipts.get(m.id)?.deliveredTo ?? [],
    seenBy: receipts.get(m.id)?.seenBy ?? [],
    createdAt: m.createdAt,
  }));
}

const SELECT_FIELDS = {
  id: messagesTable.id,
  userId: messagesTable.userId,
  content: messagesTable.content,
  attachment: messagesTable.attachment,
  poll: messagesTable.poll,
  parentId: messagesTable.parentId,
  isPinned: messagesTable.isPinned,
  edited: messagesTable.edited,
  filtered: messagesTable.filtered,
  deleted: messagesTable.deleted,
  createdAt: messagesTable.createdAt,
  authorName: profilesTable.displayName,
  authorGrade: profilesTable.grade,
};

async function fetchMessage(id: string, meId: string): Promise<FormattedMessage | null> {
  const rows = await db
    .select(SELECT_FIELDS)
    .from(messagesTable)
    .innerJoin(profilesTable, eq(messagesTable.userId, profilesTable.id))
    .where(eq(messagesTable.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const formatted = await buildFormatted(rows, meId);
  return formatted[0] ?? null;
}

router.get("/messages", requireAuth, async (req: Request, res: Response) => {
  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 200);

  const rows = await db
    .select(SELECT_FIELDS)
    .from(messagesTable)
    .innerJoin(profilesTable, eq(messagesTable.userId, profilesTable.id))
    .where(eq(messagesTable.deleted, false))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  const formatted = await buildFormatted(rows.reverse(), req.user!.id);
  res.json(formatted);
});

router.get("/messages/pinned", requireAuth, async (req: Request, res: Response) => {
  const rows = await db
    .select(SELECT_FIELDS)
    .from(messagesTable)
    .innerJoin(profilesTable, eq(messagesTable.userId, profilesTable.id))
    .where(and(eq(messagesTable.deleted, false), eq(messagesTable.isPinned, true)))
    .orderBy(desc(messagesTable.createdAt));
  const formatted = await buildFormatted(rows, req.user!.id);
  res.json(formatted);
});

router.post("/messages", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.is_banned) {
    res.status(403).json({ error: "You are banned from chat" });
    return;
  }
  if (req.user!.is_muted) {
    res.status(403).json({ error: "You are muted" });
    return;
  }

  const [settings] = await db.select().from(chatSettingsTable).limit(1);
  if (settings && !settings.chatEnabled && req.user!.role !== "admin") {
    res.status(403).json({ error: "Chat is currently disabled" });
    return;
  }

  const body = req.body ?? {};
  const content = typeof body.content === "string" ? body.content : "";
  const attachment = body.attachment && typeof body.attachment === "object" ? body.attachment : null;
  const parentId = typeof body.parentId === "string" ? body.parentId : null;

  // Optional poll payload. We accept up to 10 short options.
  let poll: MessagePoll | null = null;
  if (body.poll && typeof body.poll === "object") {
    const q = typeof body.poll.question === "string" ? body.poll.question.trim() : "";
    const rawOpts = Array.isArray(body.poll.options) ? body.poll.options : [];
    const opts = rawOpts
      .map((o: unknown) => (typeof o === "string" ? o.trim() : ""))
      .filter((o: string) => o.length > 0)
      .slice(0, 10);
    if (!q) {
      res.status(400).json({ error: "Poll question is required" });
      return;
    }
    if (opts.length < 2) {
      res.status(400).json({ error: "A poll needs at least 2 options" });
      return;
    }
    poll = {
      question: q.slice(0, 200),
      options: opts.map((text: string, i: number) => ({
        id: `o${i + 1}`,
        text: text.slice(0, 100),
      })),
      allowMultiple: !!body.poll.allowMultiple,
      closesAt: null,
      isClosed: false,
    };
  }

  const trimmed = content.trim();
  if (!trimmed && !attachment && !poll) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }

  const filtered = containsProfanity(trimmed);
  const cleaned = filtered ? cleanProfanity(trimmed) : trimmed;

  const [inserted] = await db
    .insert(messagesTable)
    .values({
      userId: req.user!.id,
      content: cleaned,
      attachment: attachment,
      poll: poll,
      parentId: parentId,
      filtered,
    })
    .returning();

  await db
    .update(profilesTable)
    .set({ messagesSent: (req.user!.messages_sent ?? 0) + 1 })
    .where(eq(profilesTable.id, req.user!.id));

  const formatted = await fetchMessage(inserted.id, req.user!.id);
  if (formatted) {
    const previewSource =
      formatted.content ||
      (formatted.poll
        ? `📊 ${formatted.poll.question}`
        : formatted.attachment
          ? `[${formatted.attachment.kind}] ${formatted.attachment.name}`
          : "");
    const preview = previewSource.slice(0, 140);
    const mentions = Array.isArray(formatted.mentions) ? formatted.mentions : [];
    void sendPushToOthers(req.user!.id, {
      title: formatted.anonymousName,
      body: preview,
      tag: `msg-${formatted.id}`,
      url: "/chat",
      messageId: formatted.id,
      mention: mentions.length > 0,
    });
  }
  await logActivity(req.user!.id, "message.create", inserted.id, {
    hasAttachment: !!attachment,
    hasPoll: !!poll,
    parentId,
  });
  res.status(201).json(formatted);
});

router.patch("/messages/:id", requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const body = req.body ?? {};
  const content = typeof body.content === "string" ? body.content : null;
  if (content === null) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!existing || existing.deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.userId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const trimmed = content.trim();
  const filtered = containsProfanity(trimmed);
  const cleaned = filtered ? cleanProfanity(trimmed) : trimmed;

  await db
    .update(messagesTable)
    .set({ content: cleaned, edited: true, filtered })
    .where(eq(messagesTable.id, id));

  const formatted = await fetchMessage(id, req.user!.id);
  await logActivity(req.user!.id, "message.update", id);
  res.json(formatted);
});

router.delete("/messages/:id", requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.userId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.update(messagesTable).set({ deleted: true }).where(eq(messagesTable.id, id));
  await logActivity(req.user!.id, "message.delete", id);
  res.status(204).end();
});

// Bulk delete (admin can delete any messages; users can only delete their own).
router.post("/messages/bulk-delete", requireAuth, async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.filter((v: unknown) => typeof v === "string")
    : [];
  if (ids.length === 0) {
    res.status(400).json({ error: "ids[] required" });
    return;
  }
  const condition =
    req.user!.role === "admin"
      ? inArray(messagesTable.id, ids)
      : and(inArray(messagesTable.id, ids), eq(messagesTable.userId, req.user!.id));

  const updated = await db
    .update(messagesTable)
    .set({ deleted: true })
    .where(condition)
    .returning({ id: messagesTable.id });
  await logActivity(req.user!.id, "message.delete", null, { bulk: updated.length });
  res.json({ deleted: updated.map((r) => r.id) });
});

// Pin / unpin a message (admins only).
router.post("/messages/:id/pin", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const id = routeParam(req.params.id);
  await db.update(messagesTable).set({ isPinned: true }).where(eq(messagesTable.id, id));
  const formatted = await fetchMessage(id, req.user!.id);
  await logActivity(req.user!.id, "admin.chat.update", id, { action: "pin" });
  res.json(formatted);
});

router.post("/messages/:id/unpin", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const id = routeParam(req.params.id);
  await db.update(messagesTable).set({ isPinned: false }).where(eq(messagesTable.id, id));
  const formatted = await fetchMessage(id, req.user!.id);
  await logActivity(req.user!.id, "admin.chat.update", id, { action: "unpin" });
  res.json(formatted);
});

function parseIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v === "string" && v.length > 0) seen.add(v);
  }
  return Array.from(seen);
}

// Mark messages as delivered to the current user (called as soon as the
// client receives a new message via Realtime).
router.post("/messages/receipts/delivered", requireAuth, async (req: Request, res: Response) => {
  const ids = parseIdList(req.body?.ids);
  if (ids.length === 0) {
    res.json({ updated: [] });
    return;
  }
  const me = req.user!.id;

  // Only mark receipts for messages not authored by this user.
  const targets = await db
    .select({ id: messagesTable.id })
    .from(messagesTable)
    .where(and(inArray(messagesTable.id, ids), eq(messagesTable.userId, me)));
  const excludeOwn = new Set(targets.map((t) => t.id));
  const applicable = ids.filter((id) => !excludeOwn.has(id));

  for (const messageId of applicable) {
    await db
      .insert(messageReceiptsTable)
      .values({ messageId, userId: me, deliveredAt: new Date() })
      .onConflictDoUpdate({
        target: [messageReceiptsTable.messageId, messageReceiptsTable.userId],
        set: { deliveredAt: new Date() },
      });
  }
  res.json({ updated: applicable });
});

// Mark messages as seen by the current user (called when the chat is
// visible / focused). Seen implies delivered.
router.post("/messages/receipts/seen", requireAuth, async (req: Request, res: Response) => {
  const ids = parseIdList(req.body?.ids);
  if (ids.length === 0) {
    res.json({ updated: [] });
    return;
  }
  const me = req.user!.id;
  const now = new Date();

  const targets = await db
    .select({ id: messagesTable.id })
    .from(messagesTable)
    .where(and(inArray(messagesTable.id, ids), eq(messagesTable.userId, me)));
  const excludeOwn = new Set(targets.map((t) => t.id));
  const applicable = ids.filter((id) => !excludeOwn.has(id));

  for (const messageId of applicable) {
    await db
      .insert(messageReceiptsTable)
      .values({ messageId, userId: me, deliveredAt: now, seenAt: now })
      .onConflictDoUpdate({
        target: [messageReceiptsTable.messageId, messageReceiptsTable.userId],
        set: { deliveredAt: now, seenAt: now },
      });
  }
  res.json({ updated: applicable });
});

// Toggle a reaction on a message.
router.post("/messages/:id/reactions", requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const emoji = typeof req.body?.emoji === "string" ? req.body.emoji.slice(0, 16) : "";
  if (!emoji) {
    res.status(400).json({ error: "emoji required" });
    return;
  }

  const [existingMsg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!existingMsg || existingMsg.deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // One reaction per user per message: remove any existing reaction by this
  // user on this message, then add the new one (unless it's the same emoji,
  // in which case the click acts as a toggle-off).
  const existingByUser = await db
    .select({ emoji: messageReactionsTable.emoji })
    .from(messageReactionsTable)
    .where(
      and(
        eq(messageReactionsTable.messageId, id),
        eq(messageReactionsTable.userId, req.user!.id),
      ),
    );

  const sameAsCurrent = existingByUser.some((r) => r.emoji === emoji);

  if (existingByUser.length > 0) {
    await db
      .delete(messageReactionsTable)
      .where(
        and(
          eq(messageReactionsTable.messageId, id),
          eq(messageReactionsTable.userId, req.user!.id),
        ),
      );
  }

  if (!sameAsCurrent) {
    await db
      .insert(messageReactionsTable)
      .values({ messageId: id, userId: req.user!.id, emoji });
  }

  const formatted = await fetchMessage(id, req.user!.id);
  res.json(formatted);
});

// ----- Polls -----

// Vote on a poll. Body: { optionIds: string[] }. We replace the user's
// existing votes for this poll atomically — for single-choice polls this
// behaves like a switch; for multi-choice polls the client sends the full
// new selection (so unchecking is just a missing id).
router.post("/messages/:id/vote", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.is_banned) {
    res.status(403).json({ error: "You are banned from chat" });
    return;
  }
  const id = routeParam(req.params.id);

  const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!existing || existing.deleted || !existing.poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  if (existing.poll.isClosed) {
    res.status(403).json({ error: "Poll is closed" });
    return;
  }

  const validIds = new Set(existing.poll.options.map((o) => o.id));
  const incoming = Array.isArray(req.body?.optionIds) ? req.body.optionIds : [];
  const optionIds = Array.from(
    new Set(
      incoming
        .filter((v: unknown) => typeof v === "string")
        .filter((v: string) => validIds.has(v)),
    ),
  ) as string[];

  if (!existing.poll.allowMultiple && optionIds.length > 1) {
    res.status(400).json({ error: "This poll only allows a single choice" });
    return;
  }

  const me = req.user!.id;
  await db.transaction(async (tx) => {
    await tx
      .delete(pollVotesTable)
      .where(
        and(eq(pollVotesTable.messageId, id), eq(pollVotesTable.userId, me)),
      );
    if (optionIds.length > 0) {
      await tx
        .insert(pollVotesTable)
        .values(optionIds.map((optionId) => ({ messageId: id, userId: me, optionId })));
    }
  });

  const formatted = await fetchMessage(id, me);
  await logActivity(me, "poll.vote", id, { optionIds });
  res.json(formatted);
});

// Close a poll (only the author or an admin).
router.post("/messages/:id/poll/close", requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!existing || existing.deleted || !existing.poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  if (existing.userId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Only the author or an admin can close this poll" });
    return;
  }
  const updatedPoll: MessagePoll = { ...existing.poll, isClosed: true };
  await db
    .update(messagesTable)
    .set({ poll: updatedPoll })
    .where(eq(messagesTable.id, id));

  const formatted = await fetchMessage(id, req.user!.id);
  await logActivity(req.user!.id, "poll.close", id);
  res.json(formatted);
});

export default router;
