import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { getBusinessPortalOriginById, joinPortalPath } from "@/lib/portal-url";
import { LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";
import { isLiveBusiness } from "@/lib/business-live";

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

/**
 * Send a web push notification to subscribed portal admins via OneSignal.
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

  return callOneSignal(payload, `admin_event:${options.eventType ?? "unknown"}`);
}

/** Send a test push to the current admin device. */
export async function sendAdminTestPush(
  userId: string,
  businessId: string
): Promise<PushSendResult> {
  const { appId } = getOneSignalConfig();
  if (!appId) {
    return { sent: false, reason: "not_configured" };
  }

  const appUrl = await getBusinessPortalOriginById(businessId);
  const settings = await getAppSettings(businessId);

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

  return callOneSignal(
    {
      ...basePayload,
      include_aliases: { external_id: [userId] },
    },
    "admin_test:external_id"
  );
}

export async function markAdminPushEnabled(
  userId: string,
  subscriptionId: string | null,
  businessId: string
) {
  const db = await createTenantServiceClient(businessId);
  await db.raw
    .from("profiles")
    .update({
      push_notifications_enabled: true,
      onesignal_subscription_id: subscriptionId,
    })
    .eq("id", userId)
    .eq("business_id", businessId);
}
