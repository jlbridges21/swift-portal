import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { sendBrandedEmail } from "@/lib/email";
import { sendAdminPushNotification } from "@/lib/onesignal-push";
import { sendClientEmailNotification } from "@/lib/client-email-notifications";
import { getAppSettings } from "@/lib/app-settings";
import type { NotificationEventKey } from "@/lib/app-settings";
import { resolveNotificationEventKey } from "@/lib/notification-settings";
import type { NotificationType } from "@/lib/types";
import { getStatusOrder } from "@/lib/constants";
import { ensureClientPortalLink } from "@/lib/client-portal-link";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { isLiveBusiness } from "@/lib/business-live";

export type { NotificationType };

interface NotifyOptions {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  projectId?: string;
  paymentId?: string;
  notifyAdmins?: boolean;
  notifyClients?: boolean;
  clientId?: string;
  sendEmail?: boolean;
  eventKey?: NotificationEventKey;
  businessId?: string;
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

/** Discover business_id from an explicit arg, else the related project or client row. */
async function resolveNotifyBusinessId(options: NotifyOptions): Promise<string | null> {
  if (options.businessId) return options.businessId;

  const raw = await createServiceClient();
  if (options.projectId) {
    const { data } = await raw
      .from("projects")
      .select("business_id")
      .eq("id", options.projectId)
      .maybeSingle();
    if (data?.business_id) return data.business_id;
  }
  if (options.clientId) {
    const { data } = await raw
      .from("clients")
      .select("business_id")
      .eq("id", options.clientId)
      .maybeSingle();
    if (data?.business_id) return data.business_id;
  }
  return null;
}

async function loadProfiles(businessId: string, userIds: string[]): Promise<ProfileRow[]> {
  if (!userIds.length) return [];

  const db = await createTenantServiceClient(businessId);

  const { data, error } = await db.raw
    .from("profiles")
    .select("id, email, full_name, client_id, email_notifications_enabled, in_app_notifications_enabled")
    .eq("business_id", businessId)
    .in("id", userIds);

  if (!error && data) return data as ProfileRow[];

  console.warn("[notifications] profile preference columns unavailable, using base profile fields:", error?.message);
  const { data: fallback, error: fallbackError } = await db.raw
    .from("profiles")
    .select("id, email, full_name, client_id")
    .eq("business_id", businessId)
    .in("id", userIds);

  if (fallbackError) {
    console.error("[notifications] failed to load profiles:", fallbackError.message);
    return [];
  }

  return (fallback ?? []) as ProfileRow[];
}

async function getAdminRecipients(businessId: string): Promise<NotificationRecipient[]> {
  const db = await createTenantServiceClient(businessId);
  // profiles is unscoped in the tenant wrapper — filter role AND business_id here.
  // super_admin rows (NULL business_id) are intentionally excluded.
  const { data } = await db.raw
    .from("profiles")
    .select("id, email, full_name, email_notifications_enabled, in_app_notifications_enabled")
    .eq("role", "admin")
    .eq("business_id", businessId);

  return (data ?? []).map((profile) => ({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: "admin" as const,
    email_notifications_enabled: profile.email_notifications_enabled !== false,
    in_app_notifications_enabled: profile.in_app_notifications_enabled !== false,
  }));
}

async function getSingleClientRecipient(
  businessId: string,
  clientId: string
): Promise<NotificationRecipient | null> {
  const db = await createTenantServiceClient(businessId);
  await ensureClientPortalLink(clientId, businessId);

  const { data: client } = await db
    .from("clients")
    .select("id, user_id, email, name")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.user_id) {
    console.warn("[notifications] client has no portal user:", clientId);
    return null;
  }

  const profiles = await loadProfiles(businessId, [client.user_id]);
  const profile = profiles[0];
  const email = (profile?.email || client.email || "").trim();

  return {
    id: client.user_id,
    email,
    full_name: profile?.full_name ?? client.name ?? null,
    role: "client",
    client_id: client.id,
    email_notifications_enabled: profile?.email_notifications_enabled !== false,
    in_app_notifications_enabled: profile?.in_app_notifications_enabled !== false,
  };
}

