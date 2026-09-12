import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * One shared realtime channel per signed-in session, replacing the old
 * Socket.io connection. Subscribes to Postgres Changes on the tables that
 * used to be pushed manually via `io.emit(...)` from the Express server,
 * plus a Broadcast topic for ephemeral "typing" events and Presence for
 * online/offline tracking.
 */
let channel: RealtimeChannel | null = null;

export function getChatChannel(): RealtimeChannel {
  if (channel) return channel;
  channel = supabase.channel("chat-room", {
    config: {
      broadcast: { self: false },
      presence: { key: "" }, // key is set per-subscribe via track()
    },
  });
  return channel;
}

export function releaseChatChannel() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
