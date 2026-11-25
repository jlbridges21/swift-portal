"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, HandCoins, Loader2, Pencil, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, Notice, PersonAvatar } from "@/components/admin/booking/booking-ui";
import { SectionHeading } from "@/components/admin/settings-tabs/shared";
import { cn } from "@/lib/utils";
import { formatPeriod, periodContaining, shiftPeriod } from "@/lib/team-pay/periods";
import {
  DEFAULT_TEAM_PAY_SETTINGS,
  describePlan,
  PERIOD_TYPE_LABEL,
  type PayMember,
  type PayPlan,
  type PeriodType,
  type TeamPaySettings as Settings,
  type WorkerType,
} from "@/lib/team-pay/types";
import { MoneyField } from "./money-field";
import { PayPlanBuilder } from "./pay-plan-builder";

type TeamRow = { userId: string; name: string; email: string; avatarUrl: string | null; role: "owner" | "admin" | "staff" };
type Data = {
  ready: boolean;
  settings: Settings;
  plans: PayPlan[];
  members: PayMember[];
  team: TeamRow[];
  services: { id: string; name: string }[];
};

const PERIOD_HINT: Record<PeriodType, string> = {
  weekly: "52 pay days a year",
  biweekly: "26 pay days a year",
  semimonthly: "1st–15th, 16th–end",
  monthly: "Once a month",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function localTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function post(body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
  const res = await fetch("/api/team-pay/settings", {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = (await res?.json().catch(() => ({}))) as Record<string, unknown> | undefined;
  if (!res?.ok) throw new Error((json?.error as string) || "Couldn't save. Try again.");
  return json ?? {};
}

/** A numbered card: the page reads top to bottom as "1, 2, 3 and you're set". */
function StepCard({
  n,
  title,
  done,
  children,
  action,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-3 text-base font-semibold text-heading">
          <span
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              done ? "bg-emerald-100 text-emerald-700 surface-dark:bg-emerald-500/20 surface-dark:text-emerald-300" : "bg-accent text-accent-foreground"
            )}
          >
            {done ? <Check className="h-4 w-4" aria-label="Done" /> : n}
          </span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-border bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 rounded-md px-3 text-sm font-medium transition-colors",
            value === o.value ? "bg-card text-heading shadow-sm" : "text-muted hover:text-heading"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** `active`: the section is on screen. Nothing loads until it's opened. */
export function TeamPaySettings({ active = true }: { active?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ plan: PayPlan | null } | null>(null);

  const load = useCallback(() => {
    fetch("/api/team-pay/settings", { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as Data & { error?: string };
        if (!res.ok) throw new Error(json.error || "Couldn't load Team pay.");
        setData({ ...json, settings: { ...DEFAULT_TEAM_PAY_SETTINGS, ...json.settings } });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load Team pay."));
  }, []);
  const [opened, setOpened] = useState(active);
  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);
  useEffect(() => {
    if (opened) load();
  }, [opened, load]);

  const settings = data?.settings ?? DEFAULT_TEAM_PAY_SETTINGS;
  const plans = useMemo(() => (data?.plans ?? []).filter((p) => !p.archived), [data]);
  const members = useMemo(() => new Map((data?.members ?? []).map((m) => [m.userId, m])), [data]);
  const team = data?.team ?? [];
  const hasTeam = team.some((m) => m.role !== "owner");
  const onPlan = team.filter((m) => {
    const planId = members.get(m.userId)?.planId;
    return planId && plans.some((p) => p.id === planId);
  }).length;

  /** Saves a settings change at once; the screen never has a Save button to forget. */
  async function update(patch: Partial<Settings>) {
    if (!data) return;
    const before = data;
    setData({ ...data, settings: { ...data.settings, ...patch } });
    try {
      await post(patch, "PATCH");
      // The sidebar shows or hides Team pay with the switch.
      if ("enabled" in patch) router.refresh();
    } catch (err) {
      setData(before);
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    }
  }

  async function updateMember(userId: string, patch: Partial<PayMember>) {
    if (!data) return;
    const before = data;
    const current = members.get(userId) ?? { userId, planId: null, workerType: "contractor" as WorkerType, rateOverride: null };
    const next = { ...current, ...patch };
    // A different plan has a different kind of rate: the custom rate doesn't carry over.
    if ("planId" in patch && patch.planId !== current.planId) next.rateOverride = null;
    setData({ ...data, members: [...data.members.filter((m) => m.userId !== userId), next] });
    try {
      await post({ action: "save_member", member: next });
      if ("planId" in patch) router.refresh();
    } catch (err) {
      setData(before);
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    }
  }

  const today = localTodayKey();
  const currentPeriod = periodContaining(today, settings.periodType, settings.periodAnchor);
  const nextPeriod = shiftPeriod(currentPeriod, settings.periodType, settings.periodAnchor, 1);
  const anchorWeekday = new Date(`${settings.periodAnchor}T12:00:00Z`).getUTCDay();

  return (
    <div id="settings-team-pay" tabIndex={-1} className="scroll-mt-24 space-y-4 outline-none">
      <div>
        <SectionHeading id="team_pay">Team pay</SectionHeading>
        <p className="mt-1 text-sm text-muted">Keep track of what you owe each team member for the shoots they do.</p>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !data ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Team pay…
        </p>
      ) : !data.ready ? (
        <Notice tone="warn">Team pay needs database migration v140. Apply it, then come back here to turn it on.</Notice>
      ) : (
        <>
          {/* On / off: everything else appears only once it's on. */}
          <section
            className={cn(
              "flex items-center gap-4 rounded-2xl border p-4 shadow-sm sm:p-5",
              settings.enabled ? "border-accent bg-accent-subtle/50" : "border-border bg-card"
            )}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <HandCoins className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-heading">{settings.enabled ? "Team pay is on" : "Turn on Team pay"}</p>
              <p className="text-sm text-muted">
                {settings.enabled
                  ? "Team pay is in your sidebar. Your team sees My pay."
                  : "ShootPortal adds up each person's shoots, hours and miles for you."}
              </p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => void update({ enabled: v })} aria-label="Team pay" />
          </section>

          {settings.enabled && !hasTeam ? (
            <section className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-5 sm:flex-row sm:items-center">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-subtle text-muted">
                <UserPlus className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-heading">Add a team member first</p>
                <p className="text-sm text-muted">Team pay shows up in your sidebar once someone besides you is on the team.</p>
              </div>
              <Link href="/admin/settings#settings-staff" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-heading hover:bg-subtle">
                Staff &amp; Permissions <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </section>
          ) : null}

          {settings.enabled ? (
            <>
              <StepCard
                n={1}
                title="How you pay"
                done={plans.length > 0}
                action={
                  plans.length ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setBuilder({ plan: null })}>
                      <Plus className="h-4 w-4" /> New plan
                    </Button>
                  ) : null
                }
              >
                {plans.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {plans.map((plan) => {
                      const people = team.filter((m) => members.get(m.userId)?.planId === plan.id);
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setBuilder({ plan })}
                          className="group rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent hover:bg-subtle"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-heading">{plan.name}</span>
                            <Pencil className="h-4 w-4 shrink-0 text-muted group-hover:text-accent" aria-label="Edit" />
                          </span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {describePlan(plan)
                              .split(" · ")
                              .map((bit) => (
                                <span key={bit} className="rounded-full bg-accent-subtle px-2.5 py-1 text-xs font-medium text-accent">
                                  {bit}
                                </span>
                              ))}
                            {plan.minPerShootCents > 0 ? (
                              <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-medium text-muted">
                                ${(plan.minPerShootCents / 100).toFixed(0)} minimum
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-3 flex items-center gap-2 text-xs text-muted">
                            {people.length ? (
                              <>
                                <span className="flex -space-x-2">
                                  {people.slice(0, 4).map((m) => (
                                    <PersonAvatar key={m.userId} name={m.name} url={m.avatarUrl} size={24} className="ring-2 ring-card" />
                                  ))}
                                </span>
                                {people.length === 1 ? people[0].name : `${people.length} people`}
                              </>
                            ) : (
                              "Nobody on this plan yet"
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBuilder({ plan: null })}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 text-center transition-colors hover:border-accent hover:bg-subtle"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Plus className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-heading">Create your first pay plan</span>
                    <span className="text-sm text-muted">Hourly, per shoot, per service or a share. Two questions.</span>
                  </button>
                )}
              </StepCard>

              <StepCard n={2} title="Who's on which plan" done={onPlan > 0}>
                {!plans.length ? (
                  <p className="text-sm text-muted">Create a pay plan above, then choose who it&apos;s for.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {team.map((m) => {
                      const pay = members.get(m.userId);
                      const plan = plans.find((p) => p.id === pay?.planId) ?? null;
                      const canOverride = plan && plan.baseType !== "per_service";
                      return (
                        <li key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                          <PersonAvatar name={m.name} url={m.avatarUrl} size={36} />
                          <span className="min-w-[8rem] flex-1">
                            <span className="block truncate text-sm font-semibold text-heading">{m.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {plan ? describePlan(plan, pay?.rateOverride ?? null) : m.role === "owner" ? "Owner · not paid through Team pay" : "Not on a pay plan"}
                            </span>
                          </span>
                          <NativeSelect
                            ariaLabel={`Pay plan for ${m.name}`}
                            className="w-44"
                            value={plan?.id ?? ""}
                            onChange={(v) => void updateMember(m.userId, { planId: v || null })}
                            options={[{ value: "", label: "No pay plan" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]}
                          />
                          {plan ? (
                            <>
                              <Segmented<WorkerType>
                                ariaLabel={`${m.name} is a`}
                                value={pay?.workerType ?? "contractor"}
                                onChange={(v) => void updateMember(m.userId, { workerType: v })}
                                options={[
                                  { value: "contractor", label: "Contractor" },
                                  { value: "employee", label: "Employee" },
                                ]}
                              />
                              {canOverride ? (
                                <label className="flex items-center gap-2 text-xs text-muted">
                                  Their rate
                                  {plan.baseType === "percent" ? (
                                    <span className="relative w-24">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        aria-label={`Custom percent for ${m.name}`}
                                        placeholder={String(plan.percent)}
                                        defaultValue={pay?.rateOverride != null ? pay.rateOverride / 100 : ""}
                                        onBlur={(e) => {
                                          const v = e.target.value.trim();
                                          const next = v === "" ? null : Math.round(Math.min(100, Math.max(0, Number(v) || 0)) * 100);
                                          if (next !== (pay?.rateOverride ?? null)) void updateMember(m.userId, { rateOverride: next });
                                        }}
                                        className="h-11 w-full rounded-lg border border-border bg-white px-3 pr-7 text-sm text-foreground surface-dark:bg-card"
                                      />
                                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
                                    </span>
                                  ) : (
                                    <MoneyField
                                      className="w-28"
                                      ariaLabel={`Custom rate for ${m.name}`}
                                      placeholder={(plan.baseRateCents / 100).toFixed(2)}
                                      valueCents={pay?.rateOverride ?? null}
                                      onCommit={(c) => void updateMember(m.userId, { rateOverride: c && c > 0 ? c : null })}
                                    />
                                  )}
                                </label>
                              ) : null}
                            </>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </StepCard>

              <StepCard n={3} title="When you pay" done>
                <div role="radiogroup" aria-label="Pay period" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(PERIOD_TYPE_LABEL) as PeriodType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={settings.periodType === type}
                      onClick={() => void update({ periodType: type })}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        settings.periodType === type ? "border-accent bg-accent-subtle/60 ring-1 ring-accent" : "border-border bg-card hover:bg-subtle"
                      )}
                    >
                      <span className="block text-sm font-semibold text-heading">{PERIOD_TYPE_LABEL[type]}</span>
                      <span className="block text-xs text-muted">{PERIOD_HINT[type]}</span>
                    </button>
                  ))}
                </div>
                {settings.periodType === "weekly" ? (
                  <label className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground">
                    Each week starts on
                    <NativeSelect
                      ariaLabel="Week starts on"
                      className="w-40"
                      value={String(anchorWeekday)}
                      onChange={(v) => {
                        // Any date on that weekday works as the anchor.
                        const base = new Date("2026-01-04T12:00:00Z");
                        base.setUTCDate(base.getUTCDate() + Number(v));
                        void update({ periodAnchor: base.toISOString().slice(0, 10) });
                      }}
                      options={WEEKDAYS.map((label, i) => ({ value: String(i), label }))}
                    />
                  </label>
                ) : null}
                {settings.periodType === "biweekly" ? (
                  <label className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground">
                    A pay period starts on
                    <input
                      type="date"
                      aria-label="A pay period starts on"
                      value={settings.periodAnchor}
                      onChange={(e) => e.target.value && void update({ periodAnchor: e.target.value })}
                      className="h-11 rounded-lg border border-border bg-white px-3 text-sm surface-dark:bg-card"
                    />
                  </label>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-subtle px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-heading">
                    <CalendarDays className="h-4 w-4 text-accent" aria-hidden />
                    <span className="text-muted">Now</span> <span className="font-medium">{formatPeriod(currentPeriod)}</span>
                  </span>
                  <span className="text-heading">
                    <span className="text-muted">Next</span> <span className="font-medium">{formatPeriod(nextPeriod)}</span>
                  </span>
                </div>
              </StepCard>

              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                <h3 className="mb-4 text-base font-semibold text-heading">Extras</h3>
                <div className="divide-y divide-border">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-4">
                    <Switch checked={settings.lateCancelEnabled} onCheckedChange={(v) => void update({ lateCancelEnabled: v })} aria-label="Pay for late cancellations" />
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-sm font-medium text-heading">Pay for late cancellations</p>
                      <p className="text-xs text-muted">When a shoot is cancelled at the last minute, the photographer still gets a set amount.</p>
                    </div>
                    {settings.lateCancelEnabled ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                        <MoneyField
                          className="w-28"
                          ariaLabel="Late cancellation pay"
                          valueCents={settings.lateCancelFeeCents || null}
                          onCommit={(c) => void update({ lateCancelFeeCents: c ?? 0 })}
                        />
                        when cancelled within
                        <NativeSelect
                          ariaLabel="Late cancellation window"
                          className="w-32"
                          value={String(settings.lateCancelHours)}
                          onChange={(v) => void update({ lateCancelHours: Number(v) })}
                          options={[2, 4, 12, 24, 48, 72].map((h) => ({ value: String(h), label: h === 24 ? "24 hours" : `${h} hours` }))}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4 py-4">
                    <Switch checked={settings.allowTimeRequests} onCheckedChange={(v) => void update({ allowTimeRequests: v })} aria-label="Let your team ask for time changes" />
                    <div>
                      <p className="text-sm font-medium text-heading">Let your team ask for time changes</p>
                      <p className="text-xs text-muted">If a shoot ran long, they send you their real time. You approve or decline.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-4">
                    <Switch checked={settings.allowCheckIn} onCheckedChange={(v) => void update({ allowCheckIn: v })} aria-label="Check in from their phone" />
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-sm font-medium text-heading">Check in from their phone</p>
                      <p className="text-xs text-muted">They tap Arrived and Done at the shoot. Without it, pay uses the time you booked.</p>
                    </div>
                    {settings.allowCheckIn ? (
                      <label className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                        Ask me when it&apos;s over by
                        <NativeSelect
                          ariaLabel="Review check-ins over booked time by"
                          className="w-32"
                          value={String(settings.reviewOverMinutes)}
                          onChange={(v) => void update({ reviewOverMinutes: Number(v) })}
                          options={[0, 15, 30, 45, 60, 90].map((m) => ({ value: String(m), label: m === 0 ? "Any time" : `${m} min` }))}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              </section>

              {plans.length > 0 && onPlan > 0 && hasTeam ? (
                <Link
                  href="/admin/team-pay"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900 surface-dark:border-emerald-500/30 surface-dark:bg-emerald-500/10 surface-dark:text-emerald-200"
                >
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <Check className="h-5 w-5" aria-hidden /> You&apos;re set. See what you owe this pay period.
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    Open Team pay <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </Link>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {builder && data ? (
        <PayPlanBuilder
          plan={builder.plan}
          services={data.services}
          peopleOnPlan={builder.plan ? data.members.filter((m) => m.planId === builder.plan!.id).length : 0}
          onClose={() => setBuilder(null)}
          onSaved={(plan) => {
            setData((d) => (d ? { ...d, plans: [...d.plans.filter((p) => p.id !== plan.id), plan] } : d));
            setBuilder(null);
            toast.success("Pay plan saved.");
          }}
          onDeleted={(planId) => {
            setData((d) =>
              d
                ? {
                    ...d,
                    plans: d.plans.filter((p) => p.id !== planId),
                    members: d.members.map((m) => (m.planId === planId ? { ...m, planId: null } : m)),
                  }
                : d
            );
            setBuilder(null);
            router.refresh();
            toast.success("Pay plan removed.");
          }}
        />
      ) : null}
    </div>
  );
}
