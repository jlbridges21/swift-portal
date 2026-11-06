"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, Info, Loader2, PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AVG_PER_PAID_PROJECT_DEFINITION,
  addDays,
  analyticsPalette,
  buildBuckets,
  dayCount,
  DASHBOARD_ANALYTICS_MAX_DAYS,
  formatCents,
  formatDayRange,
  isIsoDay,
  OTHER_SERVICE_KEY,
  sumIntoBuckets,
  type ServiceSlice,
  type AnalyticsGrouping,
  type DashboardAnalytics,
  type RevenueView,
} from "@/lib/dashboard-analytics";
import { RevenueProjectsChart } from "@/components/admin/dashboard-analytics/revenue-projects-chart";
import { ServiceDoughnut } from "@/components/admin/dashboard-analytics/service-doughnut";
import { DrilldownModal, type DrilldownRequest } from "@/components/admin/dashboard-analytics/drilldown-modal";

const PRESETS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "12M", days: 365 },
];

const REVENUE_VIEW_LABEL: Record<RevenueView, string> = {
  payments: "Payments received",
  invoices: "Invoices issued",
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full rounded-lg border border-border bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors sm:px-3",
            value === o.value ? "bg-card text-heading shadow-sm" : "text-muted hover:text-heading"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Search Console–style metric card: the whole card is the toggle and fills with the series color. */
function MetricToggle({
  label,
  value,
  color,
  foreground,
  on,
  onToggle,
}: {
  label: string;
  value: string;
  color: string;
  foreground: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-4 sm:py-3",
        on ? "border-transparent" : "border-border bg-card text-heading hover:bg-subtle"
      )}
      style={on ? { background: color, color: foreground } : undefined}
    >
      <span className="flex items-center gap-2 text-xs font-medium sm:text-sm">
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2",
            on ? "" : "border-slate-300"
          )}
          style={on ? { borderColor: foreground, background: foreground } : undefined}
          aria-hidden
        >
          {on ? <Check className="h-3 w-3" strokeWidth={3} style={{ color }} /> : null}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-1 block truncate text-xl font-semibold tabular-nums sm:text-2xl">{value}</span>
    </button>
  );
}

function SummaryStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-subtle px-3 py-2.5">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-heading">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

