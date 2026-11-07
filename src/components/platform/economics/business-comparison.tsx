"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { BusinessEconomicsRow } from "@/lib/platform-economics";
import { formatBytes, formatPct, formatUsd } from "@/lib/economics/assumptions";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StorageCell, marginTone } from "@/components/platform/economics/ui";
import { BusinessEconomicsSummary } from "@/components/platform/economics/business-summary";
import { BusinessEconomicsHistoryCharts } from "@/components/platform/economics/business-history";
import { cn } from "@/lib/utils";

type SortKey = "name" | "plan" | "mrr" | "storage" | "utilization" | "growth" | "egress" | "cost" | "contribution" | "margin";

const VIEWS = [
  { key: "all", label: "All live" },
  { key: "paying", label: "Paying" },
  { key: "near_limit", label: "≥ 75% of allowance" },
  { key: "low_margin", label: "Margin < 50%" },
  { key: "heavy_downloads", label: "Downloads > 2× stored" },
  { key: "growing", label: "Growing" },
  { key: "include_inactive", label: "Include inactive" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const SORTS: Record<SortKey, (r: BusinessEconomicsRow) => number | string> = {
  name: (r) => r.name.toLowerCase(),
  plan: (r) => r.planName.toLowerCase(),
  mrr: (r) => r.mrr,
  storage: (r) => r.storageBytes,
  utilization: (r) => r.utilization ?? -1,
  growth: (r) => r.storageGrowthBytes ?? -Infinity,
  egress: (r) => r.monthlyEgressBytes,
  cost: (r) => r.cost.total + r.stripeFees,
  contribution: (r) => r.contribution,
  margin: (r) => r.margin ?? Infinity,
};

export function BusinessComparison({
  rows,
  windowDays,
  initialFocus,
}: {
  rows: BusinessEconomicsRow[];
  windowDays: number;
  initialFocus?: string | null;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "cost", dir: "desc" });
  const [focus, setFocus] = useState<string | null>(initialFocus ?? null);

  const plans = useMemo(() => [...new Map(rows.map((r) => [r.plan, r.planName])).entries()], [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      const isLive = r.status === "active" && !r.deleted;
      if (view !== "include_inactive" && !isLive) return false;
      if (plan !== "all" && r.plan !== plan) return false;
      if (needle && !r.name.toLowerCase().includes(needle) && !r.slug.toLowerCase().includes(needle)) return false;
      switch (view) {
        case "paying":
          return r.isPaying;
        case "near_limit":
          return (r.utilization ?? 0) >= 0.75;
        case "low_margin":
          return r.isPaying && (r.margin ?? 1) < 0.5;
        case "heavy_downloads":
          return r.storageBytes > 0 && r.monthlyEgressBytes > r.storageBytes * 2;
        case "growing":
          return (r.storageGrowthBytes ?? 0) > 0;
        default:
          return true;
      }
    });
    const get = SORTS[sort.key];
    return out.sort((x, y) => {
      const a = get(x);
      const b = get(y);
      const c = typeof a === "string" ? a.localeCompare(String(b)) : (a as number) - (b as number);
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, q, view, plan, sort]);

  const totals = filtered.reduce(
    (acc, r) => ({
      mrr: acc.mrr + r.mrr,
      storage: acc.storage + r.storageBytes,
      egress: acc.egress + r.monthlyEgressBytes,
      cost: acc.cost + r.cost.total + r.stripeFees,
      contribution: acc.contribution + r.contribution,
    }),
    { mrr: 0, storage: 0, egress: 0, cost: 0, contribution: 0 }
  );

  const focused = focus ? rows.find((r) => r.id === focus) ?? null : null;

  const th = (key: SortKey, label: string, title?: string) => {
    const active = sort.key === key;
    const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th className="py-2 pr-3 font-medium" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          title={title}
          className={cn("inline-flex items-center gap-1 whitespace-nowrap hover:text-heading", active && "text-heading")}
          onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}
        >
          {label}
          <Icon className="h-3 w-3" aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Input className="lg:max-w-xs" placeholder="Search businesses…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search businesses" />
        <div className="flex flex-wrap items-center gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                view === v.key ? "border-heading bg-heading text-white" : "border-border text-muted hover:text-heading"
              )}
            >
              {v.label}
            </button>
          ))}
          <select
            aria-label="Filter by plan"
            className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-heading"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="all">All plans</option>
            {plans.map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              {th("name", "Business")}
              {th("plan", "Plan")}
              {th("mrr", "MRR", "Subscription list price, monthly equivalent")}
              {th("storage", "Storage")}
              {th("growth", "30d Δ", "Change vs the snapshot ~30 days ago")}
              {th("egress", `Delivered ${windowDays}d`)}
              {th("cost", "Cost / mo", "Marginal infrastructure + Stripe fees")}
              {th("contribution", "Contribution")}
              {th("margin", "Margin")}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle/60"
                onClick={() => setFocus(r.id)}
              >
                <td className="py-2.5 pr-3">
                  <button type="button" className="text-left font-medium text-heading underline-offset-2 hover:underline" onClick={() => setFocus(r.id)}>
                    {r.name}
                  </button>
                  <div className="text-xs text-muted">
                    {r.isComped ? "comped" : r.subscriptionStatus}
                    {r.interval === "annual" ? " · annual" : ""}
                  </div>
                </td>
                <td className="py-2.5 pr-3">{r.planName}</td>
                <td className="py-2.5 pr-3 tabular-nums">{r.mrr ? formatUsd(r.mrr) : <span className="text-muted">—</span>}</td>
                <td className="py-2.5 pr-3">
                  <StorageCell bytes={r.storageBytes} allowanceGb={r.allowanceGb} utilization={r.utilization} />
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-muted">
                  {r.storageGrowthBytes != null ? `${r.storageGrowthBytes >= 0 ? "+" : "−"}${formatBytes(Math.abs(r.storageGrowthBytes))}` : "—"}
                </td>
                <td className="py-2.5 pr-3 tabular-nums">{formatBytes(r.monthlyEgressBytes)}</td>
                <td className="py-2.5 pr-3 tabular-nums">{formatUsd(r.cost.total + r.stripeFees)}</td>
                <td className={cn("py-2.5 pr-3 tabular-nums", r.mrr ? marginTone(r.margin) : "text-muted")}>{formatUsd(r.contribution)}</td>
                <td className={cn("py-2.5 tabular-nums font-medium", marginTone(r.margin))}>{formatPct(r.margin, 0)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted">
                  No businesses match.
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-border text-xs font-medium text-heading">
                <td className="py-2 pr-3" colSpan={2}>
                  {filtered.length} businesses
                </td>
                <td className="py-2 pr-3 tabular-nums">{formatUsd(totals.mrr)}</td>
                <td className="py-2 pr-3 tabular-nums">{formatBytes(totals.storage)}</td>
                <td />
                <td className="py-2 pr-3 tabular-nums">{formatBytes(totals.egress)}</td>
                <td className="py-2 pr-3 tabular-nums">{formatUsd(totals.cost)}</td>
                <td className="py-2 pr-3 tabular-nums">{formatUsd(totals.contribution)}</td>
                <td className="py-2 tabular-nums">{totals.mrr ? formatPct(totals.contribution / totals.mrr, 0) : "—"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-muted">
        Costs are marginal (no share of included quotas or fixed fees), so the column total is an upper bound on usage cost. Click a row for
        details.
      </p>

      <Modal
        open={Boolean(focused)}
        onClose={() => setFocus(null)}
        title={focused ? focused.name : ""}
        className="sm:max-w-5xl"
        footer={
          focused ? (
            <div className="flex w-full justify-between gap-2 text-sm">
              <Link href={`/platform/businesses/${focused.id}`} className="text-accent underline">
                Open business record
              </Link>
              <button type="button" className="text-muted hover:text-heading" onClick={() => setFocus(null)}>
                Close
              </button>
            </div>
          ) : null
        }
      >
        {focused ? (
          <div className="space-y-6">
            <BusinessEconomicsSummary row={focused} windowDays={windowDays} />
            <BusinessEconomicsHistoryCharts businessId={focused.id} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
