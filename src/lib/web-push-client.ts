"use client";

import {
  resolvePushEnvironment,
  sameApplicationServerKey,
  urlBase64ToUint8Array,
  type PushEnvironment,
  type PushPermission,
} from "@/lib/push-platform";

const SERVICE_WORKER_PATH = "/push-sw.js";
const ACTIVATE_TIMEOUT_MS = 15_000;

export type EnablePushResult =
  | { status: "enabled" }
  | { status: "denied" }
  | { status: "dismissed" }
  | { status: "error"; message: string };

export function readPushEnvironment(): PushEnvironment {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    nav.standalone === true;

  return resolvePushEnvironment({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone,
    isSecureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
  });
}

export function readPushPermission(): PushPermission {
  if (typeof Notification === "undefined") return "default";
  return Notification.permission;
}

/** This device's push subscription for our VAPID key, if any (never registers a worker). */
export async function getDevicePushSubscription(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration?.pushManager) return null;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return null;
    const expected = urlBase64ToUint8Array(vapidPublicKey);
    return sameApplicationServerKey(subscription.options.applicationServerKey, expected)
      ? subscription
      : null;
  } catch {
    return null;
  }
}

function waitForActive(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (registration.active) return Promise.resolve(registration);
  const worker = registration.installing ?? registration.waiting;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Notification service took too long to start. Please try again.")),
      ACTIVATE_TIMEOUT_MS
    );
    const done = () => {
      window.clearTimeout(timer);
      resolve(registration);
    };
    if (!worker) {
      navigator.serviceWorker.ready.then(done, reject);
      return;
    }
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") done();
      if (worker.state === "redundant") {
        window.clearTimeout(timer);
        reject(new Error("Notification service failed to start. Please reload and try again."));
      }
    });
  });
}

function friendlySubscribeError(error: unknown, env: PushEnvironment): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "Notification permission was not granted.";
  if (name === "AbortError" || name === "NotSupportedError") {
    return env.platform === "android"
      ? "This browser couldn't reach its push service. Use Chrome (with Google Play services) and try again."
      : "This browser couldn't reach its push service. Check that notifications aren't disabled in the browser's settings, then try again.";
  }
  if (name === "InvalidStateError") return "Please reload the page and try again.";
  if (error instanceof Error && /took too long|failed to start/.test(error.message)) return error.message;
  return "Couldn't enable notifications on this device. Please try again.";
}

/**
 * Ask for permission, register the push service worker, subscribe with our
 * VAPID key, and save the device. Must be called directly from a tap handler:
 * iOS only shows the permission prompt during a user gesture, so permission
 * is requested before any other await.
 */
export async function enableWebPush(options: {
  vapidPublicKey: string;
  env: PushEnvironment;
}): Promise<EnablePushResult> {
  const { vapidPublicKey, env } = options;

  let permission: NotificationPermission;
  try {
    permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
  } catch {
    return { status: "error", message: "This browser couldn't show the notification permission prompt." };
  }
  if (permission === "denied") return { status: "denied" };
  if (permission !== "granted") return { status: "dismissed" };

  let subscription: PushSubscription;
  try {
    const registration = await waitForActive(
      await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: "/" })
    );
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const existing = await registration.pushManager.getSubscription();
    if (existing && sameApplicationServerKey(existing.options.applicationServerKey, applicationServerKey)) {
      subscription = existing;
    } else {
      // A subscription made with another key (e.g. the old OneSignal worker)
      // blocks subscribe() with InvalidStateError until it is removed.
      if (existing) await existing.unsubscribe().catch(() => false);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }
  } catch (error) {
    console.error("[push] subscribe failed:", error);
    return { status: "error", message: friendlySubscribeError(error, env) };
  }

  try {
    const res = await fetch("/api/admin/push", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        subscription: subscription.toJSON(),
        platform: env.platform,
        standalone: env.standalone,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        status: "error",
        message: typeof data.error === "string" ? data.error : "Couldn't save this device. Please try again.",
      };
    }
  } catch {
    return { status: "error", message: "Network error while saving this device. Please try again." };
  }

  return { status: "enabled" };
}
