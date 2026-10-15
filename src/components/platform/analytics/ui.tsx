import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, type Channel } from "@/lib/analytics/channels";
import type { Rate } from "@/lib/analytics/aggregate";

export const fmtInt = (n: number) => n.toLocaleString("en-US");
export const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 });
export const fmtPct = (v: number | null, digits = 1) => (v === null ? "—" : `${(v * 100).toFixed(digits)}%`);
export const channelLabel = (c: string | null | undefined) => (c ? CHANNEL_LABELS[c as Channel] ?? c : "Unknown");

export const CHANNEL_COLORS: Record<string, string> = {
  google_organic: "#4F46E5",
  bing_organic: "#0EA5E9",
  other_search: "#6366F1",
  instagram: "#EC4899",
  facebook: "#3B82F6",
  tiktok: "#111827",
  other_social: "#A855F7",
  email: "#14B8A6",
  paid: "#F59E0B",
  referral: "#10B981",
  direct: "#64748B",
  unknown: "#CBD5E1",
};

export function DeltaBadge({ value, invert }: { value: number | null | undefined; invert?: boolean }) {
  if (value === undefined) return null;
  if (value === null) return <span className="text-xs font-medium text-muted">new</span>;
  const up = value > 0.0005;
  const down = value < -0.0005;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
        good ? "bg-emerald-50 text-emerald-700" : bad ? "bg-rose-50 text-rose-700" : "bg-subtle text-muted"
      )}
      title="Change vs. the previous period of equal length"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(value * 100).toFixed(0)}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  hint,
  definition,
  accent,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  hint?: ReactNode;
  definition?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm",
        accent ? "border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-card" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {definition ? (
          <span title={definition} className="text-muted" aria-label={`${label}: ${definition}`}>
            <Info className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums text-heading">{value}</p>
        <DeltaBadge value={delta} />
      </div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function RateCard({ label, rate, definition }: { label: string; rate: Rate; definition: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <span title={definition} className="text-muted" aria-label={`${label}: ${definition}`}>
          <Info className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">{fmtPct(rate.value)}</p>
      <p className="mt-1 text-xs text-muted">
        {fmtInt(rate.numerator)} of {fmtInt(rate.denominator)}
        {rate.note ? ` · ${rate.note}` : ""}
      </p>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-heading">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "warn" ? "border-amber-300 bg-amber-50 text-slate-900" : "border-indigo-200 bg-indigo-50/60 text-slate-800"
      )}
    >
      {children}
    </div>
  );
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
      {children}
    </div>
  );
}