async function getProjectClientRecipients(
  businessId: string,
  projectId: string
): Promise<NotificationRecipient[]> {
  const db = await createTenantServiceClient(businessId);

  const { data: project } = await db
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .single();

  const clientIds = new Set<string>();
  if (project?.client_id) clientIds.add(project.client_id);

  const { data: junction } = await db
    .from("project_clients")
    .select("client_id")
    .eq("project_id", projectId);

  junction?.forEach((j) => clientIds.add(j.client_id));

  if (!clientIds.size) {
    console.warn("[notifications] no clients linked to project:", projectId);
    return [];
  }

  const { data: clients, error: clientsError } = await db
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
  const profiles = await loadProfiles(businessId, userIds);
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

async function hasDuplicatePaymentNotification(
  businessId: string,
  userId: string,
  paymentId: string
): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "payment_received")
    .eq("payment_id", paymentId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[notifications] payment dedup check failed:", error.message);
    return false;
  }

  return !!data;
}

export async function notifyUsers(options: NotifyOptions) {
  const businessId = await resolveNotifyBusinessId(options);
  if (!businessId) {
    console.warn("[notifications] skipped — could not resolve businessId", {
      type: options.type,
      projectId: options.projectId,
      clientId: options.clientId,
    });
    return;
  }

  if (!(await isLiveBusiness(businessId))) {
    console.info("[notifications] skipped — business is not live", { businessId, type: options.type });
    return;
  }

  const db = await createTenantServiceClient(businessId);
  const appUrl = await getBusinessPortalOriginById(businessId);
  const recipients: NotificationRecipient[] = [];

  const appSettings = await getAppSettings(businessId);
  const eventKey = resolveNotificationEventKey(options);
  const channelSettings = eventKey ? appSettings.notifications[eventKey] : null;

  let projectContext: { project_name: string; status: string } | null = null;
  if (options.projectId) {
    const { data } = await db
      .from("projects")
      .select("project_name, status")
      .eq("id", options.projectId)
      .single();
    if (data) projectContext = data;
  }

  if (options.notifyAdmins) {
    recipients.push(...(await getAdminRecipients(businessId)));
  }

  if (options.clientId) {
    const single = await getSingleClientRecipient(businessId, options.clientId);
    if (single) recipients.push(single);
  } else if (options.notifyClients && options.projectId) {
    recipients.push(...(await getProjectClientRecipients(businessId, options.projectId)));
  }

  const unique = new Map<string, NotificationRecipient>();
  for (const recipient of recipients) {
    if (recipient.id && !unique.has(recipient.id)) unique.set(recipient.id, recipient);
  }

  const link = options.link?.startsWith("http") ? options.link : `${appUrl}${options.link || ""}`;

  const allowInApp = channelSettings?.inApp !== false;
  const allowEmail = channelSettings?.email !== false;
  const allowPush = channelSettings?.push !== false;

  for (const user of unique.values()) {
    if (!user.id || user.id.includes("@")) continue;

    if (options.paymentId && options.type === "payment_received") {
      const duplicate = await hasDuplicatePaymentNotification(businessId, user.id, options.paymentId);
      if (duplicate) {
        console.info("[notifications] skipped duplicate payment_received", {
          userId: user.id,
          paymentId: options.paymentId,
        });
        continue;
      }
    }

    const shouldCreateInApp =
      allowInApp && (user.role === "admin" || user.in_app_notifications_enabled !== false);

    let notificationId: string | null = null;

    if (shouldCreateInApp) {
      const { data: notification } = await db
        .from("notifications")
        .insert({
          user_id: user.id,
          type: options.type,
          title: options.title,
          body: options.body ?? null,
          link: options.link ?? null,
          project_id: options.projectId ?? null,
          payment_id: options.paymentId ?? null,
        })
        .select("id")
        .single();
      notificationId = notification?.id ?? null;
    }

    if (options.sendEmail === false || !user.email || !allowEmail) {
      if (options.sendEmail !== false && !user.email) {
        console.warn("[email] skipped — missing email for user:", user.id, options.type);
      }
      continue;
    }

    if (user.role === "admin") {
      try {
        await sendBrandedEmail({
          businessId,
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
        businessId,
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

  if (options.notifyAdmins && allowPush) {
    try {
      const pushResult = await sendAdminPushNotification({
        businessId,
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

/** Notify a single client by CRM client_id (not all project clients). */
export async function notifyClient(
  options: Omit<NotifyOptions, "notifyAdmins" | "notifyClients" | "clientId"> & {
    clientId: string;
  }
) {
  return notifyUsers({
    ...options,
    clientId: options.clientId,
    notifyAdmins: false,
    notifyClients: false,
  });
}
