import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { markAdminPushEnabled, sendAdminTestPush } from "@/lib/onesignal-push";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  deleteWebPushSubscription,
  getWebPushPublicKey,
  hasWebPushSubscription,
  normalizePushPlatform,
  parseSubscriptionInput,
  saveWebPushSubscription,
} from "@/lib/web-push";

function requestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export async function GET() {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const db = await createTenantServiceClient(tenant.businessId);

  const { data } = await db.raw
    .from("profiles")
    .select("push_notifications_enabled, onesignal_subscription_id")
    .eq("id", profile.id)
    .eq("business_id", tenant.businessId)
    .single();

  const vapidPublicKey = getWebPushPublicKey();
  return NextResponse.json({
    configured: Boolean(vapidPublicKey),
    vapidPublicKey,
    enabled: data?.push_notifications_enabled ?? false,
    subscriptionId: data?.onesignal_subscription_id ?? null,
  });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;

  if (action === "subscribe" || action === "resubscribe") {
    if (!profile.business_id || profile.business_id !== tenant.businessId) {
      return NextResponse.json(
        { error: "Push notifications can only be enabled from your own business portal." },
        { status: 403 }
      );
    }
    if (!getWebPushPublicKey()) {
      return NextResponse.json(
        { error: "Push notifications are not configured for this environment." },
        { status: 503 }
      );
    }
    const subscription = parseSubscriptionInput(body.subscription);
    if (!subscription) {
      return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
    }

    if (action === "resubscribe" && typeof body.oldEndpoint === "string" && body.oldEndpoint !== subscription.endpoint) {
      await deleteWebPushSubscription(tenant.businessId, profile.id, body.oldEndpoint);
    }

    const saved = await saveWebPushSubscription({
      businessId: tenant.businessId,
      profileId: profile.id,
      subscription,
      platform: normalizePushPlatform(body.platform),
      standalone: body.standalone === true,
      origin: requestOrigin(request),
      userAgent: request.headers.get("user-agent"),
    });
    if (!saved.ok) {
      return NextResponse.json(
        { error: "Couldn't save this device for notifications. Please try again." },
        { status: 500 }
      );
    }

    await markAdminPushEnabled(profile.id, undefined, tenant.businessId);
    return NextResponse.json({ success: true });
  }

  if (action === "check") {
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const registered = endpoint
      ? await hasWebPushSubscription(tenant.businessId, profile.id, endpoint)
      : false;
    return NextResponse.json({ registered });
  }

  if (action === "test") {
    const result = await sendAdminTestPush(profile.id, tenant.businessId);
    if (!result.sent) {
      const message =
        result.reason === "not_configured"
          ? "Push notifications are not configured for this environment."
          : result.detail
            ? `Failed to send test push: ${result.detail}`
            : "Failed to send test push. Enable notifications on this device first.";
      return NextResponse.json(
        { error: message, reason: result.reason, detail: result.detail },
        { status: result.reason === "not_configured" ? 503 : 502 }
      );
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
