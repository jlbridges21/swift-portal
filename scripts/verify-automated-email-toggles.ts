/**
 * Per-email on/off toggles in Settings → Automated Emails.
 * Run: npx tsx scripts/verify-automated-email-toggles.ts
 */
import {
  MESSAGE_TEMPLATE_DEFINITIONS,
  buildDefaultWorkflowSettings,
  isMessageTemplateEnabled,
  mergeWorkflowSettings,
  shouldSendClientPaymentReceipt,
  type WorkflowSettings,
} from "../src/lib/workflow-settings";
import { CLIENT_EMAIL_EVENT_MAP, isClientEmailEventEnabled } from "../src/lib/client-email-event-map";

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log("OK:", msg);
}

type StoredWorkflow = Parameters<typeof mergeWorkflowSettings>[0];

// Default on — new businesses, existing businesses with nothing saved, and legacy shapes.
const defaults = buildDefaultWorkflowSettings();
assert(MESSAGE_TEMPLATE_DEFINITIONS.every((d) => defaults.messages[d.key].enabled === true), "every default email is on");
const unsaved = mergeWorkflowSettings(undefined);
assert(MESSAGE_TEMPLATE_DEFINITIONS.every((d) => unsaved.messages[d.key].enabled), "no saved workflow → all on");
const preToggle = mergeWorkflowSettings({
  messages: {
    payment_received: { subject: "Thanks!", body: "Got it {{client_name}}" },
    project_completed: "Legacy body-only template",
  },
} as StoredWorkflow);
assert(MESSAGE_TEMPLATE_DEFINITIONS.every((d) => preToggle.messages[d.key].enabled), "templates saved before toggles existed → all on");
assert(preToggle.messages.payment_received.subject === "Thanks!", "custom subject kept");

// Sanitizing — only an explicit false turns an email off.
const sanitize = (enabled: unknown) =>
  mergeWorkflowSettings({
    messages: { payment_received: { subject: "S", body: "B", enabled } },
  } as StoredWorkflow).messages.payment_received.enabled;
assert(sanitize(false) === false, "explicit false → off");
for (const value of [true, undefined, null, "false", 0, "", "off", {}]) {
  assert(sanitize(value) === true, `${JSON.stringify(value) ?? "undefined"} → on`);
}

// Turning off keeps the wording, so turning back on restores it.
const off = mergeWorkflowSettings({
  messages: { project_completed: { subject: "Done!", body: "All wrapped, {{client_name}}.", enabled: false } },
} as StoredWorkflow);
assert(!off.messages.project_completed.enabled, "project completed saved off");
assert(off.messages.project_completed.body === "All wrapped, {{client_name}}.", "wording kept while off");
const backOn = mergeWorkflowSettings({ messages: { ...off.messages, project_completed: { ...off.messages.project_completed, enabled: true } } });
assert(backOn.messages.project_completed.enabled && backOn.messages.project_completed.subject === "Done!", "turning back on restores wording");
assert(MESSAGE_TEMPLATE_DEFINITIONS.filter((d) => d.key !== "project_completed").every((d) => off.messages[d.key].enabled), "other emails stay on");

// Send-time skip logic.
function withOff(...keys: (keyof WorkflowSettings["messages"])[]): WorkflowSettings {
  const w = buildDefaultWorkflowSettings();
  for (const k of keys) w.messages[k] = { ...w.messages[k], enabled: false };
  return w;
}
assert(isMessageTemplateEnabled(defaults, "payment_received"), "helper: default on");
assert(isMessageTemplateEnabled(defaults, null), "helper: event with no template is never blocked");
assert(isMessageTemplateEnabled(undefined, "payment_received"), "helper: missing settings → on");
assert(!isMessageTemplateEnabled(withOff("payment_received"), "payment_received"), "helper: off → skipped");

const projectOff = withOff("project_completed");
assert(!isClientEmailEventEnabled(projectOff, "project_delivered"), "project delivered email skipped when Project completed is off");
assert(isClientEmailEventEnabled(projectOff, "deliverables_ready"), "other events still send");
assert(isClientEmailEventEnabled(projectOff, null), "unknown event still sends");

// Every template that a client event uses can be turned off at send time.
for (const def of MESSAGE_TEMPLATE_DEFINITIONS) {
  const events = Object.entries(CLIENT_EMAIL_EVENT_MAP).filter(([, m]) => m.messageKey === def.key);
  for (const [eventKey] of events) {
    const w = withOff(def.key);
    assert(!isClientEmailEventEnabled(w, eventKey as keyof typeof CLIENT_EMAIL_EVENT_MAP), `${eventKey} skipped when "${def.label}" is off`);
    assert(isClientEmailEventEnabled(defaults, eventKey as keyof typeof CLIENT_EMAIL_EVENT_MAP), `${eventKey} sends by default`);
  }
}

// Payment received → client receipt.
assert(shouldSendClientPaymentReceipt(defaults), "client receipt sends by default");
assert(!shouldSendClientPaymentReceipt(withOff("payment_received")), "client receipt skipped when Payment received is off");
const receiptsOff = buildDefaultWorkflowSettings();
receiptsOff.payments.autoSendReceipt = false;
assert(!shouldSendClientPaymentReceipt(receiptsOff), "client receipt still respects auto-send receipt setting");

console.log(`\nAll ${passed} checks passed.`);
