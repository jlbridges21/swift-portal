import { createServiceClient } from "@/lib/supabase/server";
import { sendBrandedEmail } from "@/lib/email";
import { sendAdminPushNotification } from "@/lib/onesignal-push";
import { sendClientEmailNotification } from "@/lib/client-email-notifications";
import type { NotificationType } from "@/lib/types";
import { getStatusOrder } from "@/lib/constants";

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

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  client_id: string | null;
  email_notifications_enabled?: boolean | null;
  in_app_notifications_enabled?: boolean | null;
};

async function loadProfiles(userIds: string[]): Promise<ProfileRow[]> {
  if (!userIds.length) return [];

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, client_id, email_notifications_enabled, in_app_notifications_enabled")
    .in("id", userIds);

  if (!error && data) return data as ProfileRow[];

  console.warn("[notifications] profile preference columns unavailable, using base profile fields:", error?.message);
  const { data: fallback, error: fallbackError } = await supabase
    .from("profiles")
    .select("id, email, full_name, client_id")
    .in("id", userIds);

  if (fallbackError) {
    console.error("[notifications] failed to load profiles:", fallbackError.message);
    return [];
  }

  return (fallback ?? []) as ProfileRow[];
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
    email_notifications_enabled: profile.email_notifications_enabled !== false,
    in_app_notifications_enabled: profile.in_app_notifications_enabled !== false,
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

  if (!clientIds.size) {
    console.warn("[notifications] no clients linked to project:", projectId);
    return [];
  }

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, user_id, email, name")
    .in("id", Array.from(clientIds));

  if (clientsError) {
    console.error("[notifications] failed to load clients:", clientsError.message);
    return [];
  }

  const clientByUserId = new Map(
    (clients ?? []).filter((c) => c.user_id).map((c) => [c.user_id as string, c])
  );
  const userIds = Array.from(clientByUserId.keys());
  const profiles = await loadProfiles(userIds);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const recipients: NotificationRecipient[] = [];

  for (const userId of userIds) {
    const profile = profileById.get(userId);
    const client = clientByUserId.get(userId);
    if (!client) continue;

    const email = (profile?.email || client.email || "").trim();
    if (!email) {
      console.warn("[notifications] client has no email:", userId, client.id);
    }

    recipients.push({
      id: userId,
      email,
      full_name: profile?.full_name ?? client.name ?? null,
      role: "client",
      client_id: profile?.client_id ?? client.id,
      email_notifications_enabled: profile?.email_notifications_enabled !== false,
      in_app_notifications_enabled: profile?.in_app_notifications_enabled !== false,
    });
  }

  if (!recipients.length) {
    console.warn("[notifications] no client portal users for project:", projectId);
  }

  return recipients;
}

export async function notifyUsers(options: NotifyOptions) {
  const supabase = await createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const recipients: NotificationRecipient[] = [];

  let projectContext: { project_name: string; status: string } | null = null;
  if (options.projectId) {
    const { data } = await supabase
      .from("projects")
      .select("project_name, status")
      .eq("id", options.projectId)
      .single();
    if (data) projectContext = data;
  }

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

    let notificationId: string | null = null;

    if (shouldCreateInApp) {
      const { data: notification } = await supabase
        .from("notifications")
        .insert({
          user_id: user.id,
          type: options.type,
          title: options.title,
          body: options.body ?? null,
          link: options.link ?? null,
          project_id: options.projectId ?? null,
        })
        .select("id")
        .single();
      notificationId = notification?.id ?? null;
    }

    if (options.sendEmail === false || !user.email) {
      if (options.sendEmail !== false && !user.email) {
        console.warn("[email] skipped — missing email for user:", user.id, options.type);
      }
      continue;
    }

    if (user.role === "admin") {
      try {
        await sendBrandedEmail({
          to: user.email,
          subject: options.title,
          title: options.title,
          body: options.body || "",
          projectName: projectContext?.project_name,
          ctaLabel: options.link ? "View in Portal" : undefined,
          ctaUrl: options.link ? link : undefined,
          progressStep: projectContext ? getStatusOrder(projectContext.status) : undefined,
          emailType: options.type,
          analytics: {
            projectId: options.projectId,
            notificationId,
            emailType: options.type,
          },
        });
      } catch (error) {
        console.error("[email] admin notification error:", options.type, error);
      }
      continue;
    }

    try {
      const emailResult = await sendClientEmailNotification({
        userId: user.id,
        clientId: user.client_id,
        email: user.email,
        title: options.title,
        message: options.body || options.title,
        url: options.link,
        eventType: options.type,
        projectId: options.projectId,
        projectName: projectContext?.project_name,
        projectStatus: projectContext?.status,
        notificationId,
      });

      if (!emailResult.sent) {
        console.warn(
          "[email] client notification not sent:",
          options.type,
          "→",
          user.email,
          emailResult.reason,
          emailResult.error ?? ""
        );
      }
    } catch (error) {
      console.error("[email] client notification unexpected error:", options.type, error);
    }
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
