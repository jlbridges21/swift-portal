"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SettingsCollapsible } from "@/components/admin/settings-collapsible";
import type { AppSettings } from "@/lib/app-settings";
import {
  MESSAGE_TEMPLATE_DEFINITIONS,
  REMINDER_TIMING_OPTIONS,
  WORKFLOW_STAGE_DEFINITIONS,
  type ReminderTiming,
  type StageAutomationSettings,
  type WorkflowStageKey,
} from "@/lib/workflow-settings";

function CompactToggle({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative mx-auto flex h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}

function RowToggle({
  checked,
  onChange,
  id,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg px-4 py-3 hover:bg-slate-50">
      <span className="min-w-0">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <CompactToggle id={id} checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

interface WorkflowSettingsCardProps {
  workflow: AppSettings["workflow"];
  onChange: (workflow: AppSettings["workflow"]) => void;
}

export function WorkflowSettingsCard({ workflow, onChange }: WorkflowSettingsCardProps) {
  function patchStage(key: WorkflowStageKey, patch: Partial<StageAutomationSettings>) {
    onChange({
      ...workflow,
      stages: {
        ...workflow.stages,
        [key]: { ...workflow.stages[key], ...patch },
      },
    });
  }

  function patchReminder(key: keyof AppSettings["workflow"]["reminders"], value: ReminderTiming) {
    onChange({
      ...workflow,
      reminders: { ...workflow.reminders, [key]: value },
    });
  }

  return (
    <div className="space-y-4">
      <SettingsCollapsible title="Payments" description="Payment links, delivery unlock, and receipts.">
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          <RowToggle id="pay-link" label="Move to Awaiting Payment when payment link is created" checked={workflow.payments.autoMoveOnPaymentLink} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoMoveOnPaymentLink: v } })} />
          <RowToggle id="pay-stripe" label="Move to Delivered after successful Stripe payment" checked={workflow.payments.autoMoveOnStripePaid} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoMoveOnStripePaid: v } })} />
          <RowToggle id="pay-unlock" label="Unlock downloads after payment" checked={workflow.payments.autoUnlockDownloads} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoUnlockDownloads: v } })} />
          <RowToggle id="pay-receipt" label="Send receipt / completion email after payment" checked={workflow.payments.autoSendReceipt} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoSendReceipt: v } })} />
          <RowToggle id="pay-fail" label="Notify admin when payment fails" checked={workflow.payments.notifyAdminOnFailure} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, notifyAdminOnFailure: v } })} />
        </div>
      </SettingsCollapsible>

      <SettingsCollapsible title="Proposals" description="Official proposal versions and expiration behavior.">
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          <RowToggle id="prop-archive" label="Archive previous official proposal versions when sending a new one" checked={workflow.proposals.autoArchivePreviousVersions} onChange={(v) => onChange({ ...workflow, proposals: { ...workflow.proposals, autoArchivePreviousVersions: v } })} />
          <RowToggle id="prop-expire" label="Automatically set proposal expiration dates" checked={workflow.proposals.autoSetExpiration} onChange={(v) => onChange({ ...workflow, proposals: { ...workflow.proposals, autoSetExpiration: v } })} />
        </div>
      </SettingsCollapsible>

      <SettingsCollapsible title="Scheduling" description="Shoot proposals, reschedules, and Google Calendar sync.">
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          <RowToggle id="sched-propose" label="Notify client when shoot time is proposed" checked={workflow.scheduling.notifyClientOnPropose} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, notifyClientOnPropose: v } })} />
          <RowToggle id="sched-counter" label="Notify admin when client counters a date" checked={workflow.scheduling.notifyAdminOnCounter} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, notifyAdminOnCounter: v } })} />
          <RowToggle id="sched-gcal" label="Sync Google Calendar after scheduling changes" checked={workflow.scheduling.syncGoogleCalendar} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, syncGoogleCalendar: v } })} />
          <RowToggle id="sched-resched" label="Notify client after reschedule" checked={workflow.scheduling.notifyClientOnReschedule} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, notifyClientOnReschedule: v } })} />
          <RowToggle id="sched-log" label="Log scheduling changes to project activity" checked={workflow.scheduling.logSchedulingChanges} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, logSchedulingChanges: v } })} />
        </div>
      </SettingsCollapsible>

      <SettingsCollapsible title="Deliverables" description="Review flow, client approval, and review reminders.">
        <div className="space-y-4">
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            <RowToggle id="del-notify" label="Notify client when deliverables are ready" checked={workflow.deliverables.notifyClientWhenReady} onChange={(v) => onChange({ ...workflow, deliverables: { ...workflow.deliverables, notifyClientWhenReady: v } })} />
            <RowToggle id="del-auto-review" label="Automatically move to Review Deliverables on upload (admin can still send manually)" checked={workflow.deliverables.autoMoveToReview} onChange={(v) => onChange({ ...workflow, deliverables: { ...workflow.deliverables, autoMoveToReview: v } })} />
            <RowToggle id="del-approval" label="Request client approval per deliverable" checked={workflow.deliverables.autoRequestApproval} onChange={(v) => onChange({ ...workflow, deliverables: { ...workflow.deliverables, autoRequestApproval: v } })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reviewReminderDays">Review reminder after (days, 0 = off)</Label>
            <Input
              id="reviewReminderDays"
              type="number"
              min={0}
              value={workflow.deliverables.reviewReminderDays}
              onChange={(e) =>
                onChange({
                  ...workflow,
                  deliverables: { ...workflow.deliverables, reviewReminderDays: Number(e.target.value) || 0 },
                })
              }
            />
          </div>
        </div>
      </SettingsCollapsible>

      <SettingsCollapsible title="Reminders" description="Timing for automated follow-ups (requires CRON_SECRET job).">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["proposal", "Proposal reminder"],
              ["scheduling", "Scheduling reminder"],
              ["review", "Review reminder"],
              ["payment", "Payment reminder"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Select
                value={workflow.reminders[key]}
                onChange={(e) => patchReminder(key, e.target.value as ReminderTiming)}
                options={REMINDER_TIMING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
          ))}
        </div>
      </SettingsCollapsible>

      <SettingsCollapsible title="Advanced" description="Stage-by-stage controls, message templates, and business defaults.">
        <div className="space-y-6">
          <div className="space-y-4">
            {WORKFLOW_STAGE_DEFINITIONS.map((stage) => (
              <div key={stage.key} className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-slate-50/80 px-4 py-3">
                  <p className="font-medium text-primary">{stage.label}</p>
                  <p className="text-xs text-muted mt-0.5">{stage.description}</p>
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <th className="px-4 py-2 text-left">Channel / behavior</th>
                        <th className="w-16 py-2 text-center">On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["inApp", "In-app notification"],
                          ["email", "Email notification"],
                          ["push", "Push (admin)"],
                          ["logActivity", "Project activity log"],
                          ["autoAdvance", "Auto-advance when conditions met"],
                          ["requireManualApproval", "Require manual approval before leaving stage"],
                        ] as const
                      ).map(([key, label]) => (
                        <tr key={`${stage.key}-${key}`} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-2 text-muted">{label}</td>
                          <td className="py-2 text-center">
                            <CompactToggle
                              id={`${stage.key}-${key}`}
                              label={`${stage.label} ${label}`}
                              checked={workflow.stages[stage.key][key]}
                              onChange={(v) => patchStage(stage.key, { [key]: v })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-border md:hidden">
                  {(
                    [
                      ["inApp", "In-app notification"],
                      ["email", "Email notification"],
                      ["push", "Push (admin)"],
                      ["logActivity", "Activity log"],
                      ["autoAdvance", "Auto-advance"],
                      ["requireManualApproval", "Manual approval required"],
                    ] as const
                  ).map(([key, label]) => (
                    <RowToggle
                      key={`${stage.key}-m-${key}`}
                      id={`${stage.key}-m-${key}`}
                      label={label}
                      checked={workflow.stages[stage.key][key]}
                      onChange={(v) => patchStage(stage.key, { [key]: v })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-primary">Default Messages</p>
            <p className="text-xs text-muted">
              Placeholders: {"{{client_name}}"}, {"{{property_address}}"}, {"{{project_name}}"}, {"{{shoot_date}}"}, {"{{payment_amount}}"}, {"{{portal_link}}"}
            </p>
            {MESSAGE_TEMPLATE_DEFINITIONS.map((tpl) => (
              <div key={tpl.key} className="space-y-2">
                <Label htmlFor={`msg-${tpl.key}`}>{tpl.label}</Label>
                <Textarea
                  id={`msg-${tpl.key}`}
                  rows={3}
                  value={workflow.messages[tpl.key]}
                  onChange={(e) =>
                    onChange({
                      ...workflow,
                      messages: { ...workflow.messages, [tpl.key]: e.target.value },
                    })
                  }
                />
                <p className="text-[11px] text-muted">{tpl.placeholders}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Business Defaults</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default turnaround (days)</Label>
                <Input type="number" min={1} value={workflow.businessDefaults.defaultTurnaroundDays} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, defaultTurnaroundDays: Number(e.target.value) || 1 } })} />
              </div>
              <div className="space-y-2">
                <Label>Default payment due (days)</Label>
                <Input type="number" min={1} value={workflow.businessDefaults.defaultPaymentDueDays} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, defaultPaymentDueDays: Number(e.target.value) || 1 } })} />
              </div>
              <div className="space-y-2">
                <Label>Default scheduling window (days)</Label>
                <Input type="number" min={1} value={workflow.businessDefaults.defaultSchedulingWindowDays} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, defaultSchedulingWindowDays: Number(e.target.value) || 1 } })} />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={workflow.businessDefaults.timezone} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, timezone: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Business hours start</Label>
                <Input type="time" value={workflow.businessDefaults.businessHoursStart} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, businessHoursStart: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Business hours end</Label>
                <Input type="time" value={workflow.businessDefaults.businessHoursEnd} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, businessHoursEnd: e.target.value } })} />
              </div>
            </div>
          </div>
        </div>
      </SettingsCollapsible>
    </div>
  );
}
