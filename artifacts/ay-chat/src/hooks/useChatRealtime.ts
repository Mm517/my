import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { showMentionNotification, showMessageNotification } from "@/lib/notifications";
import type { ChatMessage, CurrentUser } from "@/lib/types";

/**
 * Replaces the old Socket.io-driven useChatSocket. Supabase's Postgres
 * Changes payload is the *raw table row* — it doesn't include the joined
 * author name, reaction aggregates, or poll vote tallies that the REST
 * endpoints compute server-side. Rather than duplicate that join/aggregation
 * logic in the browser, we treat every change as a signal to refetch the
 * fully-formatted list from the API (debounced so a burst of reactions/votes
 * only triggers one refetch), which keeps this hook small and correct.
 *
 * If message volume grows enough that this refetch-on-change approach gets
 * expensive, the next step is to fetch the single affected message by id
 * from `/messages/:id`-style logic instead of the whole list.
 */
export function useChatRealtime() {
  const qc = useQueryClient();
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveredQueueRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function scheduleMessagesRefetch() {
      if (refetchTimerRef.current) return;
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        void qc.invalidateQueries({ queryKey: ["messages"] });
      }, 150);
    }

    function flushDelivered() {
      const ids = Array.from(deliveredQueueRef.current);
      deliveredQueueRef.current.clear();
      flushTimerRef.current = null;
      if (ids.length === 0) return;
      apiFetch("/messages/receipts/delivered", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }).catch(() => {
        /* offline / transient — receipts can be retried later */
      });
    }

    function queueDelivered(id: string) {
      deliveredQueueRef.current.add(id);
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(flushDelivered, 400);
    }

    function onMessageInsert(payload: RealtimePostgresChangesPayload<{ id: string; user_id: string }>) {
      scheduleMessagesRefetch();
      const row = payload.new as { id: string; user_id: string } | undefined;
      const me = qc.getQueryData<CurrentUser>(["me"]);
      if (row && me && row.user_id !== me.id) {
        queueDelivered(row.id);
        // Rich notification content (author name, mention detection) needs
        // the formatted message, which lands a moment later via the
        // "messages" query refetch — notify from there instead of here.
      }
    }

    const channel = supabase
      .channel("chat-db-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        onMessageInsert,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => scheduleMessagesRefetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => scheduleMessagesRefetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes" },
        () => scheduleMessagesRefetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_receipts" },
        () => scheduleMessagesRefetch(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_settings" },
        () => void qc.invalidateQueries({ queryKey: ["chat-state"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [qc]);
}

/**
 * Fires the same in-app/mentions notifications the old socket handler did,
 * but from wherever `messages` query data actually changes (e.g. a
 * `useEffect` on the messages query in the chat page) since that's the
 * first point a newly-inserted row has its full formatted shape.
 */
export function notifyForNewMessage(msg: ChatMessage, me: CurrentUser) {
  if (msg.userId === me.id) return;
  const body = msg.content || (msg.attachment ? `[${msg.attachment.kind}] ${msg.attachment.name}` : "");
  const mentioned = msg.mentions?.includes(me.id);
  if (mentioned) {
    showMentionNotification({
      title: `${msg.anonymousName} mentioned you`,
      body: body.slice(0, 140),
      tag: `mention-${msg.id}`,
    });
  } else {
    showMessageNotification({
      title: msg.anonymousName,
      body: body.slice(0, 140),
      tag: `msg-${msg.id}`,
    });
  }
}
