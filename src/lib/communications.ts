import type { ActivityLog } from "@/lib/types";

/** Activity types logged from Resend webhooks — admin only. */
export const EMAIL_ANALYTICS_ACTIVITY_TYPES = new Set<string>([
  "email_sent",
  "email_delivered",
  "email_opened",
  "email_clicked",
  "email_bounced",
  "email_complained",
]);

/** In-app + business communication events for admin project activity. */
export const COMMUNICATION_ACTIVITY_TYPES = new Set<string>([
  "quote_sent",
  "quote_approved",
  "quote_changes_requested",
  "proposal_submitted",
  "shoot_proposed",
  "shoot_confirmed",
  "shoot_rescheduled",
  "shoot_declined",
  "shoot_withdrawn",
  "invoice_sent",
  "payment_requested",
  "payment_received",
  "payment_completed",
  "revision_requested",
  "revision_completed",
  "deliverables_approved",
  "sent_for_review",
]);

export function isEmailAnalyticsActivity(type: string): boolean {
  return EMAIL_ANALYTICS_ACTIVITY_TYPES.has(type);
}

export function filterClientVisibleActivities(activities: ActivityLog[]): ActivityLog[] {
  return activities.filter((activity) => !isEmailAnalyticsActivity(activity.activity_type));
}

export function filterCommunicationActivities(activities: ActivityLog[]): ActivityLog[] {
  return activities.filter((activity) => COMMUNICATION_ACTIVITY_TYPES.has(activity.activity_type));
}

export interface ProjectNotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  user_id: string;
  recipient_email?: string | null;
  recipient_name?: string | null;
}

export type CommunicationTimelineItem =
  | {
      kind: "email";
      id: string;
      sortAt: string;
      email: import("@/lib/email-analytics").EmailCommunicationSummary;
    }
  | {
      kind: "notification";
      id: string;
      sortAt: string;
      notification: ProjectNotificationRow;
    }
  | {
      kind: "activity";
      id: string;
      sortAt: string;
      activity: ActivityLog;
    };

export function buildCommunicationTimeline(
  emails: import("@/lib/email-analytics").EmailCommunicationSummary[],
  notifications: ProjectNotificationRow[],
  activities: ActivityLog[]
): CommunicationTimelineItem[] {
  const items: CommunicationTimelineItem[] = [
    ...emails.map((email) => ({
      kind: "email" as const,
      id: `email-${email.resendEmailId}`,
      sortAt: email.latestAt,
      email,
    })),
    ...notifications.map((notification) => ({
      kind: "notification" as const,
      id: `notification-${notification.id}`,
      sortAt: notification.created_at,
      notification,
    })),
    ...activities.map((activity) => ({
      kind: "activity" as const,
      id: `activity-${activity.id}`,
      sortAt: activity.created_at,
      activity,
    })),
  ];

  return items.sort(
    (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
  );
}

export function formatCommunicationDateTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
