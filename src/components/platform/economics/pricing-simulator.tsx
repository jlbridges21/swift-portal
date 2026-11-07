"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Copy, Info, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CostAssumptions } from "@/lib/economics/assumptions";
import { formatGb, formatPct, formatUsd } from "@/lib/economics/assumptions";
import {
  ILLUSTRATIVE,
  computeScenario,
  growthSweep,
  parseScenario,
  presetScenarios,
  stressTests,
  uid,
  utilizationSweep,
  type ScenarioResult,
  type SimBaseline,
  type SimScenario,
  type SimTier,
} from "@/lib/economics/simulator";
import type { SavedScenario } from "@/lib/platform-economics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SweepChart } from "@/components/platform/economics/sweep-chart";
import { SourceTag, marginTone } from "@/components/platform/economics/ui";
import { cn } from "@/lib/utils";

export type ActualSnapshot = {
  customers: number;
  mrr: number;
  storageGb: number;
  downloadGb: number;
  storageCost: number;
  bandwidthCost: number;
  stripeFees: number;
  fixedCost: number;
  totalCost: number;
  contribution: number;
  margin: number | null;
  revenuePerCustomer: number;
  costPerCustomer: number;
  costToRevenue: number | null;
  allowanceGb: number;
};

export type CurrentPlan = { name: string; monthlyPrice: number; annualMonthlyPrice: number | null; storageGb: number };

const STORAGE_KEY = "sp.pricing-simulator.v1";
const CUSTOMER_PRESETS = [50, 100, 250, 500, 1000];
const GROWTH_COUNTS = [10, 25, 50, 100, 150, 250, 400, 500, 750, 1000];
const SCENARIO_COLORS = ["#4F46E5", "#0EA5E9", "#A855F7", "#10B981", "#F59E0B"];

function likeTodayScenario(b: SimBaseline, plans: CurrentPlan[]): SimScenario {
  const tiers = (plans.length ? plans : [{ name: "Pro", monthlyPrice: 29, annualMonthlyPrice: 24, storageGb: 500 }]).map((p) => ({
    id: uid(),
    name: p.name,
    monthlyPrice: p.monthlyPrice,
    annualMonthlyPrice: p.annualMonthlyPrice,
    annualShare: b.annualShare ?? ILLUSTRATIVE.annualShare,
    storageGb: p.storageGb,
    mix: 100 / Math.max(1, plans.length || 1),
    utilization: b.avgUtilization ?? ILLUSTRATIVE.utilization,
    downloadRatio: b.downloadRatio ?? ILLUSTRATIVE.downloadRatio,
  }));
  return {
    id: uid("s"),
    name: "Today's plans, today's usage",
    customers: 100,
    tiers,
    proxiedShare: b.proxiedShare ?? ILLUSTRATIVE.proxiedShare,
    heavyShare: 0,
    heavyMultiplier: 3,
    usageMultiplier: 1,
    costMultiplier: 1,
    applyIncluded: true,
    includeFixed: true,
    includeStripe: true,
  };
}

