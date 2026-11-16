/**
 * Display metadata for the Automated Emails tab and the "Send me a test" route.
 * Pure data — safe for client and server.
 */

import {
  MESSAGE_TEMPLATE_DEFINITIONS,
  type MessageTemplateKey,
} from "@/lib/workflow-settings";
import {
  WORKFLOW_VARIABLE_FALLBACKS,
  type WorkflowMessageVariables,
} from "@/lib/workflow-template-render";

export type AutomatedEmailDefinition = (typeof MESSAGE_TEMPLATE_DEFINITIONS)[number];

/** Placeholder values for previews and test sends. Never real client data. */
export const AUTOMATED_EMAIL_SAMPLE_VARS: WorkflowMessageVariables = {
  ...WORKFLOW_VARIABLE_FALLBACKS,
  client_name: "Alex Rivera",
  project_name: "123 Main St — Drone Photos",
  property_address: "123 Main St, Springfield",
  portal_link: "https://portal.example.com/dashboard/projects/sample",
  portal_name: "Acme Portal",
  payment_amount: "$450.00",
  shoot_date: "March 15, 2026 at 10:00 AM",
  business_name: "Acme Media",
};

const STAGES: { id: string; title: string; keys: MessageTemplateKey[] }[] = [
  {
    id: "requests",
    title: "Requests & proposals",
    keys: ["new_request_confirmation", "preliminary_estimate_ready", "proposal_ready"],
  },
  {
    id: "scheduling",
    title: "Scheduling",
    keys: ["scheduling_request", "shoot_confirmed", "shoot_time_declined"],
  },
  {
    id: "delivery",
    title: "Delivery & payment",
    keys: ["deliverables_ready", "payment_request", "payment_received", "project_completed"],
  },
];

/** Templates grouped by stage, in the order clients receive them. Unknown keys land in "Other". */
export function groupAutomatedEmails(): { id: string; title: string; templates: AutomatedEmailDefinition[] }[] {
  const byKey = new Map(MESSAGE_TEMPLATE_DEFINITIONS.map((t) => [t.key, t] as const));
  const used = new Set<MessageTemplateKey>();
  const groups = STAGES.map((stage) => {
    const templates = stage.keys
      .map((key) => byKey.get(key))
      .filter((t): t is AutomatedEmailDefinition => Boolean(t));
    templates.forEach((t) => used.add(t.key));
    return { id: stage.id, title: stage.title, templates };
  });
  const rest = MESSAGE_TEMPLATE_DEFINITIONS.filter((t) => !used.has(t.key));
  if (rest.length > 0) groups.push({ id: "other", title: "Other", templates: rest });
  return groups.filter((g) => g.templates.length > 0);
}

/** One plain line saying when each email goes out. */
const WHEN_SENT: Partial<Record<MessageTemplateKey, string>> = {
  new_request_confirmation: "Sent right after a client submits a project request.",
  preliminary_estimate_ready: "Sent when an automatic preliminary estimate is created.",
  proposal_ready: "Sent when you send (or re-send) an official proposal.",
  scheduling_request: "Sent when you propose or reschedule a shoot time.",
  shoot_confirmed: "Sent when a shoot date is confirmed or scheduled.",
  shoot_time_declined: "Sent when you decline a client's suggested time or withdraw yours.",
  deliverables_ready: "Sent when media or a tour is ready for the client to review.",
  payment_request: "Sent when an invoice is created for the client.",
  payment_received: "Sent to the client after a successful payment.",
  project_completed: "Sent when the project is marked delivered.",
};

export function automatedEmailWhenSent(tpl: AutomatedEmailDefinition): string {
  return WHEN_SENT[tpl.key] ?? tpl.description;
}

/** Button label shown in the email (preview and test send). */
const CTA_LABELS: Partial<Record<MessageTemplateKey, string>> = {
  new_request_confirmation: "Open portal",
  preliminary_estimate_ready: "View estimate",
  proposal_ready: "Review proposal",
  scheduling_request: "Review schedule",
  shoot_confirmed: "View schedule",
  shoot_time_declined: "Open portal",
  deliverables_ready: "Review deliverables",
  payment_request: "Pay now",
  payment_received: "Download deliverables",
  project_completed: "Open portal",
};

export function automatedEmailCtaLabel(key: MessageTemplateKey): string {
  return CTA_LABELS[key] ?? "Open portal";
}

/** Variables valid for a template, parsed from its placeholder list. */
export function automatedEmailVariables(tpl: AutomatedEmailDefinition): (keyof WorkflowMessageVariables)[] {
  const out: (keyof WorkflowMessageVariables)[] = [];
  for (const match of tpl.placeholders.matchAll(/\{\{(\w+)\}\}/g)) {
    const name = match[1] as keyof WorkflowMessageVariables;
    if (name in WORKFLOW_VARIABLE_FALLBACKS && !out.includes(name)) out.push(name);
  }
  return out;
}

export const AUTOMATED_EMAIL_SUBJECT_MAX = 300;
export const AUTOMATED_EMAIL_BODY_MAX = 5000;
