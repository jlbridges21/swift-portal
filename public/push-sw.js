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
 *
 * The installed app also registers it (StandaloneAppBoot) for one thing besides push: when a
 * page load fails because the device is offline, show a small reconnect screen instead of the
 * browser's error page. Nothing is cached — every request still goes to the network first, so
 * sign-in, redirects and tenant routing are untouched.
 */

// App entry: sends owners, staff and clients to their own home (sign-in first when needed).
const DEFAULT_PATH = "/app";
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

// ---------------------------------------------------------------------------
// Offline page for full page loads (navigations only; everything else is untouched).
// ---------------------------------------------------------------------------

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>You're offline</title>
<style>
  html,body{margin:0;height:100%;background:#F8FAFC;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  @media (prefers-color-scheme:dark){html,body{background:#14181F;color:#E5E7EB}}
  main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;box-sizing:border-box}
  .dot{width:56px;height:56px;border-radius:16px;background:rgba(100,116,139,.15);display:flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:26px}
  h1{font-size:20px;margin:0 0 8px}
  p{margin:0 0 24px;color:#64748B;max-width:320px;line-height:1.5}
  button{appearance:none;border:0;border-radius:999px;padding:12px 24px;font-size:15px;font-weight:600;background:#0F172A;color:#fff}
  @media (prefers-color-scheme:dark){button{background:#E5E7EB;color:#0F172A}}
</style></head><body><main>
  <div class="dot" aria-hidden="true">&#x21bb;</div>
  <h1>You're offline</h1>
  <p>Check your connection. We'll reconnect as soon as you're back online.</p>
  <button type="button" onclick="location.reload()">Try again</button>
</main><script>addEventListener("online",function(){location.reload()})</script></body></html>`;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        })
    )
  );
});
