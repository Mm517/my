import { apiFetch, apiUrl } from "./api";

const SW_REGISTERED_KEY = "ay-chat:sw-registered";

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out.buffer as ArrayBuffer;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

let swRegPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (swRegPromise) return swRegPromise;

  // The SW lives at the app's base path so its scope covers the whole app.
  // import.meta.env.BASE_URL always ends with "/".
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  const scope = import.meta.env.BASE_URL;

  swRegPromise = navigator.serviceWorker
    .register(swUrl, { scope })
    .then((reg) => {
      try {
        window.localStorage.setItem(SW_REGISTERED_KEY, "true");
      } catch {
        /* ignore */
      }
      return reg;
    })
    .catch((err) => {
      console.warn("Service worker registration failed", err);
      return null;
    });

  return swRegPromise;
}

async function sendSubscriptionToServer(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await apiFetch("/push/subscribe", {
    method: "POST",
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  });
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(apiUrl("/push/vapid-public-key"), {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;

  // Wait until the SW is active so pushManager is usable.
  if (!reg.active) {
    await navigator.serviceWorker.ready;
  }

  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await sendSubscriptionToServer(existing);
      return true;
    }
    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) return false;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
    await sendSubscriptionToServer(sub);
    return true;
  } catch (err) {
    console.warn("Push subscribe failed", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {
      /* ignore */
    });
    await apiFetch("/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    }).catch(() => {
      /* ignore */
    });
  } catch {
    /* ignore */
  }
}

// Listen for SW-driven re-subscription (rotation).
export function attachPushSwListener() {
  if (!pushSupported()) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data as { type?: string } | undefined;
    if (data?.type === "push:resubscribe") {
      void subscribeToPush();
    }
  });
}
