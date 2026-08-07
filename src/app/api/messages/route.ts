import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { requireAdminApi } from "@/lib/api-auth";
import {
  buildClientCrmTimeline,
  getClientMessages,
  listAdminConversations,
  markClientMessagesRead,
} from "@/lib/client-messaging";
import { notifyAdmins, notifyClient } from "@/lib/notifications";
import { sendBrandedEmail } from "@/lib/email";
import { getAppSettings } from "@/lib/app-settings";
import { ensureClientPortalLink } from "@/lib/client-portal-link";
import type { ClientMessage } from "@/lib/types";

/** Admin inbox list, or client gets their own thread via ?mine=1 */
export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  const timeline = searchParams.get("timeline") === "1";
  const unreadOnly = searchParams.get("unread_count") === "1";

  if (profile.role === "admin") {
    if (unreadOnly) {
      const list = await listAdminConversations(profile.id);
      const count = list.reduce((s, c) => s + c.unread_count, 0);
      return NextResponse.json({ count });
    }

    if (clientId) {
      if (timeline) {
        const items = await buildClientCrmTimeline(clientId, profile.id);
        return NextResponse.json(items);
      }
      if (searchParams.get("stub") === "1") {
        const { getOrCreateConversationStub } = await import("@/lib/client-messaging");
        const stub = await getOrCreateConversationStub(clientId);
        if (!stub) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        return NextResponse.json(stub);
      }
      const messages = await getClientMessages(clientId, profile.id);
      return NextResponse.json(messages);
    }

    const conversations = await listAdminConversations(profile.id);
    return NextResponse.json(conversations);
  }

  // Client: only their own conversation
  if (!profile.client_id) {
    return NextResponse.json({ error: "No client profile linked" }, { status: 403 });
  }

  const messages = await getClientMessages(profile.client_id, profile.id);
  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const projectId = typeof body.project_id === "string" ? body.project_id : null;

  if (!text) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const isAdmin = profile.role === "admin";
  let clientId = typeof body.client_id === "string" ? body.client_id : null;

  if (isAdmin) {
    if (!clientId) {
      return NextResponse.json({ error: "client_id required" }, { status: 400 });
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

  if (projectId) {
    // Optional: ensure project is related to this client
    const { data: access } = await supabase
      .from("project_clients")
      .select("id")
      .eq("project_id", projectId)
      .eq("client_id", clientId!)
      .maybeSingle();
    const { data: primary } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("client_id", clientId!)
      .maybeSingle();
    if (!access && !primary && !isAdmin) {
      return NextResponse.json({ error: "Project access denied" }, { status: 403 });
    }
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
    console.error("[client-messages] insert failed", error?.message);
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
    await ensureClientPortalLink(clientId!);

    await notifyClient({
      clientId: clientId!,
      type: "project_message",
      eventKey: "project_message",
      title: "You have a new message",
      body: preview,
      link: `/dashboard/messages`,
      projectId: projectId ?? undefined,
      sendEmail: false,
    });

    if (client.email) {
      const appSettings = await getAppSettings();
      void sendBrandedEmail({
        to: client.email,
        subject: "You have a new message from Swift Aerial Media",
        title: "You have a new message",
        body: `${appSettings.business.adminDisplayName || "Swift Aerial Media"} sent you a message:\n\n"${text}"`,
        ctaLabel: "Open Conversation",
        ctaUrl: `${appUrl}/dashboard/messages`,
        emailType: "project_message",
        analytics: { projectId: projectId ?? undefined, emailType: "project_message" },
      });
    }
  } else {
    await notifyAdmins({
      type: "project_message",
      eventKey: "project_message",
      title: `Message from ${client.name}`,
      body: preview,
      link: `/admin/messages?client=${clientId}`,
      projectId: projectId ?? undefined,
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

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  let clientId = typeof body.client_id === "string" ? body.client_id : null;

  if (profile.role === "client") {
    clientId = profile.client_id;
  } else {
    const auth = await requireAdminApi();
    if (!auth.ok) return auth.response;
    if (!clientId) {
      return NextResponse.json({ error: "client_id required" }, { status: 400 });
    }
  }

  if (!clientId) {
    return NextResponse.json({ error: "No client" }, { status: 400 });
  }

  const marked = await markClientMessagesRead(clientId, profile.id);
  return NextResponse.json({ success: true, marked });
}
