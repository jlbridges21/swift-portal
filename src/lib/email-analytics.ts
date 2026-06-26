import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import { logCommunication } from "@/lib/communication-records";
import { EMAIL_TYPE_LABELS } from "@/lib/email-templates";
import type { ActivityType } from "@/lib/types";

export type EmailLifecycleEvent =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained";

export interface EmailEventRecord {
  id: string;
  resend_email_id: string | null;
  project_id: string | null;
  notification_id: string | null;
  recipient: string;
  email_type: string;
  event_type: EmailLifecycleEvent;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const RESEND_EVENT_MAP: Record<string, EmailLifecycleEvent> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

const ACTIVITY_TYPE_MAP: Record<EmailLifecycleEvent, ActivityType> = {
  sent: "email_sent",
  delivered: "email_delivered",
  opened: "email_opened",
  clicked: "email_clicked",
  bounced: "email_bounced",
  complained: "email_complained",
};

function emailTypeLabel(emailType: string): string {
  return EMAIL_TYPE_LABELS[emailType] ?? "Email";
}

function getActivityDescription(
  emailType: string,
  eventType: EmailLifecycleEvent,
  ctaLabel?: string
): string {
  const label = emailTypeLabel(emailType).replace(/ Email$/, " email").toLowerCase();
  const typeName = emailTypeLabel(emailType).replace(/ Email$/, "");

  switch (eventType) {
    case "sent":
      return `📨 ${typeName} email sent`;
    case "delivered":
      return `✅ ${typeName} email delivered`;
    case "opened":
      return `👀 Client opened ${label}`;
    case "clicked":
      return `🔗 Client clicked ${ctaLabel || "portal link"}`;
    case "bounced":
      return `⚠️ ${typeName} email bounced`;
    case "complained":
      return `⚠️ ${typeName} email marked as spam`;
    default:
      return `${typeName} email ${eventType}`;
  }
}

export async function recordEmailEvent(params: {
  resendEmailId?: string | null;
  projectId?: string | null;
  notificationId?: string | null;
  recipient: string;
  emailType: string;
  eventType: EmailLifecycleEvent;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
  ctaLabel?: string;
  logActivity?: boolean;
}): Promise<void> {
  try {
    const supabase = await createServiceClient();
    const occurredAt = params.occurredAt ?? new Date().toISOString();

    const { error } = await supabase.from("email_events").insert({
      resend_email_id: params.resendEmailId ?? null,
      project_id: params.projectId ?? null,
      notification_id: params.notificationId ?? null,
      recipient: params.recipient,
      email_type: params.emailType,
      event_type: params.eventType,
      occurred_at: occurredAt,
      metadata: params.metadata ?? null,
    });

    if (error) {
      if (error.code === "23505") return;
      console.error("[email-analytics] failed to record event:", error.message);
      return;
    }

    if (params.logActivity !== false && params.projectId) {
      await logProjectActivity(
        ACTIVITY_TYPE_MAP[params.eventType],
        getActivityDescription(params.emailType, params.eventType, params.ctaLabel),
        {
          projectId: params.projectId,
          visibility: "admin",
          metadata: {
            resendEmailId: params.resendEmailId,
            emailType: params.emailType,
            eventType: params.eventType,
            recipient: params.recipient,
            notificationId: params.notificationId,
            ...params.metadata,
          },
        }
      );
    }

    const commStatusMap: Record<EmailLifecycleEvent, import("@/lib/communication-records").CommunicationStatus> = {
      sent: "sent",
      delivered: "delivered",
      opened: "opened",
      clicked: "clicked",
      bounced: "bounced",
      complained: "failed",
    };

    await logCommunication({
      projectId: params.projectId,
      commType: "email",
      title: params.emailType,
      message: params.recipient,
      status: commStatusMap[params.eventType],
      provider: "resend",
      providerEventId: params.resendEmailId ?? null,
      metadata: {
        notificationId: params.notificationId,
        emailType: params.emailType,
        eventType: params.eventType,
        ...params.metadata,
      },
      createdAt: occurredAt,
    });
  } catch (error) {
    console.error("[email-analytics] unexpected error:", error);
  }
}

export function mapResendWebhookType(type: string): EmailLifecycleEvent | null {
  return RESEND_EVENT_MAP[type] ?? null;
}

export interface EmailCommunicationGroup {
  resendEmailId: string;
  emailType: string;
  emailLabel: string;
  recipient: string;
  subject?: string;
  events: {
    eventType: EmailLifecycleEvent;
    occurredAt: string;
    label: string;
    icon: string;
  }[];
}

export interface EmailCommunicationSummary extends EmailCommunicationGroup {
  statusIcon: string;
  statusLabel: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  bouncedAt?: string;
  complainedAt?: string;
  failureDetail?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  latestAt: string;
}

function eventIcon(eventType: EmailLifecycleEvent): string {
  switch (eventType) {
    case "sent":
      return "📨";
    case "delivered":
      return "✅";
    case "opened":
      return "👀";
    case "clicked":
      return "🔗";
    case "bounced":
      return "⚠️";
    case "complained":
      return "🚫";
    default:
      return "•";
  }
}

function resolveEmailStatus(events: EmailCommunicationGroup["events"]) {
  const has = (type: EmailLifecycleEvent) => events.some((e) => e.eventType === type);
  if (has("complained")) return { icon: "🚫", label: "Complaint / Spam" };
  if (has("bounced")) return { icon: "⚠️", label: "Bounced" };
  if (has("clicked")) return { icon: "🔗", label: "Clicked" };
  if (has("opened")) return { icon: "👀", label: "Opened" };
  if (has("delivered")) return { icon: "✅", label: "Delivered" };
  if (has("sent")) return { icon: "📨", label: "Sent" };
  return { icon: "❌", label: "Failed" };
}

function timestampFor(
  events: EmailCommunicationGroup["events"],
  type: EmailLifecycleEvent
): string | undefined {
  return events.find((e) => e.eventType === type)?.occurredAt;
}

export function buildEmailCommunicationSummaries(
  events: EmailEventRecord[]
): EmailCommunicationSummary[] {
  const groups = groupEmailEvents(events);

  return groups.map((group) => {
    const rawEvents = events.filter(
      (e) =>
        (e.resend_email_id && e.resend_email_id === group.resendEmailId) ||
        (!e.resend_email_id &&
          `${e.email_type}-${e.recipient}-${e.occurred_at.slice(0, 16)}` === group.resendEmailId)
    );

    const failureEvent = rawEvents.find(
      (e) => e.event_type === "bounced" || e.event_type === "complained"
    );
    const clickEvent = rawEvents.find((e) => e.event_type === "clicked");

    const status = resolveEmailStatus(group.events);
    const latestAt =
      group.events[group.events.length - 1]?.occurredAt ??
      group.events[0]?.occurredAt ??
      new Date().toISOString();

    return {
      ...group,
      statusIcon: status.icon,
      statusLabel: status.label,
      sentAt: timestampFor(group.events, "sent"),
      deliveredAt: timestampFor(group.events, "delivered"),
      openedAt: timestampFor(group.events, "opened"),
      clickedAt: timestampFor(group.events, "clicked"),
      bouncedAt: timestampFor(group.events, "bounced"),
      complainedAt: timestampFor(group.events, "complained"),
      failureDetail:
        typeof failureEvent?.metadata?.bounceMessage === "string"
          ? failureEvent.metadata.bounceMessage
          : undefined,
      ctaUrl:
        typeof clickEvent?.metadata?.clickLink === "string"
          ? clickEvent.metadata.clickLink
          : undefined,
      ctaLabel:
        typeof clickEvent?.metadata?.ctaLabel === "string"
          ? clickEvent.metadata.ctaLabel
          : group.events.find((e) => e.eventType === "clicked")?.label,
      latestAt,
    };
  });
}

export function groupEmailEvents(events: EmailEventRecord[]): EmailCommunicationGroup[] {
  const groups = new Map<string, EmailCommunicationGroup>();

  for (const event of events) {
    const key =
      event.resend_email_id ||
      `${event.email_type}-${event.recipient}-${event.occurred_at.slice(0, 16)}`;
    const existing = groups.get(key);
    const subject =
      typeof event.metadata?.subject === "string" ? event.metadata.subject : undefined;

    const entry = {
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      label:
        event.event_type === "clicked" && event.metadata?.ctaLabel
          ? String(event.metadata.ctaLabel)
          : event.event_type,
      icon: eventIcon(event.event_type),
    };

    if (existing) {
      existing.events.push(entry);
      if (subject && !existing.subject) existing.subject = subject;
    } else {
      groups.set(key, {
        resendEmailId: key,
        emailType: event.email_type,
        emailLabel: emailTypeLabel(event.email_type),
        recipient: event.recipient,
        subject,
        events: [entry],
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      events: [...group.events].sort(
        (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
      ),
    }))
    .sort((a, b) => {
      const aTime = a.events[0]?.occurredAt ?? "";
      const bTime = b.events[0]?.occurredAt ?? "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
}

export async function getProjectEmailEvents(projectId: string): Promise<EmailEventRecord[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("email_events")
    .select("*")
    .eq("project_id", projectId)
    .order("occurred_at", { ascending: false });

  if (error) {
    console.error("[email-analytics] failed to load events:", error.message);
    return [];
  }

  return (data ?? []) as EmailEventRecord[];
}
