import type { ProjectStatus } from "@/lib/constants";
import { getStatusOrder, normalizeStatus } from "@/lib/constants";

/** Workflow stage keys aligned with project status values */
export type WorkflowStageKey =
  | "new_request"
  | "quote_sent"
  | "proposal_approved"
  | "scheduled"
  | "shoot_complete_editing"
  | "ready_for_review"
  | "awaiting_payment"
  | "delivered";

export const WORKFLOW_STAGE_DEFINITIONS: {
  key: WorkflowStageKey;
  label: string;
  description: string;
}[] = [
  { key: "new_request", label: "New Request", description: "When a client submits a new project request." },
  { key: "quote_sent", label: "Quote Ready", description: "Official proposal sent — client reviews and approves." },
  { key: "proposal_approved", label: "Awaiting Scheduling", description: "Proposal approved — schedule the shoot." },
  { key: "scheduled", label: "Scheduled", description: "Shoot date confirmed on the calendar." },
  { key: "shoot_complete_editing", label: "Shoot Complete", description: "Field work done — media in production." },
  { key: "ready_for_review", label: "Review Deliverables", description: "Deliverables ready for client review." },
  { key: "awaiting_payment", label: "Approved – Awaiting Payment", description: "Client approved deliverables — final payment." },
  { key: "delivered", label: "Delivered", description: "Project complete — downloads unlocked." },
];

export interface StageAutomationSettings {
  inApp: boolean;
  email: boolean;
  push: boolean;
  logActivity: boolean;
  autoAdvance: boolean;
  requireManualApproval: boolean;
}

export interface PaymentAutomationSettings {
  autoMoveOnPaymentLink: boolean;
  autoMoveOnStripePaid: boolean;
  autoUnlockDownloads: boolean;
  autoSendReceipt: boolean;
  notifyAdminOnFailure: boolean;
}

export interface ProposalAutomationSettings {
  autoArchivePreviousVersions: boolean;
  autoSetExpiration: boolean;
}

export interface SchedulingAutomationSettings {
  notifyClientOnPropose: boolean;
  notifyAdminOnCounter: boolean;
  syncGoogleCalendar: boolean;
  notifyClientOnReschedule: boolean;
  logSchedulingChanges: boolean;
}

export interface DeliverableAutomationSettings {
  notifyClientWhenReady: boolean;
  autoMoveToReview: boolean;
  autoRequestApproval: boolean;
  reviewReminderDays: number;
}

export type ReminderTiming = "off" | "24h" | "3d" | "7d";

export const REMINDER_TIMING_OPTIONS: { value: ReminderTiming; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "24h", label: "24 hours" },
  { value: "3d", label: "3 days" },
  { value: "7d", label: "7 days" },
];

export interface ReminderSettings {
  proposal: ReminderTiming;
  scheduling: ReminderTiming;
  review: ReminderTiming;
  payment: ReminderTiming;
}

export type MessageTemplateKey =
  | "new_request_confirmation"
  | "proposal_ready"
  | "scheduling_request"
  | "shoot_confirmed"
  | "deliverables_ready"
  | "payment_request"
  | "payment_received"
  | "project_completed";

export const MESSAGE_TEMPLATE_DEFINITIONS: {
  key: MessageTemplateKey;
  label: string;
  placeholders: string;
}[] = [
  { key: "new_request_confirmation", label: "New request confirmation", placeholders: "{{client_name}}, {{property_address}}, {{portal_link}}" },
  { key: "proposal_ready", label: "Proposal ready", placeholders: "{{client_name}}, {{project_name}}, {{portal_link}}" },
  { key: "scheduling_request", label: "Scheduling request", placeholders: "{{client_name}}, {{shoot_date}}, {{portal_link}}" },
  { key: "shoot_confirmed", label: "Shoot confirmed", placeholders: "{{client_name}}, {{shoot_date}}, {{property_address}}" },
  { key: "deliverables_ready", label: "Deliverables ready", placeholders: "{{client_name}}, {{project_name}}, {{portal_link}}" },
  { key: "payment_request", label: "Payment request", placeholders: "{{client_name}}, {{payment_amount}}, {{portal_link}}" },
  { key: "payment_received", label: "Payment received", placeholders: "{{client_name}}, {{payment_amount}}, {{portal_link}}" },
  { key: "project_completed", label: "Project completed", placeholders: "{{client_name}}, {{project_name}}, {{portal_link}}" },
];

export interface BusinessDefaultsSettings {
  defaultTurnaroundDays: number;
  defaultPaymentDueDays: number;
  defaultSchedulingWindowDays: number;
  timezone: string;
  businessHoursStart: string;
  businessHoursEnd: string;
}

export interface WorkflowSettings {
  stages: Record<WorkflowStageKey, StageAutomationSettings>;
  payments: PaymentAutomationSettings;
  proposals: ProposalAutomationSettings;
  scheduling: SchedulingAutomationSettings;
  deliverables: DeliverableAutomationSettings;
  reminders: ReminderSettings;
  messages: Record<MessageTemplateKey, string>;
  businessDefaults: BusinessDefaultsSettings;
}

function defaultStage(overrides?: Partial<StageAutomationSettings>): StageAutomationSettings {
  return {
    inApp: true,
    email: true,
    push: true,
    logActivity: true,
    autoAdvance: true,
    requireManualApproval: false,
    ...overrides,
  };
}