export function BusinessAnalytics({
  initial,
  today,
  primaryColor,
  accentColor,
}: {
  initial: DashboardAnalytics;
  today: string;
  primaryColor: string;
  accentColor: string;
}) {
  const [data, setData] = useState(initial);
  const [from, setFrom] = useState(initial.range.from);
  const [to, setTo] = useState(initial.range.to);
  const [grouping, setGrouping] = useState<AnalyticsGrouping>("daily");
  const [view, setView] = useState<RevenueView>("payments");
  const [showRevenue, setShowRevenue] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);
  const [drill, setDrill] = useState<DrilldownRequest | null>(null);
  const closeDrill = useCallback(() => setDrill(null), []);

  const palette = useMemo(() => analyticsPalette(primaryColor, accentColor), [primaryColor, accentColor]);

  const rangeError = !isIsoDay(from) || !isIsoDay(to)
    ? "Choose a From and To date."
    : from > to
      ? "From must be on or before To."
      : dayCount(from, to) > DASHBOARD_ANALYTICS_MAX_DAYS
        ? `Choose a range of ${DASHBOARD_ANALYTICS_MAX_DAYS} days or less.`
        : null;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (rangeError) return;
    if (from === data.range.from && to === data.range.to) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/dashboard/analytics?from=${from}&to=${to}`, {
          credentials: "include",
          signal: ctrl.signal,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) throw new Error(body?.error || "Could not load analytics.");
        setData(body as DashboardAnalytics);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // data.range is read only to skip a refetch of what is already shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, rangeError]);

  const buckets = useMemo(() => buildBuckets(data.days, grouping), [data.days, grouping]);
  const revenueSeries = useMemo(
    () => sumIntoBuckets(view === "payments" ? data.revenue.payments : data.revenue.invoices, buckets),
    [data.revenue, view, buckets]
  );
  const projectSeries = useMemo(() => sumIntoBuckets(data.newProjects, buckets), [data.newProjects, buckets]);

  const s = data.summary;
  const revenueTotal = view === "payments" ? s.paymentsNetCents : s.invoicesCents;
  const revenueLabel = REVENUE_VIEW_LABEL[view];

  const revenueHint =
    view === "payments"
      ? `${s.paymentCount} payment${s.paymentCount === 1 ? "" : "s"}${s.refundsCents ? ` · ${formatCents(s.refundsCents)} refunded` : ""}`
      : `${s.invoiceCount} payment request${s.invoiceCount === 1 ? "" : "s"}`;

  const nothingInRange =
    (!showRevenue || revenueSeries.every((v) => v === 0)) && (!showProjects || projectSeries.every((v) => v === 0));
  const emptyMessage = nothingInRange
    ? showRevenue && showProjects
      ? `No ${view === "payments" ? "payments received" : "invoices issued"} or new projects in this range.`
      : showRevenue
        ? `No ${view === "payments" ? "payments received" : "invoices issued"} in this range.`
        : "No new projects in this range."
    : null;

  const openPeriod = (index: number) => {
    const b = buckets[index];
    if (!b) return;
    setDrill({
      mode: "period",
      title: b.title,
      subtitle: "Projects created, paid, or invoiced in this period.",
      from: b.start,
      to: b.end,
      view,
    });
  };

  const openService = (slice: ServiceSlice) => {
    const keys = slice.key === OTHER_SERVICE_KEY ? (slice.members ?? []).map((m) => m.key) : [slice.key];
    if (!keys.length) return;
    const names =
      slice.key === OTHER_SERVICE_KEY ? ` (${(slice.members ?? []).map((m) => m.label).join(", ")})` : "";
    setDrill({
      mode: "service",
      title: slice.key === OTHER_SERVICE_KEY ? "Other services" : slice.label,
      subtitle: `Projects created ${formatDayRange(data.range.from, data.range.to)}${names}.`,
      from: data.range.from,
      to: data.range.to,
      serviceKeys: keys,
      view,
    });
  };

  const applyPreset = (days: number) => {
    setTo(today);
    setFrom(addDays(today, -(days - 1)));
  };
  const activePreset = to === today ? PRESETS.find((p) => from === addDays(today, -(p.days - 1)))?.label : undefined;

  return (
    <section aria-labelledby="business-analytics-heading" className="mt-10 w-full min-w-0">
      <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 id="business-analytics-heading" className="text-lg font-semibold text-heading">
            Business Analytics
          </h2>
          <p className="text-sm text-muted">
            {formatDayRange(data.range.from, data.range.to)}
            {loading ? <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin align-[-2px]" aria-label="Loading" /> : null}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
          <div className="col-span-2 inline-flex w-fit rounded-lg border border-border bg-subtle p-0.5" role="group" aria-label="Quick ranges">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                aria-pressed={activePreset === p.label}
                className={cn(
                  "min-h-9 rounded-md px-2.5 text-xs font-medium transition-colors",
                  activePreset === p.label ? "bg-card text-heading shadow-sm" : "text-muted hover:text-heading"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex flex-col text-[11px] font-medium text-muted">
            From
            <input
              type="date"
              value={from}
              max={to || today}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-0.5 min-h-9 w-full min-w-0 rounded-lg border border-border bg-card px-2 text-sm text-heading"
            />
          </label>
          <label className="flex flex-col text-[11px] font-medium text-muted">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="mt-0.5 min-h-9 w-full min-w-0 rounded-lg border border-border bg-card px-2 text-sm text-heading"
            />
          </label>
        </div>
      </div>
      {rangeError || error ? (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {rangeError ?? error}
        </p>
      ) : null}

      <div className={cn("grid w-full min-w-0 gap-6 lg:grid-cols-3", loading && "opacity-70 transition-opacity")}>
        <Card className="w-full min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader className="flex min-w-0 flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 surface-dark:bg-subtle">
                <BarChart3 className="h-4 w-4 text-heading" />
              </div>
              <span className="truncate">Revenue &amp; Project Analytics</span>
            </CardTitle>
            <Segmented
              label="Revenue view"
              value={view}
              onChange={setView}
              options={[
                { value: "payments", label: "Payments received" },
                { value: "invoices", label: "Invoices issued" },
              ]}
            />
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <div className="flex min-w-0 gap-3">
              <MetricToggle
                label="Revenue"
                value={formatCents(revenueTotal)}
                color={palette.revenue}
                foreground={palette.revenueForeground}
                on={showRevenue}
                onToggle={() => setShowRevenue((v) => !v)}
              />
              <MetricToggle
                label="New Projects"
                value={s.newProjects.toLocaleString("en-US")}
                color={palette.projects}
                foreground={palette.projectsForeground}
                on={showProjects}
                onToggle={() => setShowProjects((v) => !v)}
              />
            </div>

            <div className="flex justify-end">
              <Segmented
                label="Group by"
                value={grouping}
                onChange={setGrouping}
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
            </div>

            <RevenueProjectsChart
              buckets={buckets}
              revenue={{ label: revenueLabel, color: palette.revenue, values: revenueSeries, enabled: showRevenue }}
              projects={{
                label: "New Projects",
                color: palette.projects,
                values: projectSeries,
                enabled: showProjects,
                dashed: palette.projectsDashed,
              }}
              emptyMessage={emptyMessage}
              onSelect={openPeriod}
            />
            <p className="-mt-2 text-center text-[11px] text-muted">
              <span className="hidden sm:inline">Click</span>
              <span className="sm:hidden">Tap twice on</span> a point to see its projects.
            </p>

            <div className="grid min-w-0 gap-3 sm:grid-cols-3">
              <SummaryStat label={`Total revenue · ${revenueLabel}`} value={formatCents(revenueTotal)} hint={revenueHint} />
              <SummaryStat
                label="New Requests"
                value={s.newRequests.toLocaleString("en-US")}
                hint="Requests clients submitted through your portal"
              />
              <SummaryStat
                label="Avg revenue per paid project"
                value={s.avgPerPaidProjectCents === null ? "—" : formatCents(s.avgPerPaidProjectCents)}
                hint={`${s.paidProjects} paid project${s.paidProjects === 1 ? "" : "s"}`}
              />
            </div>

            <div className="flex gap-2 text-xs leading-relaxed text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <p>
                {view === "payments"
                  ? "Payments received counts each successful payment (deposits and balances included) on the day it was paid. Bank payments count once they settle."
                  : "Invoices issued counts each payment request on the day it was sent, excluding drafts and cancelled or expired requests, so nothing is counted twice."}{" "}
                Avg revenue per paid project: {AVG_PER_PAID_PROJECT_DEFINITION}
                {data.refundsTracked ? " Refunds are subtracted on the refund date." : " Refunds issued in Stripe are not recorded in ShootPortal yet, so they are not subtracted."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 surface-dark:bg-subtle">
                <PieChart className="h-4 w-4 text-heading" />
              </div>
              <span className="truncate">Projects by Service</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <ServiceDoughnut
              data={data.services}
              colors={palette.services}
              otherColor={palette.other}
              onSelect={openService}
            />
            {data.services.uniqueProjects > 0 ? (
              <p className="text-xs leading-relaxed text-muted">
                Projects created in this range. A project with several services counts once for each, so percentages
                are of {data.services.associations} service association{data.services.associations === 1 ? "" : "s"}. Select a slice or service to see its projects.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <DrilldownModal request={drill} onClose={closeDrill} />
    </section>
  );
}
