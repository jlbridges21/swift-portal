"use client";

import type { OneSignalNamespace } from "@/types/onesignal";

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const SDK_SRC = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

let scriptPromise: Promise<void> | null = null;
let initPromise: Promise<OneSignalNamespace> | null = null;
let sdkInstance: OneSignalNamespace | null = null;

function ensureDeferredQueue() {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
}

function isAlreadyInitializedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already initialized/i.test(message);
}

function loadOneSignalScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OneSignal can only run in the browser"));
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById("onesignal-sdk")) {
      resolve();
      return;
    }

    ensureDeferredQueue();
    const script = document.createElement("script");
    script.id = "onesignal-sdk";
    script.src = SDK_SRC;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load OneSignal SDK"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function isOneSignalConfigured(): boolean {
  return Boolean(APP_ID);
}

async function initializeSdk(OneSignal: OneSignalNamespace): Promise<OneSignalNamespace> {
  if (sdkInstance) return sdkInstance;

  try {
    await OneSignal.init({
      appId: APP_ID!,
      serviceWorkerPath: "/OneSignalSDKWorker.js",
      allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
    });
  } catch (error) {
    if (!isAlreadyInitializedError(error)) {
      throw error;
    }
  }

  sdkInstance = OneSignal;
  return OneSignal;
}

export async function initOneSignal(): Promise<OneSignalNamespace> {
  if (!APP_ID) {
    throw new Error("OneSignal is not configured");
  }

  if (sdkInstance) return sdkInstance;
  if (initPromise) return initPromise;

  await loadOneSignalScript();

  initPromise = new Promise((resolve, reject) => {
    window.OneSignalDeferred!.push(async (OneSignal) => {
      try {
        const instance = await initializeSdk(OneSignal);
        resolve(instance);
      } catch (error) {
        if (isAlreadyInitializedError(error)) {
          sdkInstance = OneSignal;
          resolve(OneSignal);
          return;
        }
        initPromise = null;
        reject(error);
      }
    });
  });

  return initPromise;
}

export async function enableAdminPushNotifications(userId: string) {
  const OneSignal = await initOneSignal();
  await OneSignal.login(userId);
  await OneSignal.User.addTag("swift_portal_role", "admin");
  await OneSignal.User.PushSubscription.optIn();

  return {
    subscriptionId: OneSignal.User.PushSubscription.id ?? null,
    optedIn: Boolean(OneSignal.User.PushSubscription.optedIn),
  };
}

export async function getLocalPushSubscriptionStatus() {
  if (!APP_ID) {
    return { configured: false, optedIn: false, subscriptionId: null as string | null };
  }

  try {
    const OneSignal = await initOneSignal();
    return {
      configured: true,
      optedIn: Boolean(OneSignal.User.PushSubscription.optedIn),
      subscriptionId: OneSignal.User.PushSubscription.id ?? null,
    };
  } catch {
    return { configured: true, optedIn: false, subscriptionId: null as string | null };
  }
}