export function buildDefaultWorkflowSettings(): WorkflowSettings {
  const stages = Object.fromEntries(
    WORKFLOW_STAGE_DEFINITIONS.map((s) => [s.key, defaultStage()])
  ) as Record<WorkflowStageKey, StageAutomationSettings>;

  stages.shoot_complete_editing = defaultStage({
    requireManualApproval: true,
    autoAdvance: false,
  });
  stages.delivered = defaultStage({ autoAdvance: false });

  return {
    stages,
    payments: {
      autoMoveOnPaymentLink: true,
      autoMoveOnStripePaid: true,
      autoUnlockDownloads: true,
      autoSendReceipt: true,
      notifyAdminOnFailure: true,
    },
    proposals: {
      autoArchivePreviousVersions: true,
      autoSetExpiration: true,
    },
    scheduling: {
      notifyClientOnPropose: true,
      notifyAdminOnCounter: true,
      syncGoogleCalendar: true,
      notifyClientOnReschedule: true,
      logSchedulingChanges: true,
    },
    deliverables: {
      notifyClientWhenReady: true,
      autoMoveToReview: false,
      autoRequestApproval: true,
      reviewReminderDays: 3,
    },
    reminders: {
      proposal: "3d",
      scheduling: "3d",
      review: "3d",
      payment: "7d",
    },
    messages: {
      new_request_confirmation:
        "Hi {{client_name}}, we received your request for {{property_address}}. We'll review the details and follow up shortly. View your portal: {{portal_link}}",
      proposal_ready:
        "Hi {{client_name}}, your official proposal for {{project_name}} is ready to review. {{portal_link}}",
      scheduling_request:
        "Hi {{client_name}}, please review the proposed shoot time on {{shoot_date}}. {{portal_link}}",
      shoot_confirmed:
        "Hi {{client_name}}, your shoot at {{property_address}} is confirmed for {{shoot_date}}.",
      deliverables_ready:
        "Hi {{client_name}}, your deliverables for {{project_name}} are ready for review. {{portal_link}}",
      payment_request:
        "Hi {{client_name}}, your final payment of {{payment_amount}} is ready. Complete payment here: {{portal_link}}",
      payment_received:
        "Thank you, {{client_name}}! We received your payment of {{payment_amount}}. Your downloads are now unlocked. {{portal_link}}",
      project_completed:
        "Hi {{client_name}}, {{project_name}} is complete. Thank you for choosing Swift Aerial Media! {{portal_link}}",
    },
    businessDefaults: {
      defaultTurnaroundDays: 5,
      defaultPaymentDueDays: 14,
      defaultSchedulingWindowDays: 30,
      timezone: "America/New_York",
      businessHoursStart: "08:00",
      businessHoursEnd: "18:00",
    },
  };
}

export function mergeWorkflowSettings(stored: Partial<WorkflowSettings> | undefined): WorkflowSettings {
  const defaults = buildDefaultWorkflowSettings();
  if (!stored) return defaults;

  const stages = { ...defaults.stages };
  if (stored.stages) {
    for (const def of WORKFLOW_STAGE_DEFINITIONS) {
      stages[def.key] = { ...defaults.stages[def.key], ...(stored.stages[def.key] ?? {}) };
    }
  }

  const messages = { ...defaults.messages };
  if (stored.messages) {
    for (const def of MESSAGE_TEMPLATE_DEFINITIONS) {
      if (stored.messages[def.key]) messages[def.key] = stored.messages[def.key];
    }
  }

  return {
    stages,
    payments: { ...defaults.payments, ...(stored.payments ?? {}) },
    proposals: { ...defaults.proposals, ...(stored.proposals ?? {}) },
    scheduling: { ...defaults.scheduling, ...(stored.scheduling ?? {}) },
    deliverables: { ...defaults.deliverables, ...(stored.deliverables ?? {}) },
    reminders: { ...defaults.reminders, ...(stored.reminders ?? {}) },
    messages,
    businessDefaults: { ...defaults.businessDefaults, ...(stored.businessDefaults ?? {}) },
  };
}

export function statusToWorkflowStage(status: string): WorkflowStageKey {
  return normalizeStatus(status) as WorkflowStageKey;
}

export function reminderTimingToMs(timing: ReminderTiming): number | null {
  switch (timing) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "3d":
      return 3 * 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function canAutoTransitionTo(
  _targetStatus: ProjectStatus | string,
  _workflow: WorkflowSettings,
  manualOverride = false
): boolean {
  return manualOverride || true;
}

export function canAutoTransitionFrom(
  sourceStatus: ProjectStatus | string,
  workflow: WorkflowSettings,
  manualOverride = false
): boolean {
  if (manualOverride) return true;
  const key = statusToWorkflowStage(sourceStatus);
  const stage = workflow.stages[key];
  if (stage?.requireManualApproval) return false;
  return stage?.autoAdvance !== false;
}

export function canAutoTransition(
  fromStatus: ProjectStatus | string,
  toStatus: ProjectStatus | string,
  workflow: WorkflowSettings,
  manualOverride = false
): boolean {
  if (manualOverride) return true;
  if (getStatusOrder(toStatus) < getStatusOrder(fromStatus)) return false;
  return canAutoTransitionFrom(fromStatus, workflow, manualOverride);
}
