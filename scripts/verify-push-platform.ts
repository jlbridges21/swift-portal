/**
 * Push platform detection, device-specific copy, and click-URL guards.
 * Run: npx tsx scripts/verify-push-platform.ts
 */
import {
  deniedPermissionMessage,
  detectPushPlatform,
  pushSetupTip,
  resolvePushEnvironment,
  sameApplicationServerKey,
  toSameOriginPushPath,
  unsupportedPushMessage,
  urlBase64ToUint8Array,
  type PushEnvironmentInput,
} from "../src/lib/push-platform";

function expect(label: string, ok: boolean) {
  if (!ok) throw new Error(`fail ${label}`);
  console.log(`ok  ${label}`);
}

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-S918U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; SM-S918U; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  androidInstagram:
    "Mozilla/5.0 (Linux; Android 14; SM-S918U; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

const FULL_APIS = {
  isSecureContext: true,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
};

function env(overrides: Partial<PushEnvironmentInput> & { userAgent: string }) {
  return resolvePushEnvironment({ maxTouchPoints: 5, standalone: false, ...FULL_APIS, ...overrides });
}

const NAME = "Creative Visuals Drone & Photo LLC";

// --- platform detection
expect("android chrome → android", detectPushPlatform(UA.androidChrome, 5) === "android");
expect("iphone → ios", detectPushPlatform(UA.iphoneSafari, 5) === "ios");
expect("iPadOS desktop UA + touch → ios", detectPushPlatform(UA.ipadOS, 5) === "ios");
expect("mac (no touch) → desktop", detectPushPlatform(UA.macChrome, 0) === "desktop");

// --- Android: installed web app and Chrome tab both supported
const androidInstalled = env({ userAgent: UA.androidChrome, standalone: true });
expect("android installed → supported", androidInstalled.support === "supported");
const androidTab = env({ userAgent: UA.androidChrome });
expect("android chrome tab → supported", androidTab.support === "supported");
expect(
  "android firefox → supported",
  env({ userAgent: UA.androidFirefox }).support === "supported"
);
expect(
  "android webview → in_app_browser",
  env({ userAgent: UA.androidWebView, hasPushManager: false }).support === "in_app_browser"
);
expect(
  "android instagram → in_app_browser",
  env({ userAgent: UA.androidInstagram }).support === "in_app_browser"
);
expect(
  "android no PushManager → unsupported_browser",
  env({ userAgent: UA.androidChrome, hasPushManager: false }).support === "unsupported_browser"
);

// --- iOS: Home Screen only
expect(
  "iphone safari tab → ios_needs_home_screen (even if APIs exist)",
  env({ userAgent: UA.iphoneSafari }).support === "ios_needs_home_screen"
);
const iosInstalled = env({ userAgent: UA.iphoneSafari, standalone: true });
expect("iphone home screen → supported", iosInstalled.support === "supported");
expect(
  "iphone home screen without PushManager → ios_needs_update",
  env({ userAgent: UA.iphoneSafari, standalone: true, hasPushManager: false }).support ===
    "ios_needs_update"
);
expect(
  "insecure context wins",
  env({ userAgent: UA.androidChrome, isSecureContext: false }).support === "insecure_context"
);

// --- copy never crosses platforms
const androidTexts = [
  pushSetupTip(androidInstalled, NAME),
  pushSetupTip(androidTab, NAME),
  deniedPermissionMessage(androidInstalled, NAME),
  deniedPermissionMessage(androidTab, NAME),
  unsupportedPushMessage(env({ userAgent: UA.androidInstagram }), NAME),
  unsupportedPushMessage(env({ userAgent: UA.androidChrome, hasPushManager: false }), NAME),
].join(" ");
expect("android copy never mentions iPhone/Safari", !/iPhone|iPad|Safari/i.test(androidTexts));
expect("android installed tip mentions Android", /Android/.test(pushSetupTip(androidInstalled, NAME) ?? ""));

const iosTexts = [
  pushSetupTip(iosInstalled, NAME),
  deniedPermissionMessage(iosInstalled, NAME),
  unsupportedPushMessage(env({ userAgent: UA.iphoneSafari }), NAME),
].join(" ");
expect("ios copy never mentions Android/Chrome", !/Android|Chrome/i.test(iosTexts));
expect("ios tip keeps lock-screen guidance", /lock-screen/.test(pushSetupTip(iosInstalled, NAME) ?? ""));
expect("supported has no unsupported message", unsupportedPushMessage(androidInstalled, NAME) === null);
expect("desktop has no mobile tip", pushSetupTip(env({ userAgent: UA.macChrome, maxTouchPoints: 0 }), NAME) === null);

// --- VAPID key helpers
const key = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const bytes = urlBase64ToUint8Array(key);
expect("vapid key decodes to 65 bytes", bytes.length === 65 && bytes[0] === 0x04);
expect("same key matches", sameApplicationServerKey(bytes.slice().buffer, bytes));
const other = bytes.slice();
other[10] ^= 1;
expect("different key does not match", !sameApplicationServerKey(other.buffer, bytes));
expect("missing key does not match", !sameApplicationServerKey(null, bytes));

// --- click URL is always same-origin
expect(
  "absolute custom-domain URL → path",
  toSameOriginPushPath("https://portal.cvdroneandphoto.com/admin/projects/abc?tab=media#x") ===
    "/admin/projects/abc?tab=media#x"
);
expect("relative path kept", toSameOriginPushPath("/admin/requests") === "/admin/requests");
expect("protocol-relative rejected", toSameOriginPushPath("//evil.example/admin") === "/admin");
expect("javascript: rejected", toSameOriginPushPath("javascript:alert(1)") === "/admin");
expect("empty → fallback", toSameOriginPushPath(undefined) === "/admin");

console.log("\nAll push-platform cases passed.");
