import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { filterClientVisibleActivities } from "@/lib/communications";
import { getClientActivityDisplay } from "@/lib/activity-display";
import type { ActivityLog, ClientMessage } from "@/lib/types";
import type { ConversationListItem, CrmTimelineItem } from "@/lib/messaging-types";

export type { ConversationListItem, CrmTimelineItem } from "@/lib/messaging-types";

/** Collapse near-duplicate milestone logs (same type + project within a short window). */
function dedupeMeaningfulActivities(activities: ActivityLog[]): ActivityLog[] {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const normalizeType = (type: string) => {
    if (type === "payment_completed") return "payment_received";
    if (type === "lead_created") return "proposal_submitted";
    if (type === "official_proposal_sent") return "quote_sent";
    return type;
  };

  const kept: ActivityLog[] = [];
  for (const activity of sorted) {
    const type = normalizeType(activity.activity_type);
    const projectId = activity.project_id ?? null;
    const at = new Date(activity.created_at).getTime();

    const isDup = kept.some((existing) => {
      if (normalizeType(existing.activity_type) !== type) return false;
      if ((existing.project_id ?? null) !== projectId) return false;
      const delta = Math.abs(new Date(existing.created_at).getTime() - at);
      // Payments / proposals often double-logged; other types only collapse true duplicates.
      const windowMs =
        type === "payment_received" || type === "proposal_submitted" || type === "quote_sent"
          ? 24 * 60 * 60 * 1000
          : 2 * 60 * 1000;
      return delta <= windowMs;
    });

    if (!isDup) kept.push(activity);
  }

  return kept;
}

export async function listAdminConversations(
  businessId: string,
  adminUserId: string
): Promise<ConversationListItem[]> {
  const db = await createTenantServiceClient(businessId);

  const { data: messages } = await db
    .from("client_messages")
    .select("id, client_id, body, created_at, sender_role, sender_user_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (!messages?.length) return [];

  const clientIds = Array.from(new Set(messages.map((m) => m.client_id)));
  const { data: clients } = await db
    .from("clients")
    .select("id, name, email, company")
    .in("id", clientIds)
    .is("deleted_at", null);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

  const messageIds = messages.map((m) => m.id);
  const { data: reads } = await db
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
  businessId: string,
  clientId: string
): Promise<ConversationListItem | null> {
  const db = await createTenantServiceClient(businessId);
  const { data: client } = await db
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
  businessId: string,
  clientId: string,
  viewerUserId: string,
  options?: { includeAdminReadReceipts?: boolean }
): Promise<ClientMessage[]> {
  const db = await createTenantServiceClient(businessId);

  const { data: messages } = await db
    .from("client_messages")
    .select("id, client_id, project_id, sender_user_id, sender_role, body, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  const senderIds = Array.from(new Set((messages ?? []).map((m) => m.sender_user_id)));
  const { data: profiles } = senderIds.length
    ? await db.raw.from("profiles").select("id, full_name, email").in("id", senderIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "User"])
  );

  const messageIds = (messages ?? []).map((m) => m.id);
  const { data: reads } = messageIds.length
    ? await db
        .from("client_message_reads")
        .select("message_id")
        .eq("user_id", viewerUserId)
        .in("message_id", messageIds)
    : { data: [] as { message_id: string }[] };
  const readSet = new Set((reads ?? []).map((r) => r.message_id));

  const mapped = (messages ?? []).map((m) => ({
    ...m,
    sender_role: m.sender_role as "admin" | "client",
    sender_name: nameById.get(m.sender_user_id) ?? "User",
    is_unread: m.sender_user_id !== viewerUserId && !readSet.has(m.id),
  }));

  if (options?.includeAdminReadReceipts) {
    const receipts = await loadAdminReadReceipts(businessId, clientId, messages ?? []);
    return mapped.map((m) => ({
      ...m,
      read_receipt: m.sender_role === "admin" ? receipts.get(m.id) ?? null : null,
    })) as ClientMessage[];
  }

  return mapped;
}

/**
 * Intended in-app readers for a client thread: portal profiles linked to that client.
 * Threads are per client_id (not per project), so “2 of 3” only applies when a client
 * has multiple portal users — rare, but we still report it accurately.
 */
async function recipientUserIdsForClient(
  businessId: string,
  clientId: string
): Promise<string[]> {
  const db = await createTenantServiceClient(businessId);
  const ids = new Set<string>();

  const { data: client } = await db
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (client?.user_id) ids.add(client.user_id);

  const { data: profiles } = await db.raw
    .from("profiles")
    .select("id")
    .eq("business_id", businessId)
    .eq("client_id", clientId)
    .eq("role", "client");
  for (const p of profiles ?? []) {
    if (p.id) ids.add(p.id);
  }

  return Array.from(ids);
}

