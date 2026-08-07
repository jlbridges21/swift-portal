import { createServiceClient } from "@/lib/supabase/server";
import type { ClientMessage } from "@/lib/types";
import type { ConversationListItem, CrmTimelineItem } from "@/lib/messaging-types";

export type { ConversationListItem, CrmTimelineItem } from "@/lib/messaging-types";

export async function listAdminConversations(
  adminUserId: string
): Promise<ConversationListItem[]> {
  const supabase = await createServiceClient();

  const { data: messages } = await supabase
    .from("client_messages")
    .select("id, client_id, body, created_at, sender_role, sender_user_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (!messages?.length) return [];

  const clientIds = Array.from(new Set(messages.map((m) => m.client_id)));
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, company")
    .in("id", clientIds)
    .is("deleted_at", null);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

  const messageIds = messages.map((m) => m.id);
  const { data: reads } = await supabase
    .from("client_message_reads")
    .select("message_id")
    .eq("user_id", adminUserId)
    .in("message_id", messageIds);
  const readSet = new Set((reads ?? []).map((r) => r.message_id));

  const byClient = new Map<string, ConversationListItem>();

  for (const msg of messages) {
    const client = clientMap.get(msg.client_id);
    if (!client) continue;

    const existing = byClient.get(msg.client_id);
    const isUnread =
      msg.sender_role === "client" && msg.sender_user_id !== adminUserId && !readSet.has(msg.id);

    if (!existing) {
      byClient.set(msg.client_id, {
        client_id: msg.client_id,
        client_name: client.name,
        client_email: client.email,
        company: client.company,
        last_message: msg.body,
        last_message_at: msg.created_at,
        last_sender_role: msg.sender_role as "admin" | "client",
        unread_count: isUnread ? 1 : 0,
      });
    } else if (isUnread) {
      existing.unread_count += 1;
    }
  }

  return Array.from(byClient.values()).sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );
}

/** Ensure a conversation list entry exists for a client (e.g. deep-link before first message). */
export async function getOrCreateConversationStub(
  clientId: string
): Promise<ConversationListItem | null> {
  const supabase = await createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, company")
    .eq("id", clientId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!client) return null;

  return {
    client_id: client.id,
    client_name: client.name,
    client_email: client.email,
    company: client.company,
    last_message: "",
    last_message_at: new Date().toISOString(),
    last_sender_role: "admin",
    unread_count: 0,
  };
}

export async function getClientMessages(
  clientId: string,
  viewerUserId: string
): Promise<ClientMessage[]> {
  const supabase = await createServiceClient();

  const { data: messages } = await supabase
    .from("client_messages")
    .select("id, client_id, project_id, sender_user_id, sender_role, body, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

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
        .from("client_message_reads")
        .select("message_id")
        .eq("user_id", viewerUserId)
        .in("message_id", messageIds)
    : { data: [] as { message_id: string }[] };
  const readSet = new Set((reads ?? []).map((r) => r.message_id));

  return (messages ?? []).map((m) => ({
    ...m,
    sender_role: m.sender_role as "admin" | "client",
    sender_name: nameById.get(m.sender_user_id) ?? "User",
    is_unread: m.sender_user_id !== viewerUserId && !readSet.has(m.id),
  }));
}

export async function markClientMessagesRead(clientId: string, userId: string): Promise<number> {
  const supabase = await createServiceClient();
  const { data: messages } = await supabase
    .from("client_messages")
    .select("id, sender_user_id")
    .eq("client_id", clientId);

  const toMark = (messages ?? [])
    .filter((m) => m.sender_user_id !== userId)
    .map((m) => ({
      message_id: m.id,
      user_id: userId,
      read_at: new Date().toISOString(),
    }));

  if (!toMark.length) return 0;

  await supabase.from("client_message_reads").upsert(toMark, {
    onConflict: "message_id,user_id",
  });
  return toMark.length;
}

export async function buildClientCrmTimeline(
  clientId: string,
  viewerUserId: string
): Promise<CrmTimelineItem[]> {
  const supabase = await createServiceClient();
  const items: CrmTimelineItem[] = [];

  const messages = await getClientMessages(clientId, viewerUserId);
  for (const m of messages) {
    items.push({
      id: `msg-${m.id}`,
      kind: "message",
      created_at: m.created_at,
      title: m.sender_role === "admin" ? "Admin message" : "Client message",
      body: m.body,
      sender_role: m.sender_role,
      is_unread: m.is_unread,
      project_id: m.project_id,
    });
  }

  const { data: communications } = await supabase
    .from("communications")
    .select("id, title, message, comm_type, status, created_at, project_id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(80);

  for (const c of communications ?? []) {
    const isEmail = c.comm_type === "email" || c.comm_type?.includes("email");
    items.push({
      id: `comm-${c.id}`,
      kind: isEmail ? "email" : "activity",
      created_at: c.created_at,
      title: c.title || (isEmail ? "Email sent" : "Communication"),
      body: c.message,
      meta: c.status,
      project_id: c.project_id,
    });
  }

  const { data: activities } = await supabase
    .from("activity_logs")
    .select("id, activity_type, description, title, project_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(80);

  // Also include project activities for this client's projects
  const { data: junction } = await supabase
    .from("project_clients")
    .select("project_id")
    .eq("client_id", clientId);
  const { data: owned } = await supabase.from("projects").select("id").eq("client_id", clientId);
  const projectIds = Array.from(
    new Set([
      ...(junction ?? []).map((j) => j.project_id),
      ...(owned ?? []).map((p) => p.id),
    ])
  );

  let projectActivities: {
    id: string;
    activity_type: string;
    description: string;
    title: string | null;
    project_id: string | null;
    created_at: string;
  }[] = [];

  if (projectIds.length) {
    const { data } = await supabase
      .from("activity_logs")
      .select("id, activity_type, description, title, project_id, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(100);
    projectActivities = data ?? [];
  }

  const seenActivity = new Set<string>();
  for (const a of [...(activities ?? []), ...projectActivities]) {
    if (seenActivity.has(a.id)) continue;
    seenActivity.add(a.id);
    items.push({
      id: `act-${a.id}`,
      kind: "activity",
      created_at: a.created_at,
      title: a.title || a.activity_type.replace(/_/g, " "),
      body: a.description,
      project_id: a.project_id,
    });
  }

  if (projectIds.length) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, project_name")
      .in("id", projectIds);
    const nameMap = new Map((projects ?? []).map((p) => [p.id, p.project_name]));
    for (const item of items) {
      if (item.project_id) item.project_name = nameMap.get(item.project_id) ?? null;
    }
  }

  return items.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function countAdminUnreadMessages(adminUserId: string): Promise<number> {
  const conversations = await listAdminConversations(adminUserId);
  return conversations.reduce((sum, c) => sum + c.unread_count, 0);
}
