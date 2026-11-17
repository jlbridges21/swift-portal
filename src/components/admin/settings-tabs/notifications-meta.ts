/** Grouping, priority and presets for the Notifications tab. Pure data. */

import type { AppSettings, NotificationChannelSettings, NotificationEventKey } from "@/lib/app-settings";
import type { NotificationEventDef } from "@/components/admin/settings-tabs/shared";

export type NotificationChannel = keyof NotificationChannelSettings;
export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["inApp", "email", "push"];

export const NOTIFICATION_STAGES: { id: string; title: string; keys: NotificationEventKey[] }[] = [
  {
    id: "requests",
    title: "Requests & proposals",
    keys: [
      "new_project_request",
      "preliminary_estimate_created",
      "official_proposal_sent",
      "proposal_approved",
      "proposal_changes_requested",
    ],
  },
  {
    id: "scheduling",
    title: "Scheduling",
    keys: [
      "shoot_time_proposed",
      "shoot_time_confirmed",
      "shoot_time_declined",
      "shoot_scheduled",
      "shoot_rescheduled",
      "shoot_times_offered",
      "shoot_reminder",
      "shoot_completed",
    ],
  },
  {
    id: "delivery",
    title: "Delivery & review",
    keys: [
      "deliverables_ready",
      "revision_requested",
      "revision_completed",
      "video_review_client_comment",
      "video_review_business_reply",
      "video_review_reopened",
      "video_review_new_version",
      "video_review_feedback_resolved",
      "project_delivered",
    ],
  },
  { id: "payments", title: "Payments", keys: ["payment_link_sent", "payment_received", "payment_failed"] },
  { id: "other", title: "Messages & other", keys: ["project_message", "client_added_to_project"] },
];

/** Shown before "Show all". */
export const TOP_NOTIFICATION_EVENTS: NotificationEventKey[] = [
  "new_project_request",
  "preliminary_estimate_created",
  "official_proposal_sent",
  "proposal_approved",
  "proposal_changes_requested",
  "shoot_time_proposed",
  "shoot_time_confirmed",
  "shoot_rescheduled",
  "shoot_completed",
  "deliverables_ready",
  "revision_requested",
  "video_review_client_comment",
  "payment_link_sent",
  "payment_received",
  "payment_failed",
  "project_message",
];

/**
 * Essentials: these get every channel they support. Everything else stays in-app,
 * and keeps email when a client receives it (so client emails never silently stop).
 */
export const ESSENTIAL_NOTIFICATION_EVENTS: NotificationEventKey[] = [
  "new_project_request",
  "official_proposal_sent",
  "proposal_approved",
  "proposal_changes_requested",
  "shoot_time_confirmed",
  "deliverables_ready",
  "revision_requested",
  "payment_link_sent",
  "payment_received",
  "payment_failed",
];

export type NotificationPreset = "everything" | "essentials";

/** Push goes to the team only, so it exists for admin and shared events. */
export function channelAvailable(event: NotificationEventDef, channel: NotificationChannel): boolean {
  if (channel === "push") return event.audience === "admin" || event.audience === "both";
  return true;
}

export function presetValue(
  preset: NotificationPreset,
  event: NotificationEventDef,
  channel: NotificationChannel
): boolean {
  if (!channelAvailable(event, channel)) return false;
  if (preset === "everything") return true;
  if (ESSENTIAL_NOTIFICATION_EVENTS.includes(event.key)) return true;
  if (channel === "inApp") return true;
  if (channel === "email") return event.audience !== "admin";
  return false;
}

/** Which preset the current values match, or "custom". Channels an event doesn't have are ignored. */
export function matchingPreset(
  notifications: AppSettings["notifications"],
  events: NotificationEventDef[]
): NotificationPreset | "custom" {
  for (const preset of ["everything", "essentials"] as const) {
    const matches = events.every((event) =>
      NOTIFICATION_CHANNELS.every(
        (channel) =>
          !channelAvailable(event, channel) ||
          Boolean(notifications[event.key]?.[channel]) === presetValue(preset, event, channel)
      )
    );
    if (matches) return preset;
  }
  return "custom";
}

export const AUDIENCE_LABEL: Record<NotificationEventDef["audience"], string> = {
  admin: "You",
  client: "Client",
  both: "Both",
};
