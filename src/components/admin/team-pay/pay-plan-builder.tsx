"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Camera,
  ChevronDown,
  Clock,
  Gauge,
  Layers,
  Loader2,
  Percent,
  Receipt,
  Route,
  Timer,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { EXAMPLE_SHOOT, exampleLine } from "@/lib/team-pay/calc";
import {
  formatCents,
  formatMilesShort,
  formatMinutes,
  NEW_PLAN,
  type BaseType,
  type DriveType,
  type PayPlan,
} from "@/lib/team-pay/types";

type Draft = Omit<PayPlan, "id"> & { id: string | null };

const BASE_OPTIONS: { id: BaseType; title: string; hint: string; icon: LucideIcon }[] = [
  { id: "hourly", title: "By the hour", hint: "Time on site", icon: Clock },
  { id: "per_shoot", title: "Per shoot", hint: "Same amount every time", icon: Camera },
  { id: "per_service", title: "Per service", hint: "Each service has its pay", icon: Layers },
  { id: "percent", title: "A share", hint: "% of what the client pays", icon: Percent },
];

const DRIVE_OPTIONS: { id: DriveType; title: string; hint: string; icon: LucideIcon }[] = [
  { id: "none", title: "Not paid", hint: "Nothing for driving", icon: Ban },
  { id: "hour", title: "By the hour", hint: "Time behind the wheel", icon: Timer },
  { id: "mile", title: "By the mile", hint: "Miles driven", icon: Gauge },
  { id: "both", title: "Hours + miles", hint: "Time and mileage", icon: Route },
  { id: "travel_fee", title: "Travel fee", hint: "What the client is charged", icon: Receipt },
];

const DEFAULT_NAME: Record<BaseType, string> = {
  hourly: "Hourly",
  per_shoot: "Per shoot",
  per_service: "Per service",
  percent: "Share of the shoot",
};

function Tile({
  selected,
  onSelect,
  title,
  hint,
  icon: Icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-[76px] flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
        selected ? "border-accent bg-accent-subtle/60 ring-1 ring-accent" : "border-border bg-card hover:bg-subtle"
      )}
    >
      <Icon className={cn("h-5 w-5", selected ? "text-accent" : "text-muted")} aria-hidden />
      <span className="text-sm font-semibold leading-tight text-heading">{title}</span>
      <span className="text-xs leading-tight text-muted">{hint}</span>
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2.5 text-sm font-semibold text-heading">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A rate with its unit beside it: "$ 30.00 per hour". */
function RateRow({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-foreground">{label}</span>
      <span className="w-32">{children}</span>
      <span className="text-sm text-muted">{unit}</span>
    </label>
  );
}

