import { createServiceClient } from "@/lib/supabase/server";

export interface AdminPushNotificationOptions {
  title: string;
  message: string;
  url?: string;
  projectId?: string;
  eventType?: string;
}

function resolveAdminPushUrl(options: AdminPushNotificationOptions): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com").replace(
    /\/$/,
    ""
  );

  if (options.projectId) {
    return `${appUrl}/admin/projects/${options.projectId}`;
  }

  if (options.url) {
    return options.url.startsWith("http") ? options.url : `${appUrl}${options.url}`;
  }

  return `${appUrl}/admin`;
}

/**
 * Send a web push notification to subscribed Swift Portal admins via OneSignal.
 * Fails gracefully — never throws to callers.
 */
export async function sendAdminPushNotification(
  options: AdminPushNotificationOptions
): Promise<{ sent: boolean; reason?: string }> {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return { sent: false, reason: "not_configured" };
  }

  const targetUrl = resolveAdminPushUrl(options);

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        filters: [
          { field: "tag", key: "swift_portal_role", relation: "=", value: "admin" },
        ],
        headings: { en: options.title },
        contents: { en: options.message },
        url: targetUrl,
        web_url: targetUrl,
        data: {
          projectId: options.projectId ?? null,
          eventType: options.eventType ?? null,
          url: targetUrl,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[onesignal] push failed:", response.status, errorText);
      return { sent: false, reason: "api_error" };
    }

    return { sent: true };
  } catch (error) {
    console.error("[onesignal] push error:", error);
    return { sent: false, reason: "network_error" };
  }
}

/** Send a test push only to admins with push enabled in their profile. */
export async function sendAdminTestPush(userId: string): Promise<{ sent: boolean; reason?: string }> {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return { sent: false, reason: "not_configured" };
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com").replace(
    /\/$/,
    ""
  );

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_aliases: { external_id: [userId] },
        target_channel: "push",
        headings: { en: "Swift Portal Test" },
        contents: { en: "Push notifications are working." },
        url: `${appUrl}/admin`,
        web_url: `${appUrl}/admin`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[onesignal] test push failed:", response.status, errorText);
      return { sent: false, reason: "api_error" };
    }

    return { sent: true };
  } catch (error) {
    console.error("[onesignal] test push error:", error);
    return { sent: false, reason: "network_error" };
  }
}

export async function markAdminPushEnabled(userId: string, subscriptionId: string | null) {
  const supabase = await createServiceClient();
  await supabase
    .from("profiles")
    .update({
      push_notifications_enabled: true,
      onesignal_subscription_id: subscriptionId,
    })
    .eq("id", userId);
}
