import type { ActivityLog, NotificationType } from "@/lib/types";
import type { NotificationEventKey } from "@/lib/app-settings";

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

/** Activity types hidden from client-facing timelines. */
export const CLIENT_HIDDEN_ACTIVITY_TYPES = new Set<string>([
  "account_created",
  "project_created",
  "workflow_automation",
  "status_updated",
  "preliminary_estimate_created",
  "photos_uploaded",
  "videos_uploaded",
  "documents_uploaded",
  "media_uploaded",
  "asset_reviewed",
  "payment_requested",
]);

export function isEmailAnalyticsActivity(type: string): boolean {
  return EMAIL_ANALYTICS_ACTIVITY_TYPES.has(type);
}

export function filterClientVisibleActivities(activities: ActivityLog[]): ActivityLog[] {
  return activities.filter((activity) => {
    if (activity.visibility === "admin") return false;
    if (isEmailAnalyticsActivity(activity.activity_type)) return false;
    if (CLIENT_HIDDEN_ACTIVITY_TYPES.has(activity.activity_type)) return false;
    return true;
  });
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

/** Reusable notification payloads for consistent titles, bodies, and links. */
export interface NotificationEventPayload {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  projectId?: string;
  eventKey?: NotificationEventKey;
}

export function quoteSentEvent(projectId: string, projectName: string): NotificationEventPayload {
  return {
    type: "quote_sent",
    title: `Estimate ready — ${projectName}`,
    body: "Your official estimate is ready for review.",
    link: `/dashboard/projects/${projectId}#quote`,
    projectId,
    eventKey: "official_proposal_sent",
  };
}

export function quoteApprovedEvent(projectId: string, projectName: string): NotificationEventPayload {
  return {
    type: "proposal_approved",
    title: `Estimate approved — ${projectName}`,
    body: "The client approved the official estimate.",
    link: `/admin/projects/${projectId}#quote`,
    projectId,
    eventKey: "proposal_approved",
  };
}

export function paymentReceivedEvent(
  projectId: string,
  projectName: string,
  amountLabel: string
): NotificationEventPayload {
  return {
    type: "payment_received",
    title: `Payment received — ${projectName}`,
    body: `${amountLabel} payment confirmed.`,
    link: `/admin/projects/${projectId}#payments`,
    projectId,
    eventKey: "payment_received",
  };
}

export function paymentRequestedEvent(projectId: string, projectName: string): NotificationEventPayload {
  return {
    type: "invoice_available",
    title: `Invoice ready — ${projectName}`,
    body: "Your payment link is ready.",
    link: `/dashboard/projects/${projectId}#payments`,
    projectId,
    eventKey: "payment_link_sent",
  };
}

export function mediaUploadedEvent(projectId: string, projectName: string, mediaLabel: string): NotificationEventPayload {
  return {
    type: "deliverables_uploaded",
    title: `New media — ${projectName}`,
    body: `${mediaLabel} have been added to your project.`,
    link: `/dashboard/projects/${projectId}#photo-gallery`,
    projectId,
    eventKey: "deliverables_ready",
  };
}

export function shootConfirmedEvent(projectId: string, projectName: string, shootLabel: string): NotificationEventPayload {
  return {
    type: "shoot_proposed",
    title: `Shoot confirmed — ${projectName}`,
    body: shootLabel,
    link: `/dashboard/projects/${projectId}#scheduling`,
    projectId,
    eventKey: "shoot_time_confirmed",
  };
}
