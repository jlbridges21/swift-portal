"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  AlarmClock,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  CreditCard,
  FileSignature,
  ImagePlay,
  SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AppSettings } from "@/lib/app-settings";
import {
  COMMON_TIME_ZONES,
  FALLBACK_TIMEZONE,
  timeZoneDisplayName,
  timeZoneFromAddress,
} from "@/lib/business-timezone";
import {
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
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
  label: string;
  className?: string;
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
        "relative flex h-5 w-9 shrink-0 rounded-full transition-colors",
        className,
        checked ? "bg-accent" : "bg-slate-200 surface-dark:bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white surface-dark:bg-card shadow transition-transform",
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
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-subtle"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-heading">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>
      <CompactToggle id={id} checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

function NumberRow({
  id,
  label,
  hint,
  suffix,
  value,
  min,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  suffix: string;
  value: number;
  min: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-sm font-medium text-heading">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </label>
      <span className="flex items-center gap-2 text-sm text-muted">
        <Input id={id} type="number" min={min} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-20 text-center" />
        {suffix}
      </span>
    </div>
  );
}

type CategoryId = "payments" | "proposals" | "scheduling" | "deliverables" | "reminders" | "advanced";

type Chip = { label: string; on: boolean };

const REMINDER_KEYS = [
  ["proposal", "Proposal reminder"],
  ["scheduling", "Scheduling reminder"],
  ["review", "Review reminder"],
  ["payment", "Payment reminder"],
] as const;

const STAGE_CHANNELS = [
  ["inApp", "In-app notification", "In-app notification"],
  ["email", "Email notification", "Email notification"],
  ["push", "Push (admin)", "Push (admin)"],
  ["logActivity", "Project activity log", "Activity log"],
  ["autoAdvance", "Auto-advance when conditions met", "Auto-advance"],
  ["requireManualApproval", "Require manual approval before leaving stage", "Manual approval required"],
] as const;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatUsd(cents: number) {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

/** Summary chips computed from the live (unsaved included) workflow values. */
function categoryChips(id: CategoryId, w: AppSettings["workflow"]): Chip[] {
  switch (id) {
    case "payments": {
      const p = w.payments;
      const deposit =
        p.depositMode === "percent"
          ? `${p.depositPercent}% deposit`
          : p.depositMode === "amount"
            ? `${formatUsd(p.depositAmountCents)} deposit`
            : "Full total on approval";
      return [
        { label: p.autoSendReceipt ? "Receipts on" : "Receipts off", on: p.autoSendReceipt },
        {
          label: p.autoUnlockDownloads ? "Downloads unlock after payment" : "Manual download unlock",
          on: p.autoUnlockDownloads,
        },
        { label: deposit, on: true },
      ];
    }
    case "proposals": {
      const p = w.proposals;
      return [
        { label: p.autoArchivePreviousVersions ? "Archives old versions" : "Keeps old versions", on: p.autoArchivePreviousVersions },
        { label: p.autoSetExpiration ? "Auto expiration" : "No auto expiration", on: p.autoSetExpiration },
      ];
    }
    case "scheduling": {
      const s = w.scheduling;
      const on = [s.notifyClientOnPropose, s.notifyAdminOnCounter, s.notifyClientOnReschedule, s.logSchedulingChanges].filter(Boolean).length;
      return [
        { label: s.notifyClientOnPropose ? "Clients told of new times" : "Clients not told of new times", on: s.notifyClientOnPropose },
        { label: `${on} of 4 on`, on: on > 0 },
      ];
    }
    case "deliverables": {
      const d = w.deliverables;
      return [
        { label: d.autoRequestApproval ? "Client approval on" : "Client approval off", on: d.autoRequestApproval },
        {
          label: d.reviewReminderDays > 0 ? `Reminder after ${plural(d.reviewReminderDays, "day")}` : "No review reminder",
          on: d.reviewReminderDays > 0,
        },
      ];
    }
    case "reminders": {
      const active = REMINDER_KEYS.filter(([key]) => w.reminders[key] !== "off").length;
      return [{ label: active === 0 ? "All off" : `${active} active`, on: active > 0 }];
    }
    case "advanced": {
      const auto = WORKFLOW_STAGE_DEFINITIONS.filter((st) => w.stages[st.key]?.autoAdvance).length;
      return [
        { label: plural(WORKFLOW_STAGE_DEFINITIONS.length, "stage"), on: true },
        { label: `${auto} auto-advance`, on: auto > 0 },
      ];
    }
  }
}

const CATEGORIES: { id: CategoryId; title: string; description: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "payments", title: "Payments", description: "Invoices, deposits, receipts", icon: CreditCard },
  { id: "proposals", title: "Proposals", description: "Versions and expiration", icon: FileSignature },
  { id: "scheduling", title: "Scheduling", description: "Shoot times and reschedules", icon: CalendarClock },
  { id: "deliverables", title: "Deliverables", description: "Review, approval and reminders", icon: ImagePlay },
  { id: "reminders", title: "Reminders", description: "Automatic follow-up emails", icon: AlarmClock },
  { id: "advanced", title: "Advanced", description: "Stage controls and business defaults", icon: SlidersHorizontal },
];

function ChipList({ chips }: { chips: Chip[] }) {
  return (
    <span className="mt-2.5 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-1 text-xs font-semibold",
            c.on ? "text-foreground" : "text-muted"
          )}
        >
          {c.on ? <Check className="h-3 w-3 text-emerald-600 surface-dark:text-emerald-400" strokeWidth={3} aria-hidden /> : null}
          {c.label}
        </span>
      ))}
    </span>
  );
}

