import { createServiceClient } from "@/lib/supabase/server";
import { sendBrandedEmail } from "@/lib/email";
import { sendAdminPushNotification } from "@/lib/onesignal-push";
import { sendClientEmailNotification } from "@/lib/client-email-notifications";
import type { NotificationType } from "@/lib/types";

export type { NotificationType };

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

interface NotificationRecipient {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "client";
  client_id?: string | null;
  email_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
}

async function getAdminRecipients(): Promise<NotificationRecipient[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, email_notifications_enabled, in_app_notifications_enabled")
    .eq("role", "admin");

  return (data ?? []).map((profile) => ({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: "admin" as const,
    email_notifications_enabled: profile.email_notifications_enabled ?? true,
    in_app_notifications_enabled: profile.in_app_notifications_enabled ?? true,
  }));
}

async function getProjectClientRecipients(projectId: string): Promise<NotificationRecipient[]> {
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
    .select("id, user_id, email, name")
    .in("id", Array.from(clientIds));

  const userIds = clients?.map((c) => c.user_id).filter(Boolean) as string[] ?? [];

  if (!userIds.length) {
    return (clients ?? [])
      .filter((c) => c.user_id)
      .map((c) => ({
        id: c.user_id!,
        email: c.email,
        full_name: c.name,
        role: "client" as const,
        client_id: c.id,
        email_notifications_enabled: true,
        in_app_notifications_enabled: true,
      }));
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, client_id, email_notifications_enabled, in_app_notifications_enabled"
    )
    .in("id", userIds);

  const clientByUserId = new Map(clients?.map((c) => [c.user_id, c.id]) ?? []);

  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: "client" as const,
    client_id: profile.client_id ?? clientByUserId.get(profile.id) ?? null,
    email_notifications_enabled: profile.email_notifications_enabled ?? true,
    in_app_notifications_enabled: profile.in_app_notifications_enabled ?? true,
  }));
}

export async function notifyUsers(options: NotifyOptions) {
  const supabase = await createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const recipients: NotificationRecipient[] = [];

  if (options.notifyAdmins) {
    recipients.push(...(await getAdminRecipients()));
  }

  if (options.notifyClients && options.projectId) {
    recipients.push(...(await getProjectClientRecipients(options.projectId)));
  }

  const unique = new Map<string, NotificationRecipient>();
  for (const recipient of recipients) {
    if (recipient.id && !unique.has(recipient.id)) unique.set(recipient.id, recipient);
  }

  const link = options.link?.startsWith("http") ? options.link : `${appUrl}${options.link || ""}`;

  for (const user of unique.values()) {
    if (!user.id || user.id.includes("@")) continue;

    const shouldCreateInApp =
      user.role === "admin" || user.in_app_notifications_enabled !== false;

    if (shouldCreateInApp) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: options.type,
        title: options.title,
        body: options.body ?? null,
        link: options.link ?? null,
        project_id: options.projectId ?? null,
      });
    }

    if (options.sendEmail === false || !user.email) continue;

    if (user.role === "admin") {
      void sendBrandedEmail({
        to: user.email,
        subject: options.title,
        title: options.title,
        body: options.body || "",
        ctaLabel: options.link ? "View in Portal" : undefined,
        ctaUrl: options.link ? link : undefined,
      });
      continue;
    }

    void sendClientEmailNotification({
        userId: user.id,
        clientId: user.client_id,
        email: user.email,
        title: options.title,
        message: options.body || options.title,
      url: options.link,
      eventType: options.type,
    });
  }

  if (options.notifyAdmins) {
    try {
      const pushResult = await sendAdminPushNotification({
        title: options.title,
        message: options.body || options.title,
        url: options.link,
        projectId: options.projectId,
        eventType: options.type,
      });

      if (!pushResult.sent) {
        console.warn(
          "[onesignal] admin push skipped:",
          options.type,
          pushResult.reason,
          pushResult.detail ?? ""
        );
      }
    } catch (error) {
      console.error("[onesignal] admin push unexpected error:", options.type, error);
    }
  }
}

export async function notifyAdmins(options: Omit<NotifyOptions, "notifyAdmins" | "notifyClients">) {
  return notifyUsers({ ...options, notifyAdmins: true, notifyClients: false });
}

export async function notifyProjectClients(
  options: Omit<NotifyOptions, "notifyAdmins" | "notifyClients"> & { projectId: string }
) {
  return notifyUsers({ ...options, notifyAdmins: false, notifyClients: true });
}
