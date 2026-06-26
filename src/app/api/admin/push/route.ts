import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { markAdminPushEnabled, sendAdminTestPush } from "@/lib/onesignal-push";

export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("push_notifications_enabled, onesignal_subscription_id")
    .eq("id", profile.id)
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

  const body = await request.json();
  const action = body.action as string;

  if (action === "subscribe") {
    await markAdminPushEnabled(profile.id, body.subscriptionId ?? null);
    return NextResponse.json({ success: true });
  }

  if (action === "test") {
    const result = await sendAdminTestPush(profile.id);
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