function RowList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">{children}</div>;
}

interface WorkflowSettingsCardProps {
  workflow: AppSettings["workflow"];
  onChange: (workflow: AppSettings["workflow"]) => void;
  /** Business address, so "Automatic" can name the zone it resolves to. */
  business?: Pick<AppSettings["business"], "city" | "state" | "country">;
}

export function WorkflowSettingsCard({ workflow, onChange, business }: WorkflowSettingsCardProps) {
  const addressZone = business ? timeZoneFromAddress(business) : null;
  const autoZone = addressZone ?? (workflow.businessDefaults.timezoneMode === "auto" ? workflow.businessDefaults.timezone : null);
  const timeZoneOptions = [
    {
      value: "auto",
      label: `Automatic – ${timeZoneDisplayName(addressZone ?? autoZone ?? FALLBACK_TIMEZONE)}`,
    },
    ...COMMON_TIME_ZONES,
    ...(workflow.businessDefaults.timezoneMode === "manual" &&
    !COMMON_TIME_ZONES.some((z) => z.value === workflow.businessDefaults.timezone)
      ? [{ value: workflow.businessDefaults.timezone, label: timeZoneDisplayName(workflow.businessDefaults.timezone) }]
      : []),
  ];
  const [open, setOpen] = useState<CategoryId | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastOpened = useRef<CategoryId | null>(null);

  // Deep link: #settings-workflow-payments (etc.) opens that category.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "").split("#").pop() ?? "";
    const match = CATEGORIES.find((c) => hash === `settings-workflow-${c.id}`);
    if (match) setOpen(match.id);
  }, []);

  useEffect(() => {
    if (open) {
      lastOpened.current = open;
      panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      panelRef.current?.focus({ preventScroll: true });
    } else if (lastOpened.current) {
      document.getElementById(`workflow-cat-${lastOpened.current}`)?.focus({ preventScroll: true });
    }
  }, [open]);

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

  function renderControls(id: CategoryId) {
    switch (id) {
      case "payments":
        return (
          <>
            <RowList>
              <RowToggle id="pay-link" label="Move to Awaiting Payment when an invoice is created" checked={workflow.payments.autoMoveOnPaymentLink} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoMoveOnPaymentLink: v } })} />
              <RowToggle id="pay-on-approval" label="Create the invoice automatically when the client approves the proposal" checked={workflow.payments.autoCreatePaymentLinkOnApproval} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoCreatePaymentLinkOnApproval: v } })} />
              <RowToggle id="pay-stripe" label="Move to Delivered after successful Stripe payment" checked={workflow.payments.autoMoveOnStripePaid} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoMoveOnStripePaid: v } })} />
              <RowToggle id="pay-unlock" label="Unlock downloads after payment" checked={workflow.payments.autoUnlockDownloads} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoUnlockDownloads: v } })} />
              <RowToggle id="pay-receipt" label="Email the client a receipt after payment" checked={workflow.payments.autoSendReceipt} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, autoSendReceipt: v } })} />
              <RowToggle id="pay-fail" label="Notify admin when payment fails" checked={workflow.payments.notifyAdminOnFailure} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, notifyAdminOnFailure: v } })} />
              <RowToggle id="pay-in-full" label="Let the client pay the full total instead of the deposit" checked={workflow.payments.allowClientPayInFull} onChange={(v) => onChange({ ...workflow, payments: { ...workflow.payments, allowClientPayInFull: v } })} />
            </RowList>
            <fieldset className="mt-4 space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-heading">Deposit collected on approval</legend>
              <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="deposit-mode"
                  className="size-4 shrink-0 accent-accent"
                  checked={workflow.payments.depositMode === "none"}
                  onChange={() => onChange({ ...workflow, payments: { ...workflow.payments, depositMode: "none" } })}
                />
                Full project total
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="deposit-mode"
                  className="size-4 shrink-0 accent-accent"
                  checked={workflow.payments.depositMode === "percent"}
                  onChange={() => onChange({ ...workflow, payments: { ...workflow.payments, depositMode: "percent" } })}
                />
                Percent of the quote
              </label>
              {workflow.payments.depositMode === "percent" && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="deposit-percent">Deposit percent (1–99)</Label>
                  <Input
                    id="deposit-percent"
                    type="number"
                    min={1}
                    max={99}
                    className="max-w-[10rem]"
                    value={workflow.payments.depositPercent}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!e.target.value || !Number.isFinite(n)) return;
                      if (n < 1 || n > 99) return;
                      onChange({
                        ...workflow,
                        payments: { ...workflow.payments, depositPercent: Math.round(n) },
                      });
                    }}
                  />
                </div>
              )}
              <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="deposit-mode"
                  className="size-4 shrink-0 accent-accent"
                  checked={workflow.payments.depositMode === "amount"}
                  onChange={() => onChange({ ...workflow, payments: { ...workflow.payments, depositMode: "amount" } })}
                />
                Fixed amount
              </label>
              {workflow.payments.depositMode === "amount" && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="deposit-amount">Deposit amount (USD)</Label>
                  <Input
                    id="deposit-amount"
                    type="number"
                    min={0.01}
                    step={0.01}
                    className="max-w-[10rem]"
                    value={workflow.payments.depositAmountCents / 100}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n) || n < 0) return;
                      onChange({
                        ...workflow,
                        payments: { ...workflow.payments, depositAmountCents: Math.round(n * 100) },
                      });
                    }}
                  />
                </div>
              )}
            </fieldset>
          </>
        );
      case "proposals":
        return (
          <RowList>
            <RowToggle id="prop-archive" label="Archive previous official proposal versions when sending a new one" checked={workflow.proposals.autoArchivePreviousVersions} onChange={(v) => onChange({ ...workflow, proposals: { ...workflow.proposals, autoArchivePreviousVersions: v } })} />
            <RowToggle id="prop-expire" label="Automatically set proposal expiration dates" checked={workflow.proposals.autoSetExpiration} onChange={(v) => onChange({ ...workflow, proposals: { ...workflow.proposals, autoSetExpiration: v } })} />
          </RowList>
        );
      case "scheduling":
        return (
          <RowList>
            <RowToggle id="sched-propose" label="Notify client when shoot time is proposed" checked={workflow.scheduling.notifyClientOnPropose} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, notifyClientOnPropose: v } })} />
            <RowToggle id="sched-counter" label="Notify admin when client counters a date" checked={workflow.scheduling.notifyAdminOnCounter} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, notifyAdminOnCounter: v } })} />
            <RowToggle id="sched-resched" label="Notify client after reschedule" checked={workflow.scheduling.notifyClientOnReschedule} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, notifyClientOnReschedule: v } })} />
            <RowToggle id="sched-log" label="Log scheduling changes to project activity" checked={workflow.scheduling.logSchedulingChanges} onChange={(v) => onChange({ ...workflow, scheduling: { ...workflow.scheduling, logSchedulingChanges: v } })} />
          </RowList>
        );
      case "deliverables":
        return (
          <RowList>
            <RowToggle id="del-notify" label="Notify client when deliverables are ready" checked={workflow.deliverables.notifyClientWhenReady} onChange={(v) => onChange({ ...workflow, deliverables: { ...workflow.deliverables, notifyClientWhenReady: v } })} />
            <RowToggle id="del-auto-review" label="Move to Review Deliverables on upload" hint="You can still send for review by hand." checked={workflow.deliverables.autoMoveToReview} onChange={(v) => onChange({ ...workflow, deliverables: { ...workflow.deliverables, autoMoveToReview: v } })} />
            <RowToggle id="del-approval" label="Request client approval per deliverable" checked={workflow.deliverables.autoRequestApproval} onChange={(v) => onChange({ ...workflow, deliverables: { ...workflow.deliverables, autoRequestApproval: v } })} />
            <NumberRow
              id="reviewReminderDays"
              label="Review reminder after"
              hint="0 turns it off."
              suffix="days"
              min={0}
              value={workflow.deliverables.reviewReminderDays}
              onChange={(raw) =>
                onChange({
                  ...workflow,
                  deliverables: { ...workflow.deliverables, reviewReminderDays: Number(raw) || 0 },
                })
              }
            />
          </RowList>
        );
      case "reminders":
        return (
          <RowList>
            {REMINDER_KEYS.map(([key, label]) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <label htmlFor={`reminder-${key}`} className="text-sm font-medium text-heading">
                  {label}
                </label>
                <div className="w-36">
                  <Select
                    id={`reminder-${key}`}
                    value={workflow.reminders[key]}
                    onChange={(e) => patchReminder(key, e.target.value as ReminderTiming)}
                    options={REMINDER_TIMING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>
              </div>
            ))}
          </RowList>
        );
      case "advanced":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              {WORKFLOW_STAGE_DEFINITIONS.map((stage) => (
                <div key={stage.key} className="overflow-hidden rounded-xl border border-border">
                  <div className="border-b border-border bg-subtle px-4 py-3">
                    <p className="text-sm font-semibold text-heading">{stage.label}</p>
                    <p className="mt-0.5 text-[13px] text-muted">{stage.description}</p>
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted">
                          <th className="px-4 py-2 text-left">Channel / behavior</th>
                          <th className="w-16 py-2 text-center">On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {STAGE_CHANNELS.map(([key, label]) => (
                          <tr key={`${stage.key}-${key}`} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-2 text-foreground">{label}</td>
                            <td className="py-2 text-center">
                              <CompactToggle
                                className="mx-auto"
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
                    {STAGE_CHANNELS.map(([key, , mobileLabel]) => (
                      <RowToggle
                        key={`${stage.key}-m-${key}`}
                        id={`${stage.key}-m-${key}`}
                        label={mobileLabel}
                        checked={workflow.stages[stage.key][key]}
                        onChange={(v) => patchStage(stage.key, { [key]: v })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-heading">Business defaults</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wf-turnaround">Default turnaround (days)</Label>
                  <Input id="wf-turnaround" type="number" min={1} value={workflow.businessDefaults.defaultTurnaroundDays} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, defaultTurnaroundDays: Number(e.target.value) || 1 } })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wf-payment-due">Default payment due (days)</Label>
                  <Input id="wf-payment-due" type="number" min={1} value={workflow.businessDefaults.defaultPaymentDueDays} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, defaultPaymentDueDays: Number(e.target.value) || 1 } })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wf-sched-window">Default scheduling window (days)</Label>
                  <Input id="wf-sched-window" type="number" min={1} value={workflow.businessDefaults.defaultSchedulingWindowDays} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, defaultSchedulingWindowDays: Number(e.target.value) || 1 } })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wf-timezone">Time zone</Label>
                  <Select
                    id="wf-timezone"
                    value={workflow.businessDefaults.timezoneMode === "manual" ? workflow.businessDefaults.timezone : "auto"}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange({
                        ...workflow,
                        businessDefaults:
                          v === "auto"
                            ? { ...workflow.businessDefaults, timezoneMode: "auto", timezone: addressZone ?? workflow.businessDefaults.timezone }
                            : { ...workflow.businessDefaults, timezoneMode: "manual", timezone: v },
                      });
                    }}
                    options={timeZoneOptions}
                  />
                  <p className="text-xs text-muted">
                    Booking times, reminders and calendar events use this zone.{" "}
                    {addressZone
                      ? "Automatic follows your business address."
                      : "Automatic follows your business address once it has a state or province."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wf-hours-start">Business hours start</Label>
                  <Input id="wf-hours-start" type="time" value={workflow.businessDefaults.businessHoursStart} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, businessHoursStart: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wf-hours-end">Business hours end</Label>
                  <Input id="wf-hours-end" type="time" value={workflow.businessDefaults.businessHoursEnd} onChange={(e) => onChange({ ...workflow, businessDefaults: { ...workflow.businessDefaults, businessHoursEnd: e.target.value } })} />
                </div>
              </div>
            </div>
          </div>
        );
    }
  }

  const current = open ? CATEGORIES.find((c) => c.id === open) ?? null : null;

  if (current) {
    const Icon = current.icon;
    return (
      <div
        ref={panelRef}
        tabIndex={-1}
        id={`settings-workflow-${current.id}`}
        className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 outline-none sm:p-6"
      >
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-subtle"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All workflow settings
        </button>
        <div className="mt-2 flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-heading">{current.title}</h3>
            <p className="text-[13px] text-muted">{current.description}</p>
          </div>
        </div>
        <div className="mt-5">{renderControls(current.id)}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        return (
          <button
            key={cat.id}
            id={`workflow-cat-${cat.id}`}
            type="button"
            onClick={() => setOpen(cat.id)}
            className="group flex w-full items-start gap-3.5 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-accent/40 hover:bg-subtle/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-heading">{cat.title}</span>
              <span className="mt-0.5 block text-[13px] text-muted">{cat.description}</span>
              <ChipList chips={categoryChips(cat.id, workflow)} />
            </span>
            <ChevronRight className="mt-2 h-4 w-4 shrink-0 self-center text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
