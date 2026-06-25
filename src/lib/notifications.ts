import { createServiceClient } from "@/lib/supabase/server";
import { sendBrandedEmail } from "@/lib/email";
import { sendAdminPushNotification } from "@/lib/onesignal-push";

export type NotificationType =
  | "proposal_submitted"
  | "proposal_approved"
  | "proposal_changes"
  | "schedule_change_requested"
  | "payment_received"
  | "revision_requested"
  | "shoot_proposed"
  | "quote_sent"
  | "status_changed"
  | "deliverables_uploaded"
  | "invoice_available"
  | "payment_confirmed";

interface NotifyOptions {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  projectId?: string;
  notifyAdmins?: boolean;
  notifyClients?: boolean;
  clientId?: string;
  sendEmail?: boolean;
}

async function getAdminUserIds(): Promise<{ id: string; email: string; full_name: string | null }[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "admin");
  return data ?? [];
}

async function getProjectClientUsers(projectId: string): Promise<{ id: string; email: string; full_name: string | null }[]> {
  const supabase = await createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .single();

  const clientIds = new Set<string>();
  if (project?.client_id) clientIds.add(project.client_id);

  const { data: junction } = await supabase
    .from("project_clients")
    .select("client_id")
    .eq("project_id", projectId);

  junction?.forEach((j) => clientIds.add(j.client_id));

  if (!clientIds.size) return [];

  const { data: clients } = await supabase
    .from("clients")
    .select("user_id, email, name")
    .in("id", Array.from(clientIds));

  const userIds = clients?.map((c) => c.user_id).filter(Boolean) as string[] ?? [];
  if (!userIds.length) {
    return (clients ?? []).map((c) => ({
      id: c.user_id || c.email,
      email: c.email,
      full_name: c.name,
    }));
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  return profiles ?? [];
}

export async function notifyUsers(options: NotifyOptions) {
  const supabase = await createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const recipients: { id: string; email: string; full_name: string | null }[] = [];

  if (options.notifyAdmins) {
    recipients.push(...(await getAdminUserIds()));
  }

  if (options.notifyClients && options.projectId) {
    recipients.push(...(await getProjectClientUsers(options.projectId)));
  }

  const unique = new Map<string, typeof recipients[0]>();
  for (const r of recipients) {
    if (r.id && !unique.has(r.id)) unique.set(r.id, r);
  }

  const link = options.link?.startsWith("http") ? options.link : `${appUrl}${options.link || ""}`;

  for (const user of unique.values()) {
    if (!user.id || user.id.includes("@")) continue;

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: options.type,
      title: options.title,
      body: options.body ?? null,
      link: options.link ?? null,
      project_id: options.projectId ?? null,
    });

    if (options.sendEmail !== false && user.email) {
      await sendBrandedEmail({
        to: user.email,
        subject: options.title,
        title: options.title,
        body: options.body || "",
        ctaLabel: options.link ? "View in Portal" : undefined,
        ctaUrl: options.link ? link : undefined,
      });
    }
  }

  if (options.notifyAdmins) {
    void sendAdminPushNotification({
      title: options.title,
      message: options.body || options.title,
      url: options.link,
      projectId: options.projectId,
      eventType: options.type,
    }).catch((error) => {
      console.error("[onesignal] admin push failed:", error);
    });
  }
}

export async function notifyAdmins(options: Omit<NotifyOptions, "notifyAdmins" | "notifyClients">) {
  return notifyUsers({ ...options, notifyAdmins: true, notifyClients: false });
}

export async function notifyProjectClients(options: Omit<NotifyOptions, "notifyAdmins" | "notifyClients"> & { projectId: string }) {
  return notifyUsers({ ...options, notifyAdmins: false, notifyClients: true });
}
