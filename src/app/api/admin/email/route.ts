import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getEmailConfigStatus, getLastEmailSendResult, sendTestEmail } from "@/lib/email";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientUserId = searchParams.get("client_user_id");
  const clientEmail = searchParams.get("client_email");

  const supabase = await createServiceClient();
  let clientPrefs: {
    found: boolean;
    email: string | null;
    email_notifications_enabled: boolean;
    in_app_notifications_enabled: boolean;
    note?: string;
  } = {
    found: false,
    email: null,
    email_notifications_enabled: true,
    in_app_notifications_enabled: true,
  };

  if (clientUserId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, role, email_notifications_enabled, in_app_notifications_enabled")
      .eq("id", clientUserId)
      .single();

    if (!error && data) {
      clientPrefs = {
        found: true,
        email: data.email,
        email_notifications_enabled: data.email_notifications_enabled !== false,
        in_app_notifications_enabled: data.in_app_notifications_enabled !== false,
      };
    } else {
      clientPrefs.note = error?.message ?? "Client profile not found";
    }
  } else if (clientEmail) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, email, user_id, name")
      .eq("email", clientEmail)
      .maybeSingle();

    if (client?.user_id) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, role, email_notifications_enabled, in_app_notifications_enabled")
        .eq("id", client.user_id)
        .single();

      if (!error && data) {
        clientPrefs = {
          found: true,
          email: data.email || client.email,
          email_notifications_enabled: data.email_notifications_enabled !== false,
          in_app_notifications_enabled: data.in_app_notifications_enabled !== false,
        };
      } else {
        clientPrefs = {
          found: true,
          email: client.email,
          email_notifications_enabled: true,
          in_app_notifications_enabled: true,
          note: "Client record found but profile lookup failed — defaults assumed enabled",
        };
      }
    } else if (client) {
      clientPrefs = {
        found: true,
        email: client.email,
        email_notifications_enabled: true,
        in_app_notifications_enabled: true,
        note: "Client has no portal login yet — email would send to client record email once linked",
      };
    } else {
      clientPrefs.note = "No client found with that email";
    }
  }

  const lastSend = getLastEmailSendResult();

  return NextResponse.json({
    config: getEmailConfigStatus(),
    clientPrefs,
    lastSend: lastSend
      ? {
          sent: lastSend.sent,
          skipped: lastSend.skipped ?? false,
          skipReason: lastSend.skipReason ?? null,
          error: lastSend.error ?? null,
          messageId: lastSend.messageId ?? null,
          to: lastSend.to ?? null,
          subject: lastSend.subject ?? null,
          at: lastSend.at,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === "test") {
    const to = (body.email as string | undefined)?.trim() || profile.email;
    if (!to) {
      return NextResponse.json({ error: "A test email address is required" }, { status: 400 });
    }

    const result = await sendTestEmail(to);

    if (!result.sent) {
      return NextResponse.json(
        {
          error: result.error || result.skipReason || "Failed to send test email",
          reason: result.skipReason ?? "send_failed",
          detail: result.error ?? null,
          lastSend: result,
        },
        { status: result.skipped ? 503 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      lastSend: result,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
