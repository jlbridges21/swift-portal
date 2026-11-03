import webpush, { WebPushError, type PushSubscription as WebPushSubscription } from "web-push";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { MARKETING_SUPPORT_EMAIL } from "@/lib/marketing";
import type { PushPlatform } from "@/lib/push-platform";

/**
 * Standard Web Push (VAPID) for portal admins. Unlike OneSignal web push —
 * which is locked to one site origin per OneSignal app — VAPID subscriptions
 * work on every tenant origin (subdomain or custom domain) and in both iOS
 * Home Screen apps and Android Chrome / installed web apps.
 *
 * Generate keys once with `npx web-push generate-vapid-keys` and set the
 * same pair in every environment; rotating keys orphans every device.
 */

const PUSH_TTL_SECONDS = 24 * 60 * 60;
const VALID_PLATFORMS = new Set<PushPlatform>(["ios", "android", "desktop", "other"]);

export interface WebPushPayload {
  title: string;
  body: string;
  /** Same-origin path; the service worker resolves it against its own origin. */
  url: string;
  icon?: string;
  tag?: string;
  eventType?: string;
}

export interface WebPushSendResult {
  attempted: number;
  delivered: number;
  removed: number;
  detail?: string;
}

export interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function getVapidConfig() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || `mailto:${MARKETING_SUPPORT_EMAIL}`;
  return { publicKey, privateKey, subject };
}

export function isWebPushConfigured(): boolean {
  const { publicKey, privateKey } = getVapidConfig();
  return Boolean(publicKey && privateKey);
}

/** Public VAPID key served to the browser at runtime (no NEXT_PUBLIC_ build dependency). */
export function getWebPushPublicKey(): string | null {
  return isWebPushConfigured() ? getVapidConfig().publicKey! : null;
}

/** Validate an untrusted PushSubscription JSON body. */
export function parseSubscriptionInput(value: unknown): SubscriptionInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof v.endpoint !== "string" || v.endpoint.length > 2048) return null;
  try {
    if (new URL(v.endpoint).protocol !== "https:") return null;
  } catch {
    return null;
  }
  const p256dh = v.keys?.p256dh;
  const auth = v.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!p256dh || !auth || p256dh.length > 256 || auth.length > 256) return null;
  return { endpoint: v.endpoint, keys: { p256dh, auth } };
}

export function normalizePushPlatform(value: unknown): PushPlatform {
  return typeof value === "string" && VALID_PLATFORMS.has(value as PushPlatform)
    ? (value as PushPlatform)
    : "other";
}

export async function saveWebPushSubscription(options: {
  businessId: string;
  profileId: string;
  subscription: SubscriptionInput;
  platform: PushPlatform;
  standalone: boolean;
  origin: string | null;
  userAgent: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const db = await createTenantServiceClient(options.businessId);
  const { error } = await db.from("web_push_subscriptions").upsert(
    {
      profile_id: options.profileId,
      endpoint: options.subscription.endpoint,
      p256dh: options.subscription.keys.p256dh,
      auth: options.subscription.keys.auth,
      platform: options.platform,
      standalone: options.standalone,
      origin: options.origin,
      user_agent: options.userAgent?.slice(0, 512) ?? null,
      updated_at: new Date().toISOString(),
      failure_count: 0,
    },
    { onConflict: "business_id,endpoint" }
  );

  if (error) {
    console.error("[web-push] failed to save subscription:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteWebPushSubscription(
  businessId: string,
  profileId: string,
  endpoint: string
): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  await db
    .from("web_push_subscriptions")
    .delete()
    .eq("profile_id", profileId)
    .eq("endpoint", endpoint);
}

export async function hasWebPushSubscription(
  businessId: string,
  profileId: string,
  endpoint: string
): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("web_push_subscriptions")
    .select("id")
    .eq("profile_id", profileId)
    .eq("endpoint", endpoint)
    .maybeSingle();
  return Boolean(data);
}

function describePushError(error: unknown): { statusCode?: number; detail: string } {
  if (error instanceof WebPushError) {
    return { statusCode: error.statusCode, detail: `${error.statusCode} ${error.body || error.message}`.trim() };
  }
  return { detail: error instanceof Error ? error.message : String(error) };
}

/**
 * Deliver one payload to every registered device of the given admins.
 * Never throws. Expired endpoints (404/410) are deleted so they stop costing sends.
 */
export async function sendWebPushToProfiles(
  businessId: string,
  profileIds: string[],
  payload: WebPushPayload,
  context: string
): Promise<WebPushSendResult> {
  const { publicKey, privateKey, subject } = getVapidConfig();
  if (!publicKey || !privateKey || profileIds.length === 0) {
    return { attempted: 0, delivered: 0, removed: 0 };
  }

  const db = await createTenantServiceClient(businessId);
  const { data: rows, error } = await db
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .in("profile_id", profileIds);

  if (error) {
    // Table not migrated yet, or a transient DB error — OneSignal legacy path still runs.
    console.error(`[web-push] ${context} failed to load subscriptions:`, error.message);
    return { attempted: 0, delivered: 0, removed: 0, detail: error.message };
  }
  if (!rows || rows.length === 0) return { attempted: 0, delivered: 0, removed: 0 };

  const body = JSON.stringify(payload);
  const errors: string[] = [];

  const outcomes = await Promise.all(
    rows.map(async (row) => {
      const subscription: WebPushSubscription = {
        endpoint: row.endpoint as string,
        keys: { p256dh: row.p256dh as string, auth: row.auth as string },
      };
      try {
        await webpush.sendNotification(subscription, body, {
          TTL: PUSH_TTL_SECONDS,
          // "high" lets Android deliver promptly in Doze; iOS maps it to priority 10.
          urgency: "high",
          vapidDetails: { subject, publicKey, privateKey },
        });
        await db
          .from("web_push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", row.id);
        return "delivered" as const;
      } catch (err) {
        const { statusCode, detail } = describePushError(err);
        errors.push(detail);
        if (statusCode === 404 || statusCode === 410) {
          await db.from("web_push_subscriptions").delete().eq("id", row.id);
          return "removed" as const;
        }
        await db
          .from("web_push_subscriptions")
          .update({ failure_count: ((row.failure_count as number) ?? 0) + 1 })
          .eq("id", row.id);
        return "failed" as const;
      }
    })
  );

  const delivered = outcomes.filter((o) => o === "delivered").length;
  const removed = outcomes.filter((o) => o === "removed").length;
  if (errors.length > 0) {
    console.warn(`[web-push] ${context} ${errors.length}/${rows.length} failed:`, errors.join("; "));
  } else {
    console.info(`[web-push] ${context} delivered to ${delivered} device(s)`);
  }

  return {
    attempted: rows.length,
    delivered,
    removed,
    detail: errors.length > 0 ? errors.join("; ") : undefined,
  };
}