export function PayPlanBuilder({
  plan,
  services,
  peopleOnPlan,
  onClose,
  onSaved,
  onDeleted,
}: {
  /** null = a new plan. */
  plan: PayPlan | null;
  services: { id: string; name: string }[];
  peopleOnPlan: number;
  onClose: () => void;
  onSaved: (plan: PayPlan) => void;
  onDeleted: (planId: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => (plan ? { ...plan } : { ...NEW_PLAN, id: null }));
  const [nameTouched, setNameTouched] = useState(Boolean(plan));
  const [showMore, setShowMore] = useState(Boolean(plan && (plan.minPerShootCents > 0 || !plan.payFirstDrive || !plan.payDriveHome)));
  const [mileText, setMileText] = useState(() => {
    const cents = plan?.mileCents ?? NEW_PLAN.mileCents;
    return Number.isInteger(cents) ? (cents / 100).toFixed(2) : (cents / 100).toString();
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const name = nameTouched ? draft.name : DEFAULT_NAME[draft.baseType];
  const paysDrive = draft.driveType === "hour" || draft.driveType === "mile" || draft.driveType === "both";

  // The example follows every change, so nobody has to work out how the options combine.
  const example = useMemo(() => {
    const exampleServices = services.slice(0, 2);
    return exampleLine({ ...draft, id: draft.id ?? "draft", name }, exampleServices.length ? exampleServices : [{ id: "example", name: "Photos" }]);
  }, [draft, name, services]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/team-pay/settings", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_plan", plan: { ...draft, name: name.trim() || DEFAULT_NAME[draft.baseType] } }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { plan?: PayPlan; error?: string } | undefined;
    setSaving(false);
    if (!res?.ok || !body?.plan) {
      setError(body?.error || "Couldn't save the pay plan. Try again.");
      return;
    }
    onSaved(body.plan);
  }

  async function remove() {
    if (!draft.id || saving) return;
    setSaving(true);
    const res = await fetch("/api/team-pay/settings", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_plan", planId: draft.id }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setError("Couldn't remove the pay plan. Try again.");
      return;
    }
    onDeleted(draft.id);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? "Edit pay plan" : "New pay plan"}
      className="sm:max-w-4xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {plan ? (
              confirmDelete ? (
                <span className="flex flex-wrap items-center gap-2 text-sm text-red-700 surface-dark:text-red-300">
                  {peopleOnPlan > 0
                    ? `${peopleOnPlan} ${peopleOnPlan === 1 ? "person comes" : "people come"} off this plan.`
                    : "Remove this plan?"}
                  <Button type="button" variant="destructive" size="sm" disabled={saving} onClick={() => void remove()}>
                    Remove
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <Button type="button" variant="ghost" className="min-h-11 text-red-600 sm:min-h-10" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Remove plan
                </Button>
              )
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="min-h-11 sm:min-h-10" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="accent" className="min-h-11 sm:min-h-10" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save plan
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 pb-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-7">
          <Step n={1} title="How do you pay for the shoot itself?">
            <div role="radiogroup" aria-label="Pay for the shoot" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BASE_OPTIONS.map((o) => (
                <Tile key={o.id} selected={draft.baseType === o.id} onSelect={() => set({ baseType: o.id })} title={o.title} hint={o.hint} icon={o.icon} />
              ))}
            </div>
            {draft.baseType === "hourly" ? (
              <RateRow label="On site" unit="per hour">
                <CurrencyInput aria-label="Hourly rate" valueCents={draft.baseRateCents} onChangeCents={(c) => set({ baseRateCents: c })} />
              </RateRow>
            ) : null}
            {draft.baseType === "per_shoot" ? (
              <RateRow label="Each shoot" unit="per shoot">
                <CurrencyInput aria-label="Pay per shoot" valueCents={draft.baseRateCents} onChangeCents={(c) => set({ baseRateCents: c })} />
              </RateRow>
            ) : null}
            {draft.baseType === "percent" ? (
              <RateRow label="Their share" unit="% of the shoot's price (travel fee not counted)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Percent of the shoot"
                  value={draft.percent}
                  onChange={(e) => set({ percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm surface-dark:bg-card"
                />
              </RateRow>
            ) : null}
            {draft.baseType === "per_service" ? (
              services.length ? (
                <div className="divide-y divide-border rounded-xl border border-border">
                  {services.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.name}</span>
                      <span className="w-32">
                        <CurrencyInput
                          aria-label={`Pay for ${s.name}`}
                          valueCents={draft.serviceRates[s.id] ?? 0}
                          onChangeCents={(c) => set({ serviceRates: { ...draft.serviceRates, [s.id]: c } })}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-subtle px-3 py-2.5 text-sm text-muted">Add your services in Settings → Services first, then set what each one pays here.</p>
              )
            ) : null}
          </Step>

          <Step n={2} title="How do you pay for driving?">
            <div role="radiogroup" aria-label="Pay for driving" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {DRIVE_OPTIONS.map((o) => (
                <Tile key={o.id} selected={draft.driveType === o.id} onSelect={() => set({ driveType: o.id })} title={o.title} hint={o.hint} icon={o.icon} />
              ))}
            </div>
            {draft.driveType === "hour" || draft.driveType === "both" ? (
              <RateRow label="Driving" unit="per hour">
                <CurrencyInput aria-label="Driving rate per hour" valueCents={draft.driveHourCents} onChangeCents={(c) => set({ driveHourCents: c })} />
              </RateRow>
            ) : null}
            {draft.driveType === "mile" || draft.driveType === "both" ? (
              <RateRow label="Mileage" unit="per mile">
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Rate per mile"
                    value={mileText}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, "");
                      setMileText(raw);
                      const dollars = parseFloat(raw);
                      set({ mileCents: Number.isFinite(dollars) ? Math.round(dollars * 10000) / 100 : 0 });
                    }}
                    className="h-11 w-full rounded-lg border border-border bg-white pl-7 pr-3 text-sm surface-dark:bg-card"
                  />
                </span>
              </RateRow>
            ) : null}
            {draft.driveType === "travel_fee" ? (
              <p className="rounded-xl bg-subtle px-3 py-2.5 text-sm text-muted">
                They get the travel fee on the client&apos;s estimate for each shoot.
              </p>
            ) : null}
          </Step>

          <div>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} aria-hidden />
              More options
            </button>
            {showMore ? (
              <div className="mt-3 space-y-4 rounded-xl border border-border p-4">
                <RateRow label="Minimum" unit="per shoot, at least">
                  <CurrencyInput aria-label="Minimum per shoot" valueCents={draft.minPerShootCents} onChangeCents={(c) => set({ minPerShootCents: c })} />
                </RateRow>
                {paysDrive ? (
                  <>
                    <label className="flex items-center gap-3">
                      <Switch checked={draft.payFirstDrive} onCheckedChange={(v) => set({ payFirstDrive: v })} aria-label="Pay the drive from home to the first shoot" />
                      <span className="text-sm text-foreground">Pay the drive from home to the first shoot</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <Switch checked={draft.payDriveHome} onCheckedChange={(v) => set({ payDriveHome: v })} aria-label="Pay the drive home after the last shoot" />
                      <span className="text-sm text-foreground">Pay the drive home after the last shoot</span>
                    </label>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted">Plan name</span>
            <input
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                set({ name: e.target.value });
              }}
              maxLength={80}
              placeholder="Photographer"
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm surface-dark:bg-card"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 surface-dark:bg-red-500/10 surface-dark:text-red-300">{error}</p>
          ) : null}
        </div>

        {/* Live example */}
        <aside className="h-fit rounded-2xl border border-border bg-subtle p-4 lg:sticky lg:top-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Example shoot</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted" aria-hidden /> {formatMinutes(EXAMPLE_SHOOT.onsiteMinutes)} on site
            </li>
            <li className="flex items-center gap-2">
              <Route className="h-4 w-4 text-muted" aria-hidden /> {formatMinutes(EXAMPLE_SHOOT.driveMinutes)} · {formatMilesShort(EXAMPLE_SHOOT.miles)} each way
            </li>
            <li className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted" aria-hidden /> Client pays {formatCents(EXAMPLE_SHOOT.priceCents)} + {formatCents(EXAMPLE_SHOOT.travelFeeCents)} travel
            </li>
          </ul>
          <div className="mt-4 space-y-1.5 border-t border-border pt-3">
            {example.parts.length ? (
              example.parts.map((part) => (
                <div key={part.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted">{part.label}</span>
                  <span className="shrink-0 tabular-nums text-foreground">{formatCents(part.cents)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Enter a rate to see what this shoot pays.</p>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-heading">They earn</span>
            <span className="text-2xl font-semibold tabular-nums text-heading">{formatCents(example.amountCents)}</span>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
