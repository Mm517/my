import { useEffect } from "react";
import { useAuth } from "./auth";
import { apiFetch } from "./api";

const HEARTBEAT_INTERVAL_MS = 25_000;

async function sendBeat() {
  try {
    await apiFetch("/presence/heartbeat", { method: "POST" });
  } catch {
    /* ignore */
  }
}

export function usePresenceHeartbeat() {
  const { isSignedIn } = useAuth();
  useEffect(() => {
    if (!isSignedIn) return;
    sendBeat();
    const id = window.setInterval(sendBeat, HEARTBEAT_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") sendBeat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isSignedIn]);
}