async function loadAdminReadReceipts(
  businessId: string,
  clientId: string,
  messages: { id: string; sender_role: string; sender_user_id: string }[]
): Promise<Map<string, import("@/lib/messaging-types").MessageReadReceipt>> {
  const adminMsgs = messages.filter((m) => m.sender_role === "admin");
  const out = new Map<string, import("@/lib/messaging-types").MessageReadReceipt>();
  if (!adminMsgs.length) return out;

  const recipients = await recipientUserIdsForClient(businessId, clientId);
  const messageIds = adminMsgs.map((m) => m.id);
  const db = await createTenantServiceClient(businessId);

  const { data: reads } = recipients.length
    ? await db
        .from("client_message_reads")
        .select("message_id, user_id, read_at")
        .in("message_id", messageIds)
        .in("user_id", recipients)
    : { data: [] as { message_id: string; user_id: string; read_at: string }[] };

  const byMessage = new Map<string, { user_id: string; read_at: string }[]>();
  for (const r of reads ?? []) {
    const list = byMessage.get(r.message_id) ?? [];
    list.push({ user_id: r.user_id, read_at: r.read_at });
    byMessage.set(r.message_id, list);
  }

  for (const msg of adminMsgs) {
    const list = byMessage.get(msg.id) ?? [];
    const times = list.map((r) => r.read_at).sort();
    out.set(msg.id, {
      recipient_count: recipients.length,
      read_count: list.length,
      first_read_at: times[0] ?? null,
      last_read_at: times[times.length - 1] ?? null,
    });
  }

  return out;
}

export async function markClientMessagesRead(
  businessId: string,
  clientId: string,
  userId: string
): Promise<number> {
  const db = await createTenantServiceClient(businessId);
  const { data: messages } = await db
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

  await db.from("client_message_reads").upsert(toMark, {
    onConflict: "message_id,user_id",
  });
  return toMark.length;
}

export async function buildClientCrmTimeline(
  businessId: string,
  clientId: string,
  viewerUserId: string
): Promise<CrmTimelineItem[]> {
  const db = await createTenantServiceClient(businessId);
  const items: CrmTimelineItem[] = [];

  const messages = await getClientMessages(businessId, clientId, viewerUserId, {
    includeAdminReadReceipts: true,
  });
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
      message_id: m.id,
      read_receipt: m.sender_role === "admin" ? m.read_receipt ?? null : null,
    });
  }

  // Meaningful milestones only — same filter as client Recent Activity.
  // Do not include communications / email transport logs.
  const { data: junction } = await db
    .from("project_clients")
    .select("project_id")
    .eq("client_id", clientId);
  const { data: owned } = await db.from("projects").select("id").eq("client_id", clientId);
  const projectIds = Array.from(
    new Set([
      ...(junction ?? []).map((j) => j.project_id),
      ...(owned ?? []).map((p) => p.id),
    ])
  );

  const activitySelect =
    "id, activity_type, description, title, project_id, client_id, visibility, user_id, lead_id, property_id, metadata, created_at";

  const { data: clientActivities } = await db
    .from("activity_logs")
    .select(activitySelect)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(120);

  let projectActivities: ActivityLog[] = [];
  if (projectIds.length) {
    const { data } = await db
      .from("activity_logs")
      .select(activitySelect)
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(150);
    projectActivities = (data ?? []) as ActivityLog[];
  }

  const byId = new Map<string, ActivityLog>();
  for (const a of [...((clientActivities ?? []) as ActivityLog[]), ...projectActivities]) {
    byId.set(a.id, a);
  }

  const meaningful = dedupeMeaningfulActivities(
    filterClientVisibleActivities(Array.from(byId.values()))
  );

  for (const a of meaningful) {
    const display = getClientActivityDisplay(a.activity_type, a.description);
    items.push({
      id: `act-${a.id}`,
      kind: "activity",
      created_at: a.created_at,
      title: display.description,
      body: null,
      icon: display.icon,
      project_id: a.project_id,
    });
  }

  if (projectIds.length) {
    const { data: projects } = await db
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

export async function countAdminUnreadMessages(
  businessId: string,
  adminUserId: string
): Promise<number> {
  const conversations = await listAdminConversations(businessId, adminUserId);
  return conversations.reduce((sum, c) => sum + c.unread_count, 0);
}