// ---------------------------------------------------------------------------
// Small inputs
// ---------------------------------------------------------------------------

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  prefix,
  suffix,
  hint,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block" title={hint}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="mt-1 flex items-center rounded-lg border border-border bg-card focus-within:ring-2 focus-within:ring-indigo-500/40">
        {prefix ? <span className="pl-2.5 text-sm text-muted">{prefix}</span> : null}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? +value.toFixed(4) : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? Math.max(min, n) : 0);
          }}
          className="w-full min-w-0 bg-transparent px-2.5 py-1.5 text-sm tabular-nums text-heading outline-none"
        />
        {suffix ? <span className="pr-2.5 text-xs text-muted">{suffix}</span> : null}
      </span>
    </label>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  hint,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint?: string;
}) {
  return (
    <label className="block" title={hint}>
      <span className="flex items-baseline justify-between text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
        <span className="text-sm font-semibold normal-case tracking-normal tabular-nums text-heading">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-indigo-600"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm" title={hint}>
      <input type="checkbox" className="mt-0.5 accent-indigo-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-heading">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums text-heading", tone)}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

export function PricingSimulator({
  baseline,
  assumptions,
  actual,
  currentPlans,
  saved: initialSaved,
}: {
  baseline: SimBaseline;
  assumptions: CostAssumptions;
  actual: ActualSnapshot | null;
  currentPlans: CurrentPlan[];
  saved: SavedScenario[] | null;
}) {
  // Deterministic ids so server and client render the same markup.
  const defaults = useMemo(
    () =>
      [likeTodayScenario(baseline, currentPlans), ...presetScenarios(baseline, 100)].map((sc, i) => ({
        ...sc,
        id: `s_default_${i}`,
        tiers: sc.tiers.map((t, j) => ({ ...t, id: `t_default_${i}_${j}` })),
      })),
    [baseline, currentPlans]
  );
  const [scenarios, setScenarios] = useState<SimScenario[]>(defaults);
  const [activeId, setActiveId] = useState<string>(defaults[1]!.id);
  const [saved, setSaved] = useState<SavedScenario[] | null>(initialSaved);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Working set survives reloads in this browser only (convenience; "Save" stores it for real).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { scenarios?: unknown[]; activeId?: string };
        const list = (parsed.scenarios ?? []).map(parseScenario).filter((s): s is SimScenario => Boolean(s));
        if (list.length) {
          setScenarios(list);
          setActiveId(list.some((s) => s.id === parsed.activeId) ? parsed.activeId! : list[0]!.id);
        }
      }
    } catch {
      // Storage unavailable — keep defaults.
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ scenarios, activeId }));
    } catch {
      // ignore
    }
  }, [scenarios, activeId, hydrated]);

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0]!;
  const results = useMemo(() => new Map(scenarios.map((s) => [s.id, computeScenario(s, assumptions)])), [scenarios, assumptions]);
  const result = results.get(active.id)!;
  const stress = useMemo(() => stressTests(active, assumptions), [active, assumptions]);
  const growth = useMemo(() => growthSweep(active, assumptions, GROWTH_COUNTS), [active, assumptions]);
  const utilCurve = useMemo(() => utilizationSweep(active, assumptions, 10), [active, assumptions]);

  const update = (patch: Partial<SimScenario>) => setScenarios((list) => list.map((s) => (s.id === active.id ? { ...s, ...patch } : s)));
  const updateTier = (id: string, patch: Partial<SimTier>) => update({ tiers: active.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const setAllTiers = (patch: Partial<SimTier>) => update({ tiers: active.tiers.map((t) => ({ ...t, ...patch })) });
  const overrides = active.assumptions ?? {};
  const eff = { ...assumptions, ...overrides };
  const setOverride = (key: keyof CostAssumptions, v: number) => update({ assumptions: { ...overrides, [key]: v } });

  const mixTotal = active.tiers.reduce((s, t) => s + t.mix, 0);

  function addScenario(from?: SimScenario) {
    const base = from ?? presetScenarios(baseline, active.customers)[0]!;
    const copy: SimScenario = {
      ...structuredClone(base),
      id: uid("s"),
      name: from ? `${from.name} (copy)` : "New scenario",
      tiers: base.tiers.map((t) => ({ ...t, id: uid() })),
    };
    setScenarios((l) => [...l, copy].slice(0, 6));
    setActiveId(copy.id);
  }

  function removeScenario(id: string) {
    if (scenarios.length <= 1) return;
    const next = scenarios.filter((s) => s.id !== id);
    setScenarios(next);
    if (id === activeId) setActiveId(next[0]!.id);
  }

  async function saveActive() {
    setSaving(true);
    try {
      const isSaved = /^[0-9a-f-]{36}$/i.test(active.id);
      const res = await fetch(isSaved ? `/api/platform/economics/scenarios/${active.id}` : "/api/platform/economics/scenarios", {
        method: isSaved ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: active }),
      });
      const data = (await res.json().catch(() => ({}))) as { scenario?: SavedScenario; error?: string };
      if (!res.ok || !data.scenario) throw new Error(data.error || "Save failed");
      const s = data.scenario;
      setScenarios((l) => l.map((x) => (x.id === active.id ? { ...active, id: s.id } : x)));
      setActiveId(s.id);
      setSaved((list) => [s, ...(list ?? []).filter((x) => x.id !== s.id)]);
      toast.success(`Saved “${s.name}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSaved(id: string) {
    if (!window.confirm("Delete this saved scenario? Your working copy stays open.")) return;
    const res = await fetch(`/api/platform/economics/scenarios/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return toast.error("Delete failed");
    setSaved((list) => (list ?? []).filter((x) => x.id !== id));
    const detachedId = uid("s");
    setScenarios((l) => l.map((x) => (x.id === id ? { ...x, id: detachedId } : x)));
    if (activeId === id) setActiveId(detachedId);
  }

  function openSaved(s: SavedScenario) {
    const existing = scenarios.find((x) => x.id === s.id);
    if (existing) return setActiveId(s.id);
    setScenarios((l) => [...l, s.config].slice(-6));
    setActiveId(s.id);
  }

  // Risk flags for the active scenario.
  const worst = stress.find((c) => c.key === "worst")!.result;
  const risks: { tone: "bad" | "warn" | "ok"; text: string }[] = [];
  if (result.contribution < 0) risks.push({ tone: "bad", text: `Modeled costs exceed revenue by ${formatUsd(-result.contribution)}/mo.` });
  for (const t of result.tiers) {
    if (t.customers > 0 && t.margin != null && t.margin < 0) risks.push({ tone: "bad", text: `${t.name} loses ${formatUsd(-t.contribution / t.customers)} per customer per month.` });
    else if (t.customers > 0 && t.margin != null && t.margin < 0.5) risks.push({ tone: "warn", text: `${t.name} margin is ${formatPct(t.margin)} — thin.` });
    if (t.breakEvenUtilization != null && t.breakEvenUtilization < 1)
      risks.push({
        tone: "warn",
        text: `An average ${t.name} customer stops paying for themselves above ${formatPct(t.breakEvenUtilization)} utilization (${formatGb(t.breakEvenUtilization * (active.tiers.find((x) => x.id === t.id)?.storageGb ?? 0))}).`,
      });
  }
  if (worst.margin != null && worst.margin < 0) risks.push({ tone: "warn", text: `Worst case (full allowances, 3× downloads, +50% prices) loses ${formatUsd(-worst.contribution)}/mo.` });
  if (!risks.length) risks.push({ tone: "ok", text: "Every tier stays profitable even if customers fill their whole allowance." });

  const compareCols: { key: string; name: string; r: ScenarioResult | ActualSnapshot; color?: string; actual?: boolean }[] = [
    ...(actual ? [{ key: "actual", name: "Today (actual)", r: actual, actual: true }] : []),
    ...scenarios.map((s, i) => ({ key: s.id, name: s.name, r: results.get(s.id)!, color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] })),
  ];

  const compareRows: { label: string; get: (r: ScenarioResult | ActualSnapshot) => string; tone?: (r: ScenarioResult | ActualSnapshot) => string }[] = [
    { label: "Paying customers", get: (r) => r.customers.toLocaleString() },
    { label: "MRR", get: (r) => formatUsd(r.mrr) },
    { label: "ARR", get: (r) => formatUsd(r.mrr * 12, { cents: false }) },
    { label: "Allowance sold", get: (r) => formatGb(r.allowanceGb) },
    { label: "Storage used", get: (r) => formatGb(r.storageGb) },
    { label: "Downloads / mo", get: (r) => formatGb(r.downloadGb) },
    { label: "Storage cost", get: (r) => formatUsd(r.storageCost) },
    { label: "Bandwidth cost", get: (r) => formatUsd(r.bandwidthCost) },
    { label: "Stripe fees", get: (r) => formatUsd(r.stripeFees) },
    { label: "Fixed platform costs", get: (r) => formatUsd(r.fixedCost) },
    { label: "Total modeled cost", get: (r) => formatUsd(r.totalCost) },
    { label: "Contribution", get: (r) => formatUsd(r.contribution), tone: (r) => marginTone(r.margin) },
    { label: "Contribution margin", get: (r) => formatPct(r.margin, 1), tone: (r) => marginTone(r.margin) },
    { label: "Revenue / customer", get: (r) => formatUsd(r.revenuePerCustomer) },
    { label: "Cost / customer", get: (r) => formatUsd(r.costPerCustomer) },
    { label: "Cost ÷ revenue", get: (r) => formatPct(r.costToRevenue, 1) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-900">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Analysis only. Scenarios never change real plans, prices, subscriptions or Stripe.
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          <SourceTag kind="measured" title="Baseline drawn from today's real customers" /> baseline
          <SourceTag kind="assumption" /> your inputs
          <SourceTag kind="projected" /> results
        </span>
      </div>

      {/* Scenario tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
              s.id === active.id ? "border-heading bg-heading text-white" : "border-border bg-card text-muted hover:text-heading"
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} aria-hidden />
            {s.name}
            {/^[0-9a-f-]{36}$/i.test(s.id) ? <Save className="h-3 w-3 opacity-60" aria-label="saved" /> : null}
          </button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => addScenario()} disabled={scenarios.length >= 6}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Scenario
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => addScenario(active)} disabled={scenarios.length >= 6} title="Duplicate this scenario">
          <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {saved && saved.length ? (
            <select
              aria-label="Open a saved scenario"
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-heading"
              value=""
              onChange={(e) => {
                const s = saved.find((x) => x.id === e.target.value);
                if (s) openSaved(s);
              }}
            >
              <option value="">Open saved…</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {new Date(s.updatedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          ) : null}
          <Button type="button" size="sm" onClick={() => void saveActive()} disabled={saving || saved === null} title={saved === null ? "Needs migration V112" : undefined}>
            <Save className="mr-1 h-3.5 w-3.5" /> {saving ? "Saving…" : /^[0-9a-f-]{36}$/i.test(active.id) ? "Save changes" : "Save scenario"}
          </Button>
          {/^[0-9a-f-]{36}$/i.test(active.id) ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => void deleteSaved(active.id)} title="Delete saved copy">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {scenarios.length > 1 ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => removeScenario(active.id)} title="Close this scenario">
              Close
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ---------------- Inputs ---------------- */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Input
              aria-label="Scenario name"
              value={active.name}
              onChange={(e) => update({ name: e.target.value.slice(0, 120) })}
              className="mb-4 text-base font-semibold"
            />
            <Slider
              label="Paying customers"
              value={active.customers}
              min={10}
              max={2000}
              step={10}
              onChange={(v) => update({ customers: v })}
              format={(v) => v.toLocaleString()}
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {CUSTOMER_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update({ customers: n })}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs",
                    active.customers === n ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-border text-muted hover:text-heading"
                  )}
                >
                  {n.toLocaleString()}
                </button>
              ))}
              {baseline.payingCustomers > 0 ? (
                <button type="button" onClick={() => update({ customers: baseline.payingCustomers })} className="rounded-full border border-emerald-300 px-2.5 py-0.5 text-xs text-emerald-700">
                  Today: {baseline.payingCustomers}
                </button>
              ) : null}
              <input
                type="number"
                min={0}
                aria-label="Custom customer count"
                value={active.customers}
                onChange={(e) => update({ customers: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                className="w-20 rounded-lg border border-border bg-card px-2 py-0.5 text-xs tabular-nums"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-heading">Usage patterns (all tiers)</h3>
              <SourceTag kind="assumption" />
            </div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Storage utilization</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {baseline.avgUtilization != null ? (
                <PresetChip tone="actual" onClick={() => setAllTiers({ utilization: baseline.avgUtilization! })}>
                  Actual {formatPct(baseline.avgUtilization, 1)}
                </PresetChip>
              ) : null}
              {[
                ["Low", 0.1],
                ["Moderate", 0.3],
                ["High", 0.75],
                ["Maximum", 1],
              ].map(([l, v]) => (
                <PresetChip key={l as string} onClick={() => setAllTiers({ utilization: v as number })}>
                  {l} {formatPct(v as number)}
                </PresetChip>
              ))}
            </div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Monthly downloads ÷ stored</p>
            <div className="flex flex-wrap gap-1.5">
              {baseline.downloadRatio != null ? (
                <PresetChip tone="actual" onClick={() => setAllTiers({ downloadRatio: +baseline.downloadRatio!.toFixed(3) })}>
                  Actual {baseline.downloadRatio.toFixed(2)}×
                </PresetChip>
              ) : null}
              {[
                ["Low", 0.25],
                ["Moderate", 1],
                ["Heavy", 3],
                ["Extreme", 10],
              ].map(([l, v]) => (
                <PresetChip key={l as string} onClick={() => setAllTiers({ downloadRatio: v as number })}>
                  {l} {v as number}×
                </PresetChip>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              5× means a customer storing 100 GB generates 500 GB of downloads a month.
              {baseline.avgUtilization == null ? " No measured baseline yet — illustrative defaults are used." : ""}
            </p>
          </section>

          {active.tiers.map((t, i) => {
            const tr = result.tiers.find((x) => x.id === t.id);
            return (
              <section key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{i + 1}</span>
                  <input
                    aria-label="Tier name"
                    value={t.name}
                    onChange={(e) => updateTier(t.id, { name: e.target.value.slice(0, 40) })}
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm font-semibold text-heading outline-none focus:bg-subtle"
                  />
                  {tr ? (
                    <span className={cn("text-xs font-semibold tabular-nums", marginTone(tr.margin))}>
                      {tr.customers} cust · {formatPct(tr.margin)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove ${t.name}`}
                    disabled={active.tiers.length <= 1}
                    onClick={() => update({ tiers: active.tiers.filter((x) => x.id !== t.id) })}
                    className="text-muted hover:text-rose-700 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <NumField label="Monthly" prefix="$" value={t.monthlyPrice} step={1} onChange={(v) => updateTier(t.id, { monthlyPrice: v })} />
                  <NumField
                    label="Annual / mo"
                    prefix="$"
                    value={t.annualMonthlyPrice ?? 0}
                    step={1}
                    hint="Monthly-equivalent price when billed annually. 0 = no annual option."
                    onChange={(v) => updateTier(t.id, { annualMonthlyPrice: v > 0 ? v : null })}
                  />
                  <NumField label="Storage" suffix="GB" value={t.storageGb} step={50} onChange={(v) => updateTier(t.id, { storageGb: v })} />
                  <NumField label="Mix" suffix="%" value={t.mix} step={1} hint="Share of customers on this tier" onChange={(v) => updateTier(t.id, { mix: v })} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Slider label="Utilization" value={t.utilization} min={0} max={1} step={0.01} format={(v) => formatPct(v)} onChange={(v) => updateTier(t.id, { utilization: v })} />
                  <Slider label="Downloads ÷ stored" value={t.downloadRatio} min={0} max={10} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => updateTier(t.id, { downloadRatio: v })} />
                  <Slider
                    label="On annual"
                    value={t.annualMonthlyPrice == null ? 0 : t.annualShare}
                    min={0}
                    max={1}
                    step={0.05}
                    format={(v) => formatPct(v)}
                    onChange={(v) => updateTier(t.id, { annualShare: v })}
                  />
                </div>
                {tr && tr.breakEvenUtilization != null ? (
                  <p className="mt-2 text-xs text-muted">
                    Break-even: {formatPct(Math.min(tr.breakEvenUtilization, 99.99), 0)} of allowance at these download habits
                    {tr.breakEvenDownloadGb != null ? ` · or ${formatGb(tr.breakEvenDownloadGb)}/mo of downloads at the modeled storage` : ""}.
                  </p>
                ) : null}
              </section>
            );
          })}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={active.tiers.length >= 8}
              onClick={() =>
                update({
                  tiers: [
                    ...active.tiers,
                    {
                      id: uid(),
                      name: `Tier ${active.tiers.length + 1}`,
                      monthlyPrice: 59,
                      annualMonthlyPrice: 49,
                      annualShare: baseline.annualShare ?? ILLUSTRATIVE.annualShare,
                      storageGb: 1024,
                      mix: 10,
                      utilization: baseline.avgUtilization ?? ILLUSTRATIVE.utilization,
                      downloadRatio: baseline.downloadRatio ?? ILLUSTRATIVE.downloadRatio,
                    },
                  ],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add tier
            </Button>
            {Math.abs(mixTotal - 100) > 0.5 ? (
              <p className="text-xs text-amber-700">Mix totals {mixTotal.toFixed(0)}% — normalized to 100%.</p>
            ) : null}
          </div>

          <details className="group rounded-2xl border border-border bg-card p-4 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-semibold text-heading">
              Advanced assumptions <span className="text-xs font-normal text-muted group-open:hidden">— heavy users, delivery, unit prices</span>
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Slider label="Heavy-user share" value={active.heavyShare} min={0} max={0.5} step={0.01} format={(v) => formatPct(v)} onChange={(v) => update({ heavyShare: v })} hint="Share of customers who behave like power users" />
                <Slider label="Heavy-user multiplier" value={active.heavyMultiplier} min={1} max={20} step={0.5} format={(v) => `${v}×`} onChange={(v) => update({ heavyMultiplier: v })} />
                <Slider label="Usage multiplier (all)" value={active.usageMultiplier} min={0.25} max={5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => update({ usageMultiplier: v })} hint="Scale storage (capped at allowance) and downloads for everyone" />
                <Slider label="Provider price multiplier" value={active.costMultiplier} min={0.5} max={3} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => update({ costMultiplier: v })} hint="What if Supabase/Vercel raise prices?" />
                <Slider
                  label="Downloads streamed by ShootPortal"
                  value={active.proxiedShare}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(v) => formatPct(v)}
                  onChange={(v) => update({ proxiedShare: v })}
                  hint="App-streamed bytes pay Supabase egress AND Vercel transfer; signed URLs pay Supabase only"
                />
                <Slider
                  label="Direct delivery cache hits"
                  value={eff.signedDeliveryCachedShare}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(v) => formatPct(v)}
                  onChange={(v) => setOverride("signedDeliveryCachedShare", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumField label="Storage $/GB-mo" prefix="$" step={0.001} value={eff.storagePerGbMonth} onChange={(v) => setOverride("storagePerGbMonth", v)} />
                <NumField label="Uncached $/GB" prefix="$" step={0.001} value={eff.uncachedEgressPerGb} onChange={(v) => setOverride("uncachedEgressPerGb", v)} />
                <NumField label="Cached $/GB" prefix="$" step={0.001} value={eff.cachedEgressPerGb} onChange={(v) => setOverride("cachedEgressPerGb", v)} />
                <NumField label="Vercel $/GB" prefix="$" step={0.01} value={eff.vercelTransferPerGb} onChange={(v) => setOverride("vercelTransferPerGb", v)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle
                  label="Apply included quotas"
                  checked={active.applyIncluded}
                  onChange={(v) => update({ applyIncluded: v })}
                  hint={`Once, platform-wide (${eff.storageIncludedGb} GB storage, ${eff.uncachedEgressIncludedGb} GB uncached)`}
                />
                <Toggle label="Include fixed costs" checked={active.includeFixed} onChange={(v) => update({ includeFixed: v })} hint="Plans & base fees, split by customer count" />
                <Toggle label="Include Stripe fees" checked={active.includeStripe} onChange={(v) => update({ includeStripe: v })} />
              </div>
              {Object.keys(overrides).length ? (
                <button type="button" className="text-xs text-accent underline" onClick={() => update({ assumptions: {} })}>
                  Reset unit prices to the saved Costs &amp; Assumptions
                </button>
              ) : (
                <p className="text-xs text-muted">Unit prices come from Costs &amp; Assumptions; edits here apply to this scenario only.</p>
              )}
            </div>
          </details>
        </div>

        {/* ---------------- Results ---------------- */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Projected MRR" value={formatUsd(result.mrr)} sub={`${formatUsd(result.arr, { cents: false })} ARR`} />
            <Kpi label="Modeled costs / mo" value={formatUsd(result.totalCost)} sub={`${formatUsd(result.costPerCustomer)} per customer`} />
            <Kpi
              label="Contribution / mo"
              value={formatUsd(result.contribution)}
              sub={`${formatPct(result.margin, 1)} margin`}
              tone={marginTone(result.margin)}
            />
            <Kpi label="Storage used" value={formatGb(result.storageGb)} sub={`of ${formatGb(result.allowanceGb)} sold`} />
            <Kpi label="Downloads / mo" value={formatGb(result.downloadGb)} />
            <Kpi label="Cost ÷ revenue" value={formatPct(result.costToRevenue, 1)} sub={result.includedSavings > 0 ? `quotas save ${formatUsd(result.includedSavings)}` : undefined} />
          </div>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-heading">By tier</h3>
              <SourceTag kind="projected" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-2 pr-3 font-medium">Tier</th>
                    <th className="py-2 pr-3 font-medium">Customers</th>
                    <th className="py-2 pr-3 font-medium">Revenue</th>
                    <th className="py-2 pr-3 font-medium">Storage $</th>
                    <th className="py-2 pr-3 font-medium">Bandwidth $</th>
                    <th className="py-2 pr-3 font-medium">Fees + fixed</th>
                    <th className="py-2 pr-3 font-medium">Contribution</th>
                    <th className="py-2 pr-3 font-medium">Margin</th>
                    <th className="py-2 font-medium" title="Max average utilization before an average customer stops contributing (marginal rates)">
                      Break-even util.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.tiers.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-medium text-heading">{t.name}</td>
                      <td className="py-2 pr-3 tabular-nums">{t.customers}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatUsd(t.revenue)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatUsd(t.storageCost)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatUsd(t.bandwidthCost)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatUsd(t.stripeFees + t.fixedCost)}</td>
                      <td className={cn("py-2 pr-3 tabular-nums", marginTone(t.margin))}>{formatUsd(t.contribution)}</td>
                      <td className={cn("py-2 pr-3 tabular-nums font-medium", marginTone(t.margin))}>{formatPct(t.margin, 1)}</td>
                      <td className="py-2 tabular-nums">
                        {t.breakEvenUtilization == null ? "—" : t.breakEvenUtilization >= 1 ? <span className="text-emerald-700">never (&gt;100%)</span> : <span className="text-amber-700">{formatPct(t.breakEvenUtilization)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-heading">Risk indicators</h3>
            <ul className="space-y-1.5 text-sm">
              {risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  {r.tone === "ok" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", r.tone === "bad" ? "text-rose-600" : "text-amber-500")} aria-hidden />
                  )}
                  <span className={r.tone === "bad" ? "text-rose-800" : "text-heading"}>{r.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-1.5 pr-3 font-medium">Stress test</th>
                    <th className="py-1.5 pr-3 font-medium">Costs</th>
                    <th className="py-1.5 pr-3 font-medium">Contribution</th>
                    <th className="py-1.5 font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {stress.map((c) => (
                    <tr key={c.key} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3">
                        <span className="text-heading">{c.label}</span>
                        <span className="block text-xs text-muted">{c.detail}</span>
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">{formatUsd(c.result.totalCost)}</td>
                      <td className={cn("py-1.5 pr-3 tabular-nums", marginTone(c.result.margin))}>{formatUsd(c.result.contribution)}</td>
                      <td className={cn("py-1.5 tabular-nums font-medium", marginTone(c.result.margin))}>{formatPct(c.result.margin, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-heading">As the customer base grows</h3>
              <p className="mb-2 text-xs text-muted">Same mix and usage; included quotas and fixed costs matter less at scale.</p>
              <SweepChart
                xLabel={(x) => x.toLocaleString()}
                points={growth.map((g) => ({ x: g.customers, mrr: g.result.mrr, cost: g.result.totalCost, contribution: g.result.contribution }))}
                series={[
                  { key: "mrr", label: "MRR", color: "#10B981" },
                  { key: "cost", label: "Costs", color: "#F59E0B" },
                  { key: "contribution", label: "Contribution", color: "#4F46E5", dashed: true },
                ]}
              />
            </section>
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-heading">If customers fill their allowances</h3>
              <p className="mb-2 text-xs text-muted">Every tier&apos;s utilization from 0% to 100%, downloads scaling with storage.</p>
              <SweepChart
                xLabel={(x) => formatPct(x)}
                points={utilCurve.map((u) => ({ x: u.utilization, mrr: u.result.mrr, cost: u.result.totalCost, contribution: u.result.contribution }))}
                series={[
                  { key: "mrr", label: "MRR", color: "#10B981" },
                  { key: "cost", label: "Costs", color: "#F59E0B" },
                  { key: "contribution", label: "Contribution", color: "#4F46E5", dashed: true },
                ]}
              />
            </section>
          </div>
        </div>
      </div>

      {/* ---------------- Comparison ---------------- */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-heading">Compare scenarios</h3>
            <p className="text-sm text-muted">Every open scenario side by side{actual ? ", next to today's actual platform" : ""}.</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Info className="h-3.5 w-3.5" aria-hidden /> Contribution excludes payroll, marketing, support and taxes — it is not net profit.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Metric</th>
                {compareCols.map((c) => (
                  <th key={c.key} className={cn("py-2 pr-3 font-medium", c.key === active.id && "text-heading")}>
                    <span className="inline-flex items-center gap-1.5">
                      {c.color ? <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden /> : null}
                      {c.name}
                      {c.actual ? <SourceTag kind="estimated" title="Measured usage and actual MRR, costs estimated" /> : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-3 text-muted">{row.label}</td>
                  {compareCols.map((c) => (
                    <td key={c.key} className={cn("py-1.5 pr-3 tabular-nums", row.tone?.(c.r), c.key === active.id && "font-medium")}>
                      {row.get(c.r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PresetChip({ children, onClick, tone }: { children: ReactNode; onClick: () => void; tone?: "actual" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs transition",
        tone === "actual" ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-border text-muted hover:border-indigo-300 hover:text-heading"
      )}
    >
      {children}
    </button>
  );
}
