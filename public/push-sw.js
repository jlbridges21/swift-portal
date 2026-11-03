/*
 * ShootPortal Web Push service worker.
 *
 * Served from every portal origin (subdomains and custom domains) and
 * registered at scope "/" by the admin "Enable Notifications" card. Handles
 * standard VAPID pushes sent by src/lib/web-push.ts on iOS Home Screen apps,
 * Android Chrome / installed web apps, and desktop browsers.
 *
 * /OneSignalSDKWorker.js stays in public/ for devices subscribed through
 * OneSignal before this worker existed; enabling again replaces it.
 */

const DEFAULT_PATH = "/admin";
const DEFAULT_ICON = "/icons/sp-icon-192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch {
    try {
      return { body: event.data.text() };
    } catch {
      return {};
    }
  }
}

function sameOriginUrl(path) {
  try {
    const url = new URL(path || DEFAULT_PATH, self.location.origin);
    if (url.origin !== self.location.origin) return new URL(DEFAULT_PATH, self.location.origin).href;
    return url.href;
  } catch {
    return new URL(DEFAULT_PATH, self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  const data = readPayload(event);
  const title = data.title || "New activity";
  const options = {
    body: data.body || "",
    icon: data.icon || DEFAULT_ICON,
    data: { url: sameOriginUrl(data.url) },
    timestamp: Date.now(),
  };
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }

  // Always show a notification: iOS revokes subscriptions that receive
  // pushes without a visible notification.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = sameOriginUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          const focused = await client.focus();
          if (client.url !== target && "navigate" in focused) {
            await focused.navigate(target);
          }
          return;
        } catch {
          // Uncontrolled clients can't be navigated — fall through to openWindow.
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })()
  );
});

// Browsers may rotate a subscription (expiry, key refresh). Re-subscribe with
// the same VAPID key and tell the server so delivery doesn't silently stop.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldSubscription = event.oldSubscription || null;
      let subscription = event.newSubscription || null;
      if (!subscription) {
        const key = oldSubscription && oldSubscription.options && oldSubscription.options.applicationServerKey;
        if (!key) return;
        subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
      }
      await fetch("/api/admin/push", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resubscribe",
          oldEndpoint: oldSubscription ? oldSubscription.endpoint : null,
          subscription: subscription.toJSON(),
        }),
      }).catch(() => {});
    })()
  );
});
