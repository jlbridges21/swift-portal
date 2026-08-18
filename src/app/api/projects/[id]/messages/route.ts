import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import {
  getClientMessages,
  markClientMessagesRead,
} from "@/lib/client-messaging";
import { notifyAdmins, notifyClient } from "@/lib/notifications";
import { sendBrandedEmail } from "@/lib/email";
import { getAppSettings } from "@/lib/app-settings";
import { getTenantContext, LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";
import { ensureClientPortalLink } from "@/lib/client-portal-link";
import type { ClientMessage } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Legacy project-scoped messages route.
 * Now proxies to per-client `client_messages` so multi-client projects
 * never share a thread. Clients only see their own conversation.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(profile, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
  }

  if (profile.role === "admin") {
    return NextResponse.json(
      {
        error: "Use /api/messages?client_id=… for admin messaging",
        redirect: "/admin/messages",
      },
      { status: 410 }
    );
  }

  if (!profile.client_id) {
    return NextResponse.json({ error: "No client profile linked" }, { status: 403 });
  }

  const messages = await getClientMessages(profile.client_id, profile.id);
  return NextResponse.json(messages);
}

export async function POST(request: Request, { params }: RouteParams) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(profile, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "Message is too long (max 5000 characters)" }, { status: 400 });
  }

  const isAdmin = profile.role === "admin";
  let clientId: string | null =
    typeof body.client_id === "string" ? body.client_id : null;

  if (isAdmin) {
    if (!clientId) {
      return NextResponse.json(
        { error: "client_id required — use /admin/messages to message a specific client" },
        { status: 400 }
      );
    }
  } else {
    if (!profile.client_id) {
      return NextResponse.json({ error: "No client profile linked" }, { status: 403 });
    }
    clientId = profile.client_id;
  }

  const supabase = await createServiceClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, user_id")
    .eq("id", clientId!)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: message, error } = await supabase
    .from("client_messages")
    .insert({
      client_id: clientId,
      project_id: projectId,
      sender_user_id: profile.id,
      sender_role: isAdmin ? "admin" : "client",
      body: text,
    })
    .select("id, client_id, project_id, sender_user_id, sender_role, body, created_at")
    .single();

  if (error || !message) {
    console.error("[messages] insert failed", error?.message);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  await supabase.from("client_message_reads").upsert(
    { message_id: message.id, user_id: profile.id, read_at: new Date().toISOString() },
    { onConflict: "message_id,user_id" }
  );

  const preview = text.length > 160 ? `${text.slice(0, 157)}…` : text;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com").replace(
    /\/$/,
    ""
  );

  if (isAdmin) {
    await ensureClientPortalLink(
      clientId!,
      LEGACY_DEFAULT_BUSINESS_ID // TODO(tenant): pass client.business_id into ensureClientPortalLink
    );
    await notifyClient({
      clientId: clientId!,
      type: "project_message",
      eventKey: "project_message",
      title: "You have a new message",
      body: preview,
      link: `/dashboard/messages`,
      projectId,
      sendEmail: false,
    });
    if (client.email) {
      const tenant = await getTenantContext();
      const appSettings = await getAppSettings(
        tenant?.businessId ?? LEGACY_DEFAULT_BUSINESS_ID // TODO(tenant): require tenant on project messages API
      );
      void sendBrandedEmail({
        to: client.email,
        subject: "You have a new message from Swift Aerial Media",
        title: "You have a new message",
        body: `${appSettings.business.adminDisplayName || "Swift Aerial Media"} sent you a message:\n\n"${text}"`,
        ctaLabel: "Open Conversation",
        ctaUrl: `${appUrl}/dashboard/messages`,
        emailType: "project_message",
        analytics: { projectId, emailType: "project_message" },
      });
    }
  } else {
    await notifyAdmins({
      type: "project_message",
      eventKey: "project_message",
      title: `Message from ${client.name}`,
      body: preview,
      link: `/admin/messages?client=${clientId}`,
      projectId,
    });
  }

  const result: ClientMessage = {
    ...message,
    sender_role: message.sender_role as "admin" | "client",
    sender_name: profile.full_name || profile.email,
    is_unread: false,
  };

  return NextResponse.json(result);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(profile, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
  }

  if (profile.role === "admin") {
    const body = await request.json().catch(() => ({}));
    const clientId = typeof body.client_id === "string" ? body.client_id : null;
    if (!clientId) {
      return NextResponse.json({ error: "client_id required" }, { status: 400 });
    }
    const marked = await markClientMessagesRead(clientId, profile.id);
    return NextResponse.json({ success: true, marked });
  }

  if (!profile.client_id) {
    return NextResponse.json({ error: "No client profile linked" }, { status: 403 });
  }

  const marked = await markClientMessagesRead(profile.client_id, profile.id);
  return NextResponse.json({ success: true, marked });
}
