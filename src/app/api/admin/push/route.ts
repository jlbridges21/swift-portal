import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { markAdminPushEnabled, sendAdminTestPush } from "@/lib/onesignal-push";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
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

  return NextResponse.json({
    configured: Boolean(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID),
    enabled: data?.push_notifications_enabled ?? false,
    subscriptionId: data?.onesignal_subscription_id ?? null,
  });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const body = await request.json();
  const action = body.action as string;

  if (action === "subscribe") {
    await markAdminPushEnabled(profile.id, body.subscriptionId ?? null, tenant.businessId);
    return NextResponse.json({ success: true });
  }

  if (action === "test") {
    const result = await sendAdminTestPush(profile.id, tenant.businessId);
    if (!result.sent) {
      const message =
        result.reason === "not_configured"
          ? "OneSignal is not configured"
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
