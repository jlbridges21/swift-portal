"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Box,
  Calendar,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CloudUpload,
  CreditCard,
  FileText,
  FolderKanban,
  FolderPlus,
  Globe,
  HardDrive,
  Inbox,
  Info,
  type LucideIcon,
  Mail,
  MessageSquare,
  MessageSquarePlus,
  PencilLine,
  PieChart,
  Plus,
  RefreshCw,
  ScanEye,
  Send,
  UserPlus,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/header";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { ComposeMessageModal } from "@/components/admin/compose-message-modal";
import { ProjectCoverImage } from "@/components/projects/project-cover-image";
import { useAdminCapabilities } from "@/components/admin/admin-capabilities-context";
import { ServiceDoughnut } from "@/components/admin/dashboard-analytics/service-doughnut";
import { DrilldownModal, type DrilldownRequest } from "@/components/admin/dashboard-analytics/drilldown-modal";
import { RevenueBarChart, type BarSeries } from "@/components/admin/command-center/revenue-bar-chart";
import { DateRangePicker } from "@/components/admin/command-center/date-range-picker";
import {
  ANALYTICS_GROUPINGS,
  analyticsPalette,
  buildBuckets,
  formatCents,
  formatDayRange,
  OTHER_SERVICE_KEY,
  suggestedGrouping,
  sumIntoBuckets,
  type AnalyticsGrouping,
  type DashboardAnalytics,
  type RevenueView,
  type ServiceSlice,
} from "@/lib/dashboard-analytics";
import { percentChange, type BusinessStorageUsage, type CommandCenterSummary } from "@/lib/command-center";
import type { PipelineStageParam } from "@/lib/admin-project-pipeline";
import { getActivityDisplay } from "@/lib/activity-display";
import { formatStorageSize } from "@/lib/format-bytes";
import type { ActivityLog } from "@/lib/types";
import type { ConversationListItem } from "@/lib/messaging-types";
import { cn, formatRelativeTime } from "@/lib/utils";

/** "1.0 TB" → "1 TB" for plan allowances. */
function formatAllowance(bytes: number): string {
  return formatStorageSize(bytes).replace(/\.0 /, " ");
}

export type CommandCenterCounts = {
  newRequests: number;
  quotesWaiting: number;
  upcomingShoots: number;
  editingQueue: number;
  inReview: number;
  awaitingPayment: number;
};

export type UpcomingShootCard = {
  id: string;
  title: string;
  service: string | null;
  dateLabel: string;
  timeLabel: string;
  heroUrl: string | null;
};

export type ActivityLogRow = ActivityLog & { projects?: { id: string; project_name: string } | null };

/** Same URL as pipelineStageHref (that module is server-only, so it can't be imported here). */
function pipelineStageHref(stage: PipelineStageParam): string {
  return `/admin/projects?stage=${stage}`;
}

const REVENUE_VIEW_LABEL: Record<RevenueView, string> = {
  payments: "Payments received",
  invoices: "Invoices issued",
};

const GROUPING_LABEL: Record<AnalyticsGrouping, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

/**
 * New Projects bar color: the brand accent rotated toward blue so it reads apart from the
 * Revenue bars (purple accent → blue; blue accent → teal). Neutral accents fall back to blue.
 */
function projectsSeriesColor(accent: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(accent.trim());
  if (!m) return "#3B82F6";
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (sat < 0.2) return "#3B82F6";
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return `hsl(${Math.round((h - 32 + 360) % 360)} ${Math.round(Math.min(0.85, Math.max(0.6, sat)) * 100)}% 55%)`;
}

