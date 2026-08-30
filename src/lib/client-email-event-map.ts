/**
 * Explicit NotificationEventKey → email template mapping.
 * Never infer templates from notification title/body text.
 */

import type { NotificationEventKey } from "@/lib/app-settings";
import type { PremiumEmailTemplate } from "@/lib/email-templates";
import type { MessageTemplateKey } from "@/lib/workflow-settings";

export type ClientEmailEventMapping = {
  /** Editable workflow.messages key, or null for generic (no customizable template). */
  messageKey: MessageTemplateKey | null;
  /** Premium layout key used by buildPremiumEmailHtml. */
  premiumTemplate: PremiumEmailTemplate;
  /** Default subject when no custom template subject is set (after merge vars). */
  defaultSubjectHint: string;
};

/**
 * Maps every notification event to a client email layout + optional editable copy.
 * Admin-only events are listed for the audit table; they are not sent as client emails.
 */
export const CLIENT_EMAIL_EVENT_MAP: Record<NotificationEventKey, ClientEmailEventMapping> = {
  new_project_request: {
    messageKey: "new_request_confirmation",
    premiumTemplate: "general",
    defaultSubjectHint: "We received your project request",
  },
  preliminary_estimate_created: {
    messageKey: "preliminary_estimate_ready",
    premiumTemplate: "general",
    defaultSubjectHint: "You have a new project in {{portal_name}}",
  },
  official_proposal_sent: {
    messageKey: "proposal_ready",
    premiumTemplate: "proposal_ready",
    defaultSubjectHint: "Your {{business_name}} proposal is ready",
  },
  proposal_approved: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "(admin) Proposal approved",
  },
  proposal_changes_requested: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "(admin) Proposal changes requested",
  },
  shoot_time_proposed: {
    messageKey: "scheduling_request",
    premiumTemplate: "shoot_proposed",
    defaultSubjectHint: "Your shoot time is ready to review",
  },
  shoot_time_confirmed: {
    messageKey: "shoot_confirmed",
    premiumTemplate: "shoot_confirmed",
    defaultSubjectHint: "Your shoot is confirmed",
  },
  shoot_time_declined: {
    messageKey: "shoot_time_declined",
    premiumTemplate: "general",
    defaultSubjectHint: "Your shoot time was declined",
  },
  shoot_scheduled: {
    messageKey: "shoot_confirmed",
    premiumTemplate: "shoot_confirmed",
    defaultSubjectHint: "Your shoot is confirmed",
  },
  shoot_rescheduled: {
    messageKey: "scheduling_request",
    premiumTemplate: "shoot_proposed",
    defaultSubjectHint: "Your shoot time was updated",
  },
  shoot_completed: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "Shoot complete — we're editing your media",
  },
  deliverables_ready: {
    messageKey: "deliverables_ready",
    premiumTemplate: "deliverables_ready",
    defaultSubjectHint: "Your deliverables are ready to review",
  },
  revision_requested: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "(admin) Revision requested",
  },
  revision_completed: {
    messageKey: null,
    premiumTemplate: "revision_response",
    defaultSubjectHint: "Your revision is ready",
  },
  payment_link_sent: {
    messageKey: "payment_request",
    premiumTemplate: "payment_requested",
    defaultSubjectHint: "Your payment link is ready",
  },
  payment_received: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "(admin) Payment received",
  },
  payment_failed: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "(admin) Payment failed",
  },
  project_delivered: {
    messageKey: "project_completed",
    premiumTemplate: "project_complete",
    defaultSubjectHint: "Your project is complete",
  },
  project_message: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "New message on your project",
  },
  client_added_to_project: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "You've been added to a project",
  },
  video_review_client_comment: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "(admin) Client video review comment",
  },
  video_review_business_reply: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "Reply on your video review",
  },
  video_review_reopened: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "Video feedback reopened",
  },
  video_review_new_version: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "New video review version ready",
  },
  video_review_feedback_resolved: {
    messageKey: null,
    premiumTemplate: "general",
    defaultSubjectHint: "Video feedback marked resolved",
  },
};

/** Fallback when eventKey is missing or unknown — never deliverables_ready. */
export const NEUTRAL_CLIENT_EMAIL_FALLBACK: ClientEmailEventMapping = {
  messageKey: null,
  premiumTemplate: "general",
  defaultSubjectHint: "Update from your project portal",
};

export function resolveClientEmailMapping(
  eventKey: NotificationEventKey | null | undefined
): ClientEmailEventMapping {
  if (!eventKey) return NEUTRAL_CLIENT_EMAIL_FALLBACK;
  return CLIENT_EMAIL_EVENT_MAP[eventKey] ?? NEUTRAL_CLIENT_EMAIL_FALLBACK;
}
