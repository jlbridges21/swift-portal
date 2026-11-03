import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { getBusinessPortalOriginById, joinPortalPath } from "@/lib/portal-url";
import { LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";
import { isLiveBusiness } from "@/lib/business-live";
import { SITE_ICONS } from "@/lib/site-metadata";
import { toSameOriginPushPath } from "@/lib/push-platform";
import { isWebPushConfigured, sendWebPushToProfiles, type WebPushPayload } from "@/lib/web-push";

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications?c=push";

export interface AdminPushNotificationOptions {
  businessId: string;
  title: string;
  message: string;
  url?: string;
  projectId?: string;
  eventType?: string;
}

interface OneSignalApiResponse {
  id?: string;
  errors?: string[] | Record<string, string>;
}

export interface PushSendResult {
  sent: boolean;
  reason?: string;
  detail?: string;
}

function getOneSignalConfig() {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  return { appId, apiKey };
}

function trimForLockScreen(text: string, max = 178): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

async function resolveAdminPushUrl(options: AdminPushNotificationOptions): Promise<string> {
  const appUrl = await getBusinessPortalOriginById(options.businessId);

  if (options.projectId) {
    return `${appUrl}/admin/projects/${options.projectId}`;
  }

  if (options.url) {
    return options.url.startsWith("http") ? options.url : joinPortalPath(appUrl, options.url);
  }

  return `${appUrl}/admin`;
}

function formatOneSignalErrors(errors: OneSignalApiResponse["errors"]): string {
  if (!errors) return "unknown_error";
  if (Array.isArray(errors)) return errors.join("; ");
  return Object.entries(errors)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

/**
 * Tag filters on every admin send so a shared OneSignal app cannot fan out
 * across businesses. Untagged subscriptions (created before prompt 11) are
 * treated as Swift on send only — they are re-tagged on next Enable.
 */
function adminPushFilters(businessId: string): Record<string, unknown>[] {
  const roleAdmin = { field: "tag", key: "swift_portal_role", relation: "=", value: "admin" };
  const thisBusiness = { field: "tag", key: "business_id", relation: "=", value: businessId };

  if (businessId === LEGACY_DEFAULT_BUSINESS_ID) {
    return [
      roleAdmin,
      thisBusiness,
      { operator: "OR" },
      { field: "tag", key: "swift_portal_role", relation: "=", value: "admin" },
      { field: "tag", key: "business_id", relation: "not_exists" },
    ];
  }

  return [roleAdmin, thisBusiness];
}

async function getPushEnabledAdminIds(businessId: string): Promise<string[]> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.raw
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("business_id", businessId)
    .eq("push_notifications_enabled", true);

  if (error) {
    console.error("[onesignal] failed to load push-enabled admins:", error.message);
    return [];
  }

  return data?.map((profile) => profile.id) ?? [];
}

async function callOneSignal(
  payload: Record<string, unknown>,
  context: string
): Promise<PushSendResult> {
  const { appId, apiKey } = getOneSignalConfig();
  if (!appId || !apiKey) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({ app_id: appId, ...payload }),
    });

    const data = (await response.json().catch(() => ({}))) as OneSignalApiResponse;

    if (!response.ok) {
      const detail = formatOneSignalErrors(data.errors) || JSON.stringify(data);
      console.error(`[onesignal] ${context} HTTP ${response.status}:`, detail);
      return { sent: false, reason: "api_error", detail };
    }

    if (!data.id) {
      const detail = formatOneSignalErrors(data.errors) || "no_recipients";
      console.error(`[onesignal] ${context} not delivered:`, detail);
      return { sent: false, reason: "no_recipients", detail };
    }

    console.info(`[onesignal] ${context} sent:`, data.id);
    return { sent: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[onesignal] ${context} network error:`, detail);
    return { sent: false, reason: "network_error", detail };
  }
}

function isOneSignalConfiguredServer(): boolean {
  const { appId, apiKey } = getOneSignalConfig();
  return Boolean(appId && apiKey);
}

async function pushIconForBusiness(businessId: string): Promise<string> {
  try {
    const settings = await getAppSettings(businessId);
    return settings.business.faviconUrl || SITE_ICONS.icon192;
  } catch {
    return SITE_ICONS.icon192;
  }
}

/**
 * Merge the two delivery channels. Web Push (VAPID) covers every portal origin
 * on iOS and Android; OneSignal remains for devices subscribed before Web Push
 * existed (only possible on the OneSignal app's single configured origin).
 */
function combineResults(
  webPush: { attempted: number; delivered: number; detail?: string },
  oneSignal: PushSendResult | null
): PushSendResult {
  if (webPush.delivered > 0 || oneSignal?.sent) return { sent: true };
  if (!isWebPushConfigured() && !oneSignal) return { sent: false, reason: "not_configured" };
  const details = [webPush.detail, oneSignal?.detail].filter(Boolean).join("; ");
  if (webPush.attempted === 0 && (!oneSignal || oneSignal.reason === "no_recipients" || oneSignal.reason === "not_configured")) {
    return { sent: false, reason: "no_recipients", detail: details || undefined };
  }
  return { sent: false, reason: oneSignal?.reason ?? "api_error", detail: details || undefined };
}

/**
 * Send a push notification to subscribed portal admins (Web Push + OneSignal legacy).
 * Never throws — failures are logged and returned to callers.
 */
export async function sendAdminPushNotification(
  options: AdminPushNotificationOptions
): Promise<PushSendResult> {
  if (!(await isLiveBusiness(options.businessId))) {
    return { sent: false, reason: "business_not_live" };
  }
  const targetUrl = await resolveAdminPushUrl(options);
  const title = trimForLockScreen(options.title, 65);
  const message = trimForLockScreen(options.message || options.title);
  const filters = adminPushFilters(options.businessId);

  const adminIds = await getPushEnabledAdminIds(options.businessId);

  const webPushPayload: WebPushPayload = {
    title,
    body: message,
    url: toSameOriginPushPath(targetUrl),
    icon: await pushIconForBusiness(options.businessId),
    eventType: options.eventType,
  };
  const webPushResult = await sendWebPushToProfiles(
    options.businessId,
    adminIds,
    webPushPayload,
    `admin_event:${options.eventType ?? "unknown"}`
  );

  if (!isOneSignalConfiguredServer()) {
    return combineResults(webPushResult, null);
  }

  const payload: Record<string, unknown> = {
    target_channel: "push",
    headings: { en: title },
    contents: { en: message },
    url: targetUrl,
    data: {
      projectId: options.projectId ?? null,
      eventType: options.eventType ?? null,
      url: targetUrl,
    },
    filters,
  };

  if (adminIds.length > 0) {
    payload.include_aliases = { external_id: adminIds };
  }

  const oneSignalResult = await callOneSignal(payload, `admin_event:${options.eventType ?? "unknown"}`);
  return combineResults(webPushResult, oneSignalResult);
}

/** Send a test push to the current admin's devices. */
export async function sendAdminTestPush(
  userId: string,
  businessId: string
): Promise<PushSendResult> {
  const appUrl = await getBusinessPortalOriginById(businessId);
  const settings = await getAppSettings(businessId);

  const webPushResult = await sendWebPushToProfiles(
    businessId,
    [userId],
    {
      title: `${settings.business.portalName} Test`,
      body: "Push notifications are working.",
      url: "/admin",
      icon: settings.business.faviconUrl || SITE_ICONS.icon192,
      tag: "push-test",
      eventType: "test",
    },
    "admin_test:web_push"
  );
  if (webPushResult.delivered > 0) return { sent: true };

  if (!isOneSignalConfiguredServer()) {
    return combineResults(webPushResult, null);
  }

  const db = await createTenantServiceClient(businessId);
  const { data: profile } = await db.raw
    .from("profiles")
    .select("onesignal_subscription_id")
    .eq("id", userId)
    .single();

  const filters = adminPushFilters(businessId);
  const basePayload = {
    target_channel: "push",
    headings: { en: `${settings.business.portalName} Test` },
    contents: { en: "Push notifications are working." },
    url: `${appUrl}/admin`,
    data: { url: `${appUrl}/admin`, eventType: "test" },
    filters,
  };

  if (profile?.onesignal_subscription_id) {
    const bySubscription = await callOneSignal(
      {
        ...basePayload,
        include_subscription_ids: [profile.onesignal_subscription_id],
      },
      "admin_test:subscription_id"
    );
    if (bySubscription.sent) return bySubscription;
    console.warn(
      "[onesignal] admin_test subscription_id failed, retrying with external_id:",
      bySubscription.detail
    );
  }

  const byExternalId = await callOneSignal(
    {
      ...basePayload,
      include_aliases: { external_id: [userId] },
    },
    "admin_test:external_id"
  );
  return combineResults(webPushResult, byExternalId);
}

/** Pass `subscriptionId: undefined` (Web Push) to keep any legacy OneSignal id intact. */
export async function markAdminPushEnabled(
  userId: string,
  subscriptionId: string | null | undefined,
  businessId: string
) {
  const db = await createTenantServiceClient(businessId);
  await db.raw
    .from("profiles")
    .update({
      push_notifications_enabled: true,
      ...(subscriptionId !== undefined ? { onesignal_subscription_id: subscriptionId } : {}),
    })
    .eq("id", userId)
    .eq("business_id", businessId);
}