export function CommandCenter({
  firstName,
  today,
  primaryColor,
  accentColor,
  initialAnalytics,
  initialSummary,
  storage,
  counts,
  upcoming,
  activity,
  notices,
}: {
  firstName: string;
  today: string;
  primaryColor: string;
  accentColor: string;
  initialAnalytics: DashboardAnalytics | null;
  initialSummary: CommandCenterSummary | null;
  storage: BusinessStorageUsage | null;
  counts: CommandCenterCounts;
  upcoming: UpcomingShootCard[];
  activity: ActivityLogRow[];
  /** Setup checklist / push prompts, shown under the heading when present. */
  notices?: React.ReactNode;
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [summary, setSummary] = useState(initialSummary);
  const [range, setRange] = useState(() => initialAnalytics?.range ?? { from: today, to: today });
  const [view, setView] = useState<RevenueView>("payments");
  const [showRevenue, setShowRevenue] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  /** null = follow the range length (daily up to ~3 months, then weekly, then monthly). */
  const [groupingChoice, setGroupingChoice] = useState<AnalyticsGrouping | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrilldownRequest | null>(null);
  const closeDrill = useCallback(() => setDrill(null), []);
  const skipFirst = useRef(true);

  const palette = useMemo(() => analyticsPalette(primaryColor, accentColor), [primaryColor, accentColor]);

  // Range change → reload analytics and the comparison summary together.
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const ctrl = new AbortController();
    const qs = `from=${range.from}&to=${range.to}`;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [a, s] = await Promise.all([
          fetch(`/api/admin/dashboard/analytics?${qs}`, { credentials: "include", signal: ctrl.signal }),
          fetch(`/api/admin/dashboard/summary?${qs}`, { credentials: "include", signal: ctrl.signal }),
        ]);
        const aBody = await a.json().catch(() => null);
        if (!a.ok || !aBody) throw new Error(aBody?.error || "Could not load analytics.");
        setAnalytics(aBody as DashboardAnalytics);
        const sBody = await s.json().catch(() => null);
        setSummary(s.ok && sBody ? (sBody as CommandCenterSummary) : null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [range]);

  const grouping = groupingChoice ?? suggestedGrouping(analytics?.days.length ?? 30);
  const buckets = useMemo(() => (analytics ? buildBuckets(analytics.days, grouping) : []), [analytics, grouping]);
  const revenueSeries = useMemo(
    () => (analytics ? sumIntoBuckets(view === "payments" ? analytics.revenue.payments : analytics.revenue.invoices, buckets) : []),
    [analytics, view, buckets]
  );
  const projectSeries = useMemo(() => (analytics ? sumIntoBuckets(analytics.newProjects, buckets) : []), [analytics, buckets]);
  const projectsColor = useMemo(() => projectsSeriesColor(accentColor), [accentColor]);
  const chartSeries: BarSeries[] = [
    ...(showRevenue ? [{ key: "revenue", label: REVENUE_VIEW_LABEL[view], values: revenueSeries, color: accentColor, format: "money" as const }] : []),
    ...(showProjects ? [{ key: "projects", label: "New projects", values: projectSeries, color: projectsColor, format: "count" as const }] : []),
  ];
  const revenueNoun = view === "payments" ? "payments received" : "invoices issued";
  const chartEmptyMessage =
    showRevenue && showProjects ? `No ${revenueNoun} or new projects in this range.` : showRevenue ? `No ${revenueNoun} in this range.` : "No new projects in this range.";

  const s = analytics?.summary;
  const revenueTotal = s ? (view === "payments" ? s.paymentsNetCents : s.invoicesCents) : 0;
  const prevRevenue = summary?.previous ? (view === "payments" ? summary.previous.paymentsNetCents : summary.previous.invoicesCents) : null;
  const revenueDelta = s ? percentChange(revenueTotal, prevRevenue) : null;
  const projectsDelta = s ? percentChange(s.newProjects, summary?.previous?.newProjects) : null;
  const clientsBase = summary ? summary.clients.total - summary.clients.newInRange : null;
  const clientsDelta = summary && clientsBase ? Math.round((summary.clients.newInRange / clientsBase) * 100) : null;
  const rangeDays = analytics?.days.length ?? 30;
  const priorLabel = `vs. prior ${rangeDays} day${rangeDays === 1 ? "" : "s"}`;

  const openPeriod = (index: number) => {
    const b = buckets[index];
    if (!b) return;
    setDrill({ mode: "period", title: b.title, subtitle: "Projects created, paid, or invoiced in this period.", from: b.start, to: b.end, view });
  };

  const openService = (slice: ServiceSlice) => {
    if (!analytics) return;
    const keys = slice.key === OTHER_SERVICE_KEY ? (slice.members ?? []).map((m) => m.key) : [slice.key];
    if (!keys.length) return;
    const names = slice.key === OTHER_SERVICE_KEY ? ` (${(slice.members ?? []).map((m) => m.label).join(", ")})` : "";
    setDrill({
      mode: "service",
      title: slice.key === OTHER_SERVICE_KEY ? "Other services" : slice.label,
      subtitle: `Projects created ${formatDayRange(analytics.range.from, analytics.range.to)}${names}.`,
      from: analytics.range.from,
      to: analytics.range.to,
      serviceKeys: keys,
      view,
    });
  };

  return (
    <main className="app-page mx-auto w-full max-w-[1400px] min-w-0 px-4 py-6 sm:px-6 lg:px-8">
      {/* Title + subtitle go to the shared top bar; the range and New Project stay as one compact row. */}
      <PageHeader title="Command Center" description={`What needs your attention today, ${firstName}?`}>
        {analytics ? (
          <DateRangePicker from={range.from} to={range.to} today={today} loading={loading} onChange={setRange} />
        ) : null}
        <Link
          href="/admin/projects/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover sm:px-4"
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">New Project</span>
        </Link>
      </PageHeader>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notices}

      {/* Summary cards */}
      <section aria-label="Summary" className={cn("grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4", loading && "opacity-70 transition-opacity")}>
        <SummaryCard
          icon={CircleDollarSign}
          value={s ? formatCents(revenueTotal) : "—"}
          label="Revenue"
          delta={revenueDelta}
          deltaTitle={`${REVENUE_VIEW_LABEL[view]} ${priorLabel}`}
        />
        <SummaryCard
          icon={FolderKanban}
          value={s ? s.newProjects.toLocaleString("en-US") : "—"}
          label="Projects"
          delta={projectsDelta}
          deltaTitle={`New projects ${priorLabel}`}
          href="/admin/projects"
        />
        <SummaryCard
          icon={Users}
          value={summary ? summary.clients.total.toLocaleString("en-US") : "—"}
          label="Clients"
          delta={clientsDelta}
          deltaTitle={summary ? `${summary.clients.newInRange} new client${summary.clients.newInRange === 1 ? "" : "s"} in this period` : undefined}
          href="/admin/clients"
        />
        <StorageCard storage={storage} />
      </section>

      {/* Workflow status */}
      <section aria-label="Workflow" className="mt-3 grid min-w-0 grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
        {STATUS_CARDS.map((card) => (
          <StatusCard key={card.stage} card={card} count={counts[card.countKey]} />
        ))}
      </section>

      {/* Analytics + activity */}
      <section className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-[1.3fr_1.15fr_1fr]">
        <Panel className="lg:col-span-2 xl:col-span-1">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <PanelTitle icon={BarChart3}>Revenue</PanelTitle>
            <div role="radiogroup" aria-label="Revenue view" className="inline-flex rounded-lg border border-border bg-subtle p-0.5">
              {(["payments", "invoices"] as RevenueView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "min-h-8 whitespace-nowrap rounded-md px-2.5 text-[11px] font-semibold transition-colors",
                    view === v ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:text-heading"
                  )}
                >
                  {REVENUE_VIEW_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          {analytics ? (
            <>
              <div className="mt-3 flex min-w-0 items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-2xl font-bold tabular-nums text-heading">{formatCents(revenueTotal)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    {revenueDelta !== null ? <DeltaChip value={revenueDelta} /> : null}
                    <span>{revenueDelta !== null ? priorLabel : formatDayRange(analytics.range.from, analytics.range.to)}</span>
                  </p>
                </div>
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle"
                  title={
                    (view === "payments"
                      ? "Payments received counts each successful payment (deposits and balances included) on the day it was paid. Bank payments count once they settle."
                      : "Invoices issued counts each payment request on the day it was sent, excluding drafts and cancelled or expired requests.") +
                    (analytics.refundsTracked ? " Refunds are subtracted on the refund date." : " Refunds issued in Stripe are not recorded yet, so they are not subtracted.")
                  }
                  aria-label="How revenue is counted"
                  role="img"
                >
                  <Info className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div role="group" aria-label="Chart datasets" className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <SeriesToggle
                    label="Revenue"
                    color={accentColor}
                    on={showRevenue}
                    locked={showRevenue && !showProjects}
                    onToggle={() => setShowRevenue((v) => !v)}
                  />
                  <SeriesToggle
                    label="New Projects"
                    color={projectsColor}
                    on={showProjects}
                    locked={showProjects && !showRevenue}
                    onToggle={() => setShowProjects((v) => !v)}
                  />
                </div>
                <div role="radiogroup" aria-label="Group by" className="inline-flex rounded-lg border border-border bg-subtle p-0.5">
                  {ANALYTICS_GROUPINGS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={grouping === g}
                      onClick={() => setGroupingChoice(g)}
                      className={cn(
                        "min-h-7 whitespace-nowrap rounded-md px-2.5 text-[11px] font-semibold transition-colors",
                        grouping === g ? "bg-card text-heading shadow-sm" : "text-muted hover:text-heading"
                      )}
                    >
                      {GROUPING_LABEL[g]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <RevenueBarChart
                  buckets={buckets}
                  series={chartSeries}
                  height={160}
                  emptyMessage={chartEmptyMessage}
                  onSelect={openPeriod}
                />
              </div>
            </>
          ) : (
            <PanelEmpty>Revenue analytics could not be loaded. Refresh the page to try again.</PanelEmpty>
          )}
        </Panel>

        <Panel>
          <PanelTitle icon={PieChart}>Projects by Service</PanelTitle>
          <div className="mt-3">
            {analytics ? (
              <ServiceDoughnut
                data={analytics.services}
                colors={palette.services}
                otherColor={palette.other}
                onSelect={openService}
                layout="compact"
              />
            ) : (
              <PanelEmpty>Not available right now.</PanelEmpty>
            )}
          </div>
        </Panel>

        <ProjectActivityPanel logs={activity} />
      </section>

      {/* Upcoming, messages, quick actions */}
      <section className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UpcomingShootsPanel shoots={upcoming} total={counts.upcomingShoots} />
        <RecentMessagesPanel />
        <QuickActionsPanel />
      </section>

      <DrilldownModal request={drill} onClose={closeDrill} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** Compact dataset switch that doubles as the chart legend. The last one on can't be turned off. */
function SeriesToggle({
  label,
  color,
  on,
  locked,
  onToggle,
}: {
  label: string;
  color: string;
  on: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={locked || undefined}
      title={locked ? "At least one dataset stays on" : `${on ? "Hide" : "Show"} ${label}`}
      onClick={() => {
        if (!locked) onToggle();
      }}
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors",
        on ? "border-border bg-card text-heading shadow-sm" : "border-dashed border-border bg-transparent text-muted hover:text-heading",
        locked && "cursor-default"
      )}
    >
      <span
        className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border-[1.5px]", !on && "border-slate-300")}
        style={on ? { background: color, borderColor: color } : undefined}
        aria-hidden
      >
        {on ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} /> : null}
      </span>
      {label}
    </button>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5", className)}>
      {children}
    </div>
  );
}

function PanelTitle({ icon: Icon, children, action }: { icon: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-heading">
        <Icon className="h-[18px] w-[18px] shrink-0 text-accent" aria-hidden />
        <span className="truncate">{children}</span>
      </h2>
      {action}
    </div>
  );
}

function ViewAll({ href, onClick, label = "View All" }: { href?: string; onClick?: () => void; label?: string }) {
  const cls = "shrink-0 text-xs font-semibold text-accent hover:underline";
  return href ? (
    <Link href={href} className={cls}>
      {label}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {label}
    </button>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}

function DeltaChip({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  value,
  label,
  delta,
  deltaTitle,
  href,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  delta: number | null;
  deltaTitle?: string;
  href?: string;
}) {
  const body = (
    <div className="flex h-full min-w-0 items-center gap-3">
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent sm:flex">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-bold tabular-nums text-heading sm:text-2xl">{value}</p>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <p className="truncate text-sm text-muted">{label}</p>
          {delta !== null ? (
            <span title={deltaTitle}>
              <DeltaChip value={delta} />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
  const cls = "block min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:-translate-y-0.5 hover:shadow-md")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function StorageCard({ storage }: { storage: BusinessStorageUsage | null }) {
  const used = storage?.usedBytes ?? 0;
  const limit = storage?.limitBytes ?? null;
  const ratio = limit ? used / limit : null;
  const pct = ratio === null ? null : Math.min(100, Math.round(ratio * 100));
  const tone = ratio === null ? "bg-accent" : ratio >= 0.95 ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-accent";
  return (
    <Link
      href="/admin/media"
      className="block min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"
      title={limit ? `${formatStorageSize(used)} of ${formatAllowance(limit)} used` : undefined}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent sm:flex">
          <HardDrive className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold tabular-nums text-heading sm:text-2xl">{storage ? formatStorageSize(used) : "—"}</p>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2">
            <p className="truncate text-sm text-muted">Media Storage</p>
            <p className="truncate text-xs text-muted">
              {!storage ? "Unavailable" : limit ? `${pct}% of ${formatAllowance(limit)}` : "Unlimited plan"}
            </p>
          </div>
        </div>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 surface-dark:bg-subtle"
        role="progressbar"
        aria-label="Media storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        <div className={cn("h-full rounded-full transition-[width]", tone)} style={{ width: `${pct ?? (storage && used > 0 ? 100 : 0)}%`, opacity: pct === null ? 0.35 : 1 }} />
      </div>
    </Link>
  );
}

type StatusCardDef = {
  stage: PipelineStageParam;
  countKey: keyof CommandCenterCounts;
  label: string;
  icon: LucideIcon;
  /** Card tint, icon color. */
  tint: string;
  iconCls: string;
};

const STATUS_CARDS: StatusCardDef[] = [
  { stage: "new_request", countKey: "newRequests", label: "New Requests", icon: Inbox, tint: "bg-blue-50/70 border-blue-100", iconCls: "text-blue-600" },
  { stage: "quote", countKey: "quotesWaiting", label: "Quotes", icon: FileText, tint: "bg-violet-50/70 border-violet-100", iconCls: "text-violet-600" },
  { stage: "upcoming_shoot", countKey: "upcomingShoots", label: "Upcoming Shoots", icon: Calendar, tint: "bg-emerald-50/70 border-emerald-100", iconCls: "text-emerald-600" },
  { stage: "editing", countKey: "editingQueue", label: "Editing", icon: PencilLine, tint: "bg-amber-50/70 border-amber-100", iconCls: "text-amber-600" },
  { stage: "in_review", countKey: "inReview", label: "In Review", icon: ScanEye, tint: "bg-purple-50/70 border-purple-100", iconCls: "text-purple-600" },
  { stage: "awaiting_payment", countKey: "awaitingPayment", label: "Awaiting Payment", icon: CreditCard, tint: "bg-rose-50/70 border-rose-100", iconCls: "text-rose-600" },
];

function StatusCard({ card, count }: { card: StatusCardDef; count: number }) {
  const Icon = card.icon;
  return (
    <Link
      href={pipelineStageHref(card.stage)}
      className={cn(
        "group block min-w-0 rounded-2xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-md surface-dark:border-border surface-dark:bg-card",
        card.tint
      )}
    >
      <Icon className={cn("h-5 w-5", card.iconCls)} aria-hidden />
      <div className="mt-2 flex min-w-0 items-end justify-between gap-1">
        <div className="min-w-0">
          <p className="text-xl font-bold tabular-nums text-heading">{count}</p>
          <p className="truncate text-xs font-medium text-muted">{card.label}</p>
        </div>
        <ChevronRight className="mb-0.5 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-heading" aria-hidden />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Project activity
// ---------------------------------------------------------------------------

/** Delivery-tracking events are noise in a five-line summary; the full feed still lists them. */
const QUIET_ACTIVITY = new Set(["email_delivered", "email_opened", "email_clicked"]);

const ACTIVITY_ICON: Record<string, { icon: LucideIcon; cls: string }> = {
  photos_uploaded: { icon: Camera, cls: "bg-blue-50 text-blue-600" },
  videos_uploaded: { icon: Video, cls: "bg-blue-50 text-blue-600" },
  media_uploaded: { icon: CloudUpload, cls: "bg-blue-50 text-blue-600" },
  documents_uploaded: { icon: FileText, cls: "bg-slate-100 text-slate-600" },
  tour_added: { icon: Globe, cls: "bg-sky-50 text-sky-600" },
  model_added: { icon: Box, cls: "bg-indigo-50 text-indigo-600" },
  deliverables_approved: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  sent_for_review: { icon: ScanEye, cls: "bg-purple-50 text-purple-600" },
  shoot_confirmed: { icon: CalendarClock, cls: "bg-emerald-50 text-emerald-600" },
  shoot_proposed: { icon: CalendarClock, cls: "bg-amber-50 text-amber-600" },
  shoot_rescheduled: { icon: CalendarClock, cls: "bg-amber-50 text-amber-600" },
  shoot_completed: { icon: Camera, cls: "bg-emerald-50 text-emerald-600" },
  payment_received: { icon: CircleDollarSign, cls: "bg-emerald-50 text-emerald-600" },
  payment_completed: { icon: CircleDollarSign, cls: "bg-emerald-50 text-emerald-600" },
  invoice_sent: { icon: CreditCard, cls: "bg-rose-50 text-rose-600" },
  payment_requested: { icon: CreditCard, cls: "bg-rose-50 text-rose-600" },
  quote_sent: { icon: Send, cls: "bg-violet-50 text-violet-600" },
  quote_approved: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  revision_requested: { icon: PencilLine, cls: "bg-amber-50 text-amber-600" },
  revision_completed: { icon: RefreshCw, cls: "bg-emerald-50 text-emerald-600" },
  status_updated: { icon: RefreshCw, cls: "bg-slate-100 text-slate-600" },
  project_created: { icon: FolderPlus, cls: "bg-blue-50 text-blue-600" },
  email_sent: { icon: Mail, cls: "bg-slate-100 text-slate-600" },
};

function ProjectActivityPanel({ logs }: { logs: ActivityLogRow[] }) {
  const [open, setOpen] = useState(false);
  const recent = useMemo(() => logs.filter((l) => !QUIET_ACTIVITY.has(l.activity_type)).slice(0, 5), [logs]);
  return (
    <Panel>
      <PanelTitle icon={Activity} action={logs.length ? <ViewAll onClick={() => setOpen(true)} /> : null}>
        Project Activity
      </PanelTitle>
      {recent.length === 0 ? (
        <PanelEmpty>No recent activity</PanelEmpty>
      ) : (
        <ul className="mt-3 space-y-1">
          {recent.map((log) => {
            const { description } = getActivityDisplay(log.activity_type, log.description);
            const meta = ACTIVITY_ICON[log.activity_type] ?? { icon: Zap, cls: "bg-slate-100 text-slate-600" };
            const Icon = meta.icon;
            const project = log.projects?.project_name && log.project_id ? log.projects : null;
            const row = (
              <>
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full surface-dark:bg-subtle", meta.cls)}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug text-heading">{description}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {project ? `${project.project_name} · ` : ""}
                    {formatRelativeTime(log.created_at)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={log.id}>
                {project ? (
                  <Link href={`/admin/projects/${log.project_id}`} className="-mx-2 flex min-w-0 items-start gap-3 rounded-lg p-2 transition-colors hover:bg-subtle">
                    {row}
                  </Link>
                ) : (
                  <div className="-mx-2 flex min-w-0 items-start gap-3 p-2">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Project Activity">
        <ActivityFeed logs={logs} />
      </Modal>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Upcoming shoots
// ---------------------------------------------------------------------------

function UpcomingShootsPanel({ shoots, total }: { shoots: UpcomingShootCard[]; total: number }) {
  return (
    <Panel>
      <PanelTitle icon={Calendar} action={<ViewAll href="/admin/calendar" />}>
        Upcoming Shoots
      </PanelTitle>
      {shoots.length === 0 ? (
        <PanelEmpty>No shoots scheduled.</PanelEmpty>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {shoots.slice(0, 3).map((shoot) => {
            return (
              <li key={shoot.id}>
                <Link href={`/admin/projects/${shoot.id}`} className="-mx-2 flex min-w-0 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-subtle">
                  <ProjectCoverImage src={shoot.heroUrl} sizes="80px" className="h-11 w-16 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-heading">{shoot.title}</span>
                    <span className="block truncate text-xs text-muted">{shoot.service || "Shoot"}</span>
                  </span>
                  <span className="flex shrink-0 items-start gap-1.5 text-right">
                    <CalendarClock className="mt-0.5 hidden h-3.5 w-3.5 text-muted sm:block" aria-hidden />
                    <span className="text-xs leading-tight">
                      <span className="block font-medium text-heading">{shoot.dateLabel}</span>
                      <span className="block text-muted">{shoot.timeLabel}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {total > 3 ? (
        <Link href={pipelineStageHref("upcoming_shoot")} className="mt-2 block text-center text-xs font-medium text-muted hover:text-accent">
          +{total - 3} more upcoming
        </Link>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Recent messages (existing inbox API; same permissions as the Messages page)
// ---------------------------------------------------------------------------

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}

const AVATAR_TINTS = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700"];

function RecentMessagesPanel() {
  const [items, setItems] = useState<ConversationListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/messages", { credentials: "include" });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error();
        const list = (Array.isArray(body) ? body : (body?.conversations ?? [])) as ConversationListItem[];
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recent = (items ?? [])
    .slice()
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    .slice(0, 3);

  return (
    <Panel>
      <PanelTitle icon={MessageSquare} action={<ViewAll href="/admin/messages" />}>
        Recent Messages
      </PanelTitle>
      {items === null && !failed ? (
        <ul className="mt-3 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="h-9 w-9 animate-pulse rounded-full bg-slate-100 surface-dark:bg-subtle" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-1/3 animate-pulse rounded bg-slate-100 surface-dark:bg-subtle" />
                <span className="block h-3 w-2/3 animate-pulse rounded bg-slate-100 surface-dark:bg-subtle" />
              </span>
            </li>
          ))}
        </ul>
      ) : failed ? (
        <PanelEmpty>Messages could not be loaded.</PanelEmpty>
      ) : recent.length === 0 ? (
        <PanelEmpty>No client conversations yet.</PanelEmpty>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {recent.map((c, i) => {
            const unread = c.unread_count > 0;
            return (
              <li key={c.client_id}>
                <Link
                  href={`/admin/messages?client=${encodeURIComponent(c.client_id)}`}
                  className="-mx-2 flex min-w-0 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-subtle"
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", AVATAR_TINTS[i % AVATAR_TINTS.length])}>
                    {initials(c.client_name || c.client_email || "?")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-baseline justify-between gap-2">
                      <span className={cn("truncate text-[13px] text-heading", unread ? "font-bold" : "font-semibold")}>
                        {c.client_name || c.client_email}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted">{formatRelativeTime(c.last_message_at)}</span>
                    </span>
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", unread ? "text-heading" : "text-muted")}>
                        {c.last_sender_role === "admin" ? "You: " : ""}
                        {c.last_message}
                      </span>
                      {unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label={`${c.unread_count} unread`} /> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Quick actions (existing create flows)
// ---------------------------------------------------------------------------

function QuickActionsPanel() {
  const router = useRouter();
  const { navCreate } = useAdminCapabilities();
  const [composeOpen, setComposeOpen] = useState(false);

  const actions: { label: string; icon: LucideIcon; href?: string; onClick?: () => void; show: boolean }[] = [
    { label: "New Project", icon: FolderPlus, href: "/admin/projects/new", show: navCreate.project },
    { label: "Upload Media", icon: CloudUpload, href: "/admin/media?upload=1", show: navCreate.media },
    { label: "New Client", icon: UserPlus, href: "/admin/clients/new", show: navCreate.client },
    { label: "Send Message", icon: MessageSquarePlus, onClick: () => setComposeOpen(true), show: true },
  ];
  const btn =
    "flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2 text-center text-[13px] font-semibold text-heading transition hover:border-accent/40 hover:bg-accent-subtle hover:text-accent";

  return (
    <Panel className="md:col-span-2 xl:col-span-1">
      <PanelTitle icon={Zap}>Quick Actions</PanelTitle>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {actions
          .filter((a) => a.show)
          .map((a) => {
            const Icon = a.icon;
            const inner = (
              <>
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <span className="truncate">{a.label}</span>
              </>
            );
            return a.href ? (
              <Link key={a.label} href={a.href} className={btn}>
                {inner}
              </Link>
            ) : (
              <button key={a.label} type="button" onClick={a.onClick} className={btn}>
                {inner}
              </button>
            );
          })}
      </div>
      <ComposeMessageModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={(clientId) => {
          setComposeOpen(false);
          router.push(`/admin/messages?client=${encodeURIComponent(clientId)}`);
        }}
      />
    </Panel>
  );
}
