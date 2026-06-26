import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
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
      icon:
        event.event_type === "sent"
          ? "📨"
          : event.event_type === "delivered"
            ? "✅"
            : event.event_type === "opened"
              ? "👀"
              : event.event_type === "clicked"
                ? "🔗"
                : "⚠️",
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
