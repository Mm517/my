/* Abdallah Yahia Chat — Service Worker (Web Push) */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  // Activate this worker immediately on first install.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Take control of all open clients right away.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_err) {
    payload = { title: "Abdallah Yahia Chat", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Abdallah Yahia Chat";
  const body = payload.body || "";
  const tag = payload.tag || "ay-chat-msg";
  const url = payload.url || "/chat";
  const isMention = !!payload.mention;

  const options = {
    body,
    tag,
    icon: "/logo.svg",
    badge: "/logo.svg",
    renotify: true,
    requireInteraction: isMention,
    silent: false,
    vibrate: isMention ? [200, 80, 200, 80, 200] : [120, 60, 120],
    data: { url, messageId: payload.messageId },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/chat";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing tab if we have one.
      for (const client of allClients) {
        try {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch (_err) {
              /* navigation may fail across origins — focus is enough */
            }
          }
          return;
        } catch (_err) {
          /* try the next client */
        }
      }
      // Otherwise open a new tab.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // The browser rotated our subscription; re-subscribe and report back.
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({ type: "push:resubscribe", endpoint: sub && sub.endpoint });
        }
      } catch (_err) {
        /* ignore */
      }
    })(),
  );
});
