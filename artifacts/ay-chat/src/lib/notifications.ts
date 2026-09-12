const STORAGE_KEY = "ay-chat:notif-enabled";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsEnabled(): boolean {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") {
    setEnabled(true);
    return true;
  }
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  const ok = result === "granted";
  setEnabled(ok);
  return ok;
}

export function setEnabled(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    /* ignore */
  }
}

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function playPing() {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    /* ignore */
  }
}

export function playMentionPing() {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const tones = [
      { freq: 1320, start: now, dur: 0.18 },
      { freq: 990, start: now + 0.12, dur: 0.18 },
      { freq: 1320, start: now + 0.24, dur: 0.22 },
    ];
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(tone.freq, tone.start);
      gain.gain.setValueAtTime(0, tone.start);
      gain.gain.linearRampToValueAtTime(0.22, tone.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, tone.start + tone.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(tone.start);
      osc.stop(tone.start + tone.dur + 0.02);
    }
  } catch {
    /* ignore */
  }
}

export function showMessageNotification(opts: {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}) {
  if (!notificationsEnabled()) return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    playPing();
    return;
  }
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
    playPing();
  } catch {
    /* ignore */
  }
}

export function showMentionNotification(opts: {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}) {
  // Mentions always ping, even if the tab is visible — they're personal.
  playMentionPing();
  if (!notificationsEnabled()) return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    return;
  }
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      silent: false,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
  } catch {
    /* ignore */
  }
}
