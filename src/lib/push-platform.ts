/**
 * Pure push-notification environment logic (no DOM access) so it can be
 * unit-checked by scripts/verify-push-platform.ts. The admin push card reads
 * the browser into a PushEnvironmentInput and renders from the result.
 */

export type PushPlatform = "ios" | "android" | "desktop" | "other";

export type PushSupport =
  | "supported"
  /** iPhone/iPad Safari tab — Web Push only exists in Home Screen apps (iOS 16.4+). */
  | "ios_needs_home_screen"
  /** Home Screen app on iOS older than 16.4 (no PushManager). */
  | "ios_needs_update"
  /** Facebook/Instagram/etc. embedded browsers and Android WebViews. */
  | "in_app_browser"
  | "insecure_context"
  | "unsupported_browser";

export type PushPermission = "default" | "granted" | "denied";

export interface PushEnvironmentInput {
  userAgent: string;
  maxTouchPoints: number;
  /** display-mode: standalone/fullscreen/minimal-ui, or iOS navigator.standalone. */
  standalone: boolean;
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

export interface PushEnvironment {
  platform: PushPlatform;
  standalone: boolean;
  support: PushSupport;
}

const IN_APP_BROWSER_RE = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Line\/|MicroMessenger|; wv\)/i;

export function detectPushPlatform(userAgent: string, maxTouchPoints: number): PushPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS 13+ reports a desktop Mac user agent; touch points give it away.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Windows|Macintosh|Mac OS X|CrOS|Linux|X11/i.test(userAgent)) return "desktop";
  return "other";
}

export function resolvePushEnvironment(input: PushEnvironmentInput): PushEnvironment {
  const platform = detectPushPlatform(input.userAgent, input.maxTouchPoints);
  const standalone = input.standalone;
  const hasApis = input.hasServiceWorker && input.hasPushManager && input.hasNotification;

  let support: PushSupport;
  if (!input.isSecureContext) {
    support = "insecure_context";
  } else if (IN_APP_BROWSER_RE.test(input.userAgent)) {
    support = "in_app_browser";
  } else if (platform === "ios") {
    if (!standalone) support = "ios_needs_home_screen";
    else support = hasApis ? "supported" : "ios_needs_update";
  } else {
    support = hasApis ? "supported" : "unsupported_browser";
  }

  return { platform, standalone, support };
}

/** Device-appropriate explanation for why push can't be enabled right now. */
export function unsupportedPushMessage(env: PushEnvironment, portalName: string): string | null {
  switch (env.support) {
    case "supported":
      return null;
    case "ios_needs_home_screen":
      return `On iPhone and iPad, notifications only work from the Home Screen app. In Safari, tap Share → Add to Home Screen, then open ${portalName} from that icon and enable notifications here.`;
    case "ios_needs_update":
      return "Update this iPhone or iPad to iOS 16.4 or later to receive notifications from Home Screen apps.";
    case "in_app_browser":
      return env.platform === "ios"
        ? `This in-app browser can't receive notifications. Open ${portalName} in Safari, add it to your Home Screen, then enable notifications from there.`
        : `This in-app browser can't receive notifications. Open ${portalName} in Chrome to enable them.`;
    case "insecure_context":
      return "Notifications require a secure (https) connection.";
    case "unsupported_browser":
      return env.platform === "android"
        ? `This browser doesn't support notifications. Open ${portalName} in Chrome, then enable them here.`
        : "This browser doesn't support push notifications. Try a current version of Chrome, Edge, Firefox, or Safari.";
  }
}

/** How to re-allow notifications after the user (or OS) denied permission. */
export function deniedPermissionMessage(env: PushEnvironment, portalName: string): string {
  if (env.platform === "ios") {
    return `Notifications are turned off for ${portalName}. Open iPhone Settings → Notifications → ${portalName}, turn on Allow Notifications, then come back and tap Enable.`;
  }
  if (env.platform === "android") {
    return env.standalone
      ? `Notifications are blocked for ${portalName}. Long-press the ${portalName} icon → App info → Notifications and allow them, then come back and tap Enable.`
      : `Notifications are blocked for this site. In Chrome, tap the icon left of the address bar → Permissions → Notifications → Allow, then tap Enable again.`;
  }
  return "Notifications are blocked for this site. Click the icon left of the address bar, allow notifications, then tap Enable again.";
}

/** Footer tip shown under the Enable button — never cross-platform. */
export function pushSetupTip(env: PushEnvironment, portalName: string): string | null {
  if (env.platform === "ios") {
    return `For iPhone lock-screen alerts, keep opening ${portalName} from your Home Screen icon. Alerts follow your iPhone's Focus and Notification settings.`;
  }
  if (env.platform === "android") {
    return env.standalone
      ? `Alerts appear like any Android app. If they're silent, check Android Settings → Apps → ${portalName} → Notifications.`
      : `Tip: add ${portalName} to your Home Screen from Chrome's ⋮ menu for an app-like experience. Alerts work either way.`;
  }
  return null;
}

/** Web Push applicationServerKey (base64url) → bytes for pushManager.subscribe. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** True when an existing PushSubscription was created with this VAPID key. */
export function sameApplicationServerKey(
  existing: ArrayBuffer | null | undefined,
  expected: Uint8Array
): boolean {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  if (a.length !== expected.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== expected[i]) return false;
  return true;
}

/**
 * Notification click target as a same-origin path. The service worker resolves
 * it against its own origin, so a tap opens the installed app / portal domain
 * the device subscribed from (custom domain or subdomain), never another host.
 */
export function toSameOriginPushPath(url: string | undefined | null, fallback = "/admin"): string {
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
  } catch {
    return fallback;
  }
}
