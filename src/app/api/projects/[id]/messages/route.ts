import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { sendBrandedEmail } from "@/lib/email";
import { getAppSettings } from "@/lib/app-settings";
import type { ProjectMessage } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(profile, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
  }

  const supabase = await createServiceClient();
  const { data: messages, error } = await supabase
    .from("project_messages")
    .select("id, project_id, sender_user_id, sender_role, body, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[messages] list failed", error.message);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }

  const senderIds = Array.from(new Set((messages ?? []).map((m) => m.sender_user_id)));
  const { data: profiles } = senderIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", senderIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "User"])
  );

  const messageIds = (messages ?? []).map((m) => m.id);
  const { data: reads } = messageIds.length
    ? await supabase
        .from("project_message_reads")
        .select("message_id")
        .eq("user_id", profile.id)
        .in("message_id", messageIds)
    : { data: [] as { message_id: string }[] };

  const readSet = new Set((reads ?? []).map((r) => r.message_id));

  const enriched: ProjectMessage[] = (messages ?? []).map((m) => ({
    ...m,
    sender_role: m.sender_role as "admin" | "client",
    sender_name: nameById.get(m.sender_user_id) ?? "User",
    is_unread: m.sender_user_id !== profile.id && !readSet.has(m.id),
  }));

  return NextResponse.json(enriched);
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
  const supabase = await createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, project_name, property_address")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: message, error } = await supabase
    .from("project_messages")
    .insert({
      project_id: projectId,
      sender_user_id: profile.id,
      sender_role: isAdmin ? "admin" : "client",
      body: text,
    })
    .select("id, project_id, sender_user_id, sender_role, body, created_at")
    .single();

  if (error || !message) {
    console.error("[messages] insert failed", error?.message);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  // Mark own message as read for sender
  await supabase.from("project_message_reads").upsert(
    { message_id: message.id, user_id: profile.id, read_at: new Date().toISOString() },
    { onConflict: "message_id,user_id" }
  );

  const projectLabel = project.project_name || project.property_address || "your project";
  const preview = text.length > 160 ? `${text.slice(0, 157)}…` : text;

  if (isAdmin) {
    await notifyProjectClients({
      type: "project_message",
      eventKey: "project_message",
      title: "New message from Swift Aerial Media",
      body: preview,
      link: `/dashboard/projects/${projectId}#messages`,
      projectId,
      sendEmail: false,
    });

    const appSettings = await getAppSettings();
    const portalUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com").replace(/\/$/, "")}/dashboard/projects/${projectId}#messages`;

    const clientIds = new Set<string>();
    const { data: projectRow } = await supabase
      .from("projects")
      .select("client_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectRow?.client_id) clientIds.add(projectRow.client_id);

    const { data: junctionRows } = await supabase
      .from("project_clients")
      .select("client_id")
      .eq("project_id", projectId);
    junctionRows?.forEach((j) => clientIds.add(j.client_id));

    if (clientIds.size) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, email, name")
        .in("id", Array.from(clientIds))
        .is("deleted_at", null);

      for (const client of clients ?? []) {
        if (!client.email) continue;
        void sendBrandedEmail({
          to: client.email,
          subject: `New message about ${projectLabel}`,
          title: "You have a new portal message",
          body: `${appSettings.business.adminDisplayName || "Swift Aerial Media"} sent you a message about ${projectLabel}:\n\n"${text}"`,
          projectName: projectLabel,
          ctaLabel: "View Conversation",
          ctaUrl: portalUrl,
          emailType: "project_message",
          analytics: { projectId, emailType: "project_message" },
        });
      }
    }
  } else {
    await notifyAdmins({
      type: "project_message",
      eventKey: "project_message",
      title: "New client message",
      body: `${profile.full_name || profile.email}: ${preview}`,
      link: `/admin/projects/${projectId}#messages`,
      projectId,
    });
  }

  const result: ProjectMessage = {
    ...message,
    sender_role: message.sender_role as "admin" | "client",
    sender_name: profile.full_name || profile.email,
    is_unread: false,
  };

  return NextResponse.json(result);
}

/** Mark all messages from the other party as read for the current user. */
export async function PATCH(_request: Request, { params }: RouteParams) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(profile, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
  }

  const supabase = await createServiceClient();
  const { data: messages } = await supabase
    .from("project_messages")
    .select("id, sender_user_id")
    .eq("project_id", projectId);

  const toMark = (messages ?? [])
    .filter((m) => m.sender_user_id !== profile.id)
    .map((m) => ({
      message_id: m.id,
      user_id: profile.id,
      read_at: new Date().toISOString(),
    }));

  if (toMark.length) {
    const { error } = await supabase
      .from("project_message_reads")
      .upsert(toMark, { onConflict: "message_id,user_id" });
    if (error) {
      console.error("[messages] mark read failed", error.message);
      return NextResponse.json({ error: "Failed to mark messages read" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, marked: toMark.length });
}
