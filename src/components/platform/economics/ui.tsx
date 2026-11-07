import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatBytes, formatPct } from "@/lib/economics/assumptions";

/**
 * Provenance tag shown next to every figure family, so measured usage, estimates, user
 * assumptions and projections are never confused.
 */
export type Provenance = "measured" | "actual" | "estimated" | "assumption" | "projected";

const TAG: Record<Provenance, { label: string; cls: string; help: string }> = {
  measured: { label: "Measured", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", help: "Measured directly from ShootPortal's own records or storage." },
  actual: { label: "Actual", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", help: "Money actually billed or collected (Stripe invoices, recorded provider invoices)." },
  estimated: { label: "Estimated", cls: "bg-amber-50 text-amber-800 ring-amber-200", help: "Usage × unit prices from Costs & Assumptions. Not a provider invoice." },
  assumption: { label: "Assumption", cls: "bg-sky-50 text-sky-700 ring-sky-200", help: "An input you set. Change it under Costs & Assumptions or in the simulator." },
  projected: { label: "Projected", cls: "bg-violet-50 text-violet-700 ring-violet-200", help: "A modeled future outcome. Not a forecast or guarantee." },
};

export function SourceTag({ kind, title }: { kind: Provenance; title?: string }) {
  const t = TAG[kind];
  return (
    <span
      title={title ?? t.help}
      className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset", t.cls)}
    >
      {t.label}
    </span>
  );
}

/** Thin utilization meter. Amber ≥ 75%, red ≥ 90%. */
export function UtilizationBar({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className={cn("block h-1.5 rounded-full bg-subtle", className)} aria-hidden />;
  const pct = Math.max(0, Math.min(1, value));
  const tone = value >= 0.9 ? "bg-rose-500" : value >= 0.75 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-subtle", className)} aria-hidden>
      <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.max(pct * 100, value > 0 ? 2 : 0)}%` }} />
    </span>
  );
}

export function StorageCell({ bytes, allowanceGb, utilization }: { bytes: number; allowanceGb: number | null; utilization: number | null }) {
  return (
    <div className="min-w-[8.5rem]" title={utilization != null ? `${formatPct(utilization, 1)} of allowance used` : "Plan has no storage limit"}>
      <div className="whitespace-nowrap text-sm tabular-nums text-heading">
        {formatBytes(bytes)}
        <span className="text-muted"> / {allowanceGb != null ? `${allowanceGb >= 1024 ? `${allowanceGb / 1024} TB` : `${allowanceGb} GB`}` : "∞"}</span>
      </div>
      <UtilizationBar value={utilization} className="mt-1" />
    </div>
  );
}

export function StatLine({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right tabular-nums text-heading">
        {value}
        {hint ? <span className="ml-1.5 text-xs text-muted">{hint}</span> : null}
      </span>
    </div>
  );
}

export function marginTone(margin: number | null): string {
  if (margin == null) return "text-muted";
  if (margin < 0) return "text-rose-700";
  if (margin < 0.5) return "text-amber-700";
  return "text-emerald-700";
}
