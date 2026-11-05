/**
 * Command Center business analytics — pure aggregation, date bucketing, and chart colors.
 *
 * No I/O and no server-only imports: this module is imported by the loader
 * (dashboard-analytics-server.ts), the API route, the "use client" chart components,
 * and scripts/verify-dashboard-analytics.ts.
 *
 * Money is integer cents. Calendar days are YYYY-MM-DD in the business timezone
 * (settings.workflow.businessDefaults.timezone).
 *
 * Metric definitions (also shown in the UI):
 *   Payments received — payments rows with status 'paid', on paid_at (updated_at when
 *     paid_at is missing). Each row is one charge, so deposits and balances (partial
 *     payments) count on the day each was paid. Refunds are subtracted on the refund
 *     date. Bank (ACH) payments still 'processing' are not counted until they settle.
 *     The card fee a client pays on top (client_fee_cents) is excluded.
 *   Invoices issued — payment requests (payments rows) on their created date, excluding
 *     drafts and requests that were cancelled or expired (those are voided and re-issued
 *     as a new request, so counting them would bill the same amount twice). Quotes and
 *     estimates are not counted: their amounts reach revenue through payment requests.
 *   New requests — client-submitted requests (leads rows) created in the range.
 *   New projects — projects created in the range (any source).
 *   Avg revenue per paid project — net payments received in the range ÷ distinct
 *     projects whose net payments in the range are above zero.
 */

import { deriveBrandTheme } from "@/lib/brand-color";

export type AnalyticsGrouping = "daily" | "weekly" | "monthly";
export type RevenueView = "payments" | "invoices";

export const ANALYTICS_GROUPINGS: AnalyticsGrouping[] = ["daily", "weekly", "monthly"];
export const DASHBOARD_ANALYTICS_DEFAULT_DAYS = 30;
/** Longest selectable range. Keeps every query and the daily series bounded. */
export const DASHBOARD_ANALYTICS_MAX_DAYS = 1096;
export const DEFAULT_ANALYTICS_TIMEZONE = "America/New_York";
export const NO_SERVICE_KEY = "__none__";
export const OTHER_SERVICE_KEY = "__other__";

export const AVG_PER_PAID_PROJECT_DEFINITION =
  "Net payments received in this range ÷ projects with net payments above $0 in this range.";

/** Payment statuses that are not an issued, billable request. */
const NOT_ISSUED_STATUSES = new Set(["draft", "cancelled", "expired"]);

// ---------------------------------------------------------------------------
// Calendar days and timezones
// ---------------------------------------------------------------------------

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DAY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

function dayToUtcMs(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

function utcMsToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return utcMsToDay(dayToUtcMs(day) + n * 86_400_000);
}

/** Inclusive day count from `from` to `to`. */
export function dayCount(from: string, to: string): number {
  return Math.round((dayToUtcMs(to) - dayToUtcMs(from)) / 86_400_000) + 1;
}

export function enumerateDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function safeTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || !tz.trim()) return DEFAULT_ANALYTICS_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz.trim() });
    return tz.trim();
  } catch {
    return DEFAULT_ANALYTICS_TIMEZONE;
  }
}

/** One formatter per timezone (not per business). Formatting carries no tenant data. */
const DAY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const PARTS_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(tz: string): Intl.DateTimeFormat {
  let f = DAY_FORMATTERS.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    DAY_FORMATTERS.set(tz, f);
  }
  return f;
}

/** Calendar day (YYYY-MM-DD) of an instant in `tz`. */
export function zonedDay(iso: string | number | Date, tz: string): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  const parts = dayFormatter(tz).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function tzOffsetMs(utcMs: number, tz: string): number {
  let f = PARTS_FORMATTERS.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    PARTS_FORMATTERS.set(tz, f);
  }
  const parts = f.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The UTC instant of local midnight at the start of `day` in `tz` (DST-safe). */
export function zonedMidnightUtc(day: string, tz: string): Date {
  const guess = dayToUtcMs(day);
  let ms = guess - tzOffsetMs(guess, tz);
  const second = guess - tzOffsetMs(ms, tz);
  if (second !== ms) ms = second;
  return new Date(ms);
}

export function todayInZone(tz: string, now: Date = new Date()): string {
  return zonedDay(now, tz);
}

export type AnalyticsRange = { from: string; to: string };

export function defaultAnalyticsRange(tz: string, now: Date = new Date()): AnalyticsRange {
  const to = todayInZone(tz, now);
  return { from: addDays(to, -(DASHBOARD_ANALYTICS_DEFAULT_DAYS - 1)), to };
}

export type ParsedRange = { ok: true; range: AnalyticsRange } | { ok: false; error: string };

/** Validates a From/To pair. Missing values fall back to the default 30-day range. */
export function parseAnalyticsRange(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
  tz: string,
  now: Date = new Date()
): ParsedRange {
  const fallback = defaultAnalyticsRange(tz, now);
  const from = fromRaw ? fromRaw.trim() : fallback.from;
  const to = toRaw ? toRaw.trim() : fallback.to;
  if (!isIsoDay(from) || !isIsoDay(to)) return { ok: false, error: "Dates must be YYYY-MM-DD." };
  if (from > to) return { ok: false, error: "From must be on or before To." };
  if (dayCount(from, to) > DASHBOARD_ANALYTICS_MAX_DAYS) {
    return { ok: false, error: `Choose a range of ${DASHBOARD_ANALYTICS_MAX_DAYS} days or less.` };
  }
  return { ok: true, range: { from, to } };
}

/** UTC instants bounding the range: [start, end). */
export function rangeBoundsUtc(range: AnalyticsRange, tz: string): { start: string; end: string } {
  return {
    start: zonedMidnightUtc(range.from, tz).toISOString(),
    end: zonedMidnightUtc(addDays(range.to, 1), tz).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface AnalyticsPaymentRow {
  id: string;
  business_id: string;
  project_id: string;
  /** Cents, excluding any client-paid card fee. */
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  /** Project soft-deleted: excluded, same as the operational cards. */
  project_deleted?: boolean;
}

export interface AnalyticsRefundRow {
  business_id: string;
  payment_id: string;
  project_id: string;
  amount: number;
  refunded_at: string;
  project_deleted?: boolean;
}

export interface AnalyticsProjectRow {
  id: string;
  business_id: string;
  created_at: string;
  /** Every service associated with the project. Empty = no service set. */
  service_keys: string[];
  deleted?: boolean;
}

export interface AnalyticsLeadRow {
  id: string;
  business_id: string;
  created_at: string;
  deleted?: boolean;
}

export interface AnalyticsServiceDef {
  key: string;
  label: string;
  order?: number;
}

export interface DashboardAnalyticsInput {
  businessId: string;
  range: AnalyticsRange;
  timeZone: string;
  payments: AnalyticsPaymentRow[];
  refunds: AnalyticsRefundRow[];
  /** False when the data source cannot report refunds (shown as a note in the UI). */
  refundsTracked: boolean;
  projects: AnalyticsProjectRow[];
  leads: AnalyticsLeadRow[];
  services: AnalyticsServiceDef[];
}

export interface ServiceSlice {
  key: string;
  label: string;
  count: number;
  /** Share of service associations (0–1). */
  share: number;
  /** For the "Other" slice: the services grouped into it. */
  members?: { label: string; count: number }[];
}

export interface ServiceBreakdown {
  slices: ServiceSlice[];
  uniqueProjects: number;
  associations: number;
  configuredServices: number;
}

export interface DashboardAnalytics {
  range: AnalyticsRange;
  timeZone: string;
  days: string[];
  revenue: { payments: number[]; invoices: number[] };
  newProjects: number[];
  summary: {
    paymentsNetCents: number;
    paymentsGrossCents: number;
    refundsCents: number;
    paymentCount: number;
    refundCount: number;
    invoicesCents: number;
    invoiceCount: number;
    newRequests: number;
    newProjects: number;
    paidProjects: number;
    avgPerPaidProjectCents: number | null;
  };
  services: ServiceBreakdown;
  refundsTracked: boolean;
  /** Rows dropped because they belonged to another business. Always 0 when queries are scoped. */
  foreignRowsDropped: number;
}

export function paymentReceivedAt(p: Pick<AnalyticsPaymentRow, "paid_at" | "updated_at">): string {
  return p.paid_at || p.updated_at;
}

export function isIssuedPaymentStatus(status: string): boolean {
  return !NOT_ISSUED_STATUSES.has(status);
}

export function aggregateDashboardAnalytics(input: DashboardAnalyticsInput): DashboardAnalytics {
  const tz = safeTimeZone(input.timeZone);
  const { from, to } = input.range;
  const days = enumerateDays(from, to);
  const index = new Map(days.map((d, i) => [d, i]));
  const slot = (iso: string) => index.get(zonedDay(iso, tz));

  let foreign = 0;
  const own = <T extends { business_id: string }>(rows: T[]): T[] =>
    rows.filter((r) => {
      if (r.business_id === input.businessId) return true;
      foreign++;
      return false;
    });

  const paymentsReceived = new Array<number>(days.length).fill(0);
  const invoicesIssued = new Array<number>(days.length).fill(0);
  const newProjects = new Array<number>(days.length).fill(0);
  const netByProject = new Map<string, number>();

  let gross = 0;
  let refunded = 0;
  let paymentCount = 0;
  let refundCount = 0;
  let invoicesCents = 0;
  let invoiceCount = 0;

  const seenPayments = new Set<string>();
  for (const p of own(input.payments)) {
    if (seenPayments.has(p.id)) continue;
    seenPayments.add(p.id);
    if (p.project_deleted) continue;
    const amount = Math.max(0, Math.round(Number(p.amount) || 0));

    if (p.status === "paid") {
      const i = slot(paymentReceivedAt(p));
      if (i !== undefined) {
        paymentsReceived[i]! += amount;
        gross += amount;
        paymentCount++;
        netByProject.set(p.project_id, (netByProject.get(p.project_id) ?? 0) + amount);
      }
    }

    if (isIssuedPaymentStatus(p.status)) {
      const i = slot(p.created_at);
      if (i !== undefined) {
        invoicesIssued[i]! += amount;
        invoicesCents += amount;
        invoiceCount++;
      }
    }
  }

  for (const r of own(input.refunds)) {
    if (r.project_deleted) continue;
    const i = slot(r.refunded_at);
    if (i === undefined) continue;
    const amount = Math.max(0, Math.round(Number(r.amount) || 0));
    paymentsReceived[i]! -= amount;
    refunded += amount;
    refundCount++;
    netByProject.set(r.project_id, (netByProject.get(r.project_id) ?? 0) - amount);
  }

  const projectsInRange: AnalyticsProjectRow[] = [];
  const seenProjects = new Set<string>();
  for (const p of own(input.projects)) {
    if (p.deleted || seenProjects.has(p.id)) continue;
    const i = slot(p.created_at);
    if (i === undefined) continue;
    seenProjects.add(p.id);
    newProjects[i]! += 1;
    projectsInRange.push(p);
  }

  let newRequests = 0;
  const seenLeads = new Set<string>();
  for (const l of own(input.leads)) {
    if (l.deleted || seenLeads.has(l.id)) continue;
    if (slot(l.created_at) === undefined) continue;
    seenLeads.add(l.id);
    newRequests++;
  }

  const net = gross - refunded;
  const paidProjects = [...netByProject.values()].filter((v) => v > 0).length;

  return {
    range: { from, to },
    timeZone: tz,
    days,
    revenue: { payments: paymentsReceived, invoices: invoicesIssued },
    newProjects,
    summary: {
      paymentsNetCents: net,
      paymentsGrossCents: gross,
      refundsCents: refunded,
      paymentCount,
      refundCount,
      invoicesCents,
      invoiceCount,
      newRequests,
      newProjects: projectsInRange.length,
      paidProjects,
      avgPerPaidProjectCents: paidProjects > 0 ? Math.round(net / paidProjects) : null,
    },
    services: buildServiceBreakdown(projectsInRange, input.services),
    refundsTracked: input.refundsTracked,
    foreignRowsDropped: foreign,
  };
}

/**
 * Counts service associations. A project with several services counts once per
 * service (percentages are of associations); a project with none counts under
 * "No service set". Many small services are grouped into "Other".
 */
export function buildServiceBreakdown(
  projects: Pick<AnalyticsProjectRow, "id" | "service_keys">[],
  services: AnalyticsServiceDef[],
  opts: { maxNamed?: number; minShare?: number } = {}
): ServiceBreakdown {
  const maxNamed = opts.maxNamed ?? 5;
  const minShare = opts.minShare ?? 0.04;
  const defs = new Map(services.map((s, i) => [s.key, { label: s.label, order: s.order ?? i }]));
  const counts = new Map<string, number>();
  const unique = new Set<string>();

  for (const p of projects) {
    unique.add(p.id);
    const keys = [...new Set((p.service_keys ?? []).filter(Boolean))];
    if (!keys.length) keys.push(NO_SERVICE_KEY);
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const associations = [...counts.values()].reduce((a, b) => a + b, 0);
  const labelFor = (k: string) => (k === NO_SERVICE_KEY ? "No service set" : defs.get(k)?.label ?? k);
  const orderFor = (k: string) => (k === NO_SERVICE_KEY ? Number.MAX_SAFE_INTEGER : defs.get(k)?.order ?? Number.MAX_SAFE_INTEGER - 1);

  const sorted = [...counts.entries()]
    .map(([key, count]) => ({ key, label: labelFor(key), count, share: associations ? count / associations : 0 }))
    .sort((a, b) => b.count - a.count || orderFor(a.key) - orderFor(b.key) || a.label.localeCompare(b.label));

  let named = sorted.filter((s, i) => i < maxNamed && s.share >= minShare);
  let rest = sorted.filter((s) => !named.includes(s));
  // "Other" with a single service is just that service under a vaguer name.
  if (rest.length === 1) {
    named = sorted;
    rest = [];
  }

  const slices: ServiceSlice[] = named.map((s) => ({ ...s }));
  if (rest.length) {
    const count = rest.reduce((a, s) => a + s.count, 0);
    slices.push({
      key: OTHER_SERVICE_KEY,
      label: `Other (${rest.length})`,
      count,
      share: associations ? count / associations : 0,
      members: rest.map((s) => ({ label: s.label, count: s.count })),
    });
  }

  return {
    slices,
    uniqueProjects: unique.size,
    associations,
    configuredServices: services.length,
  };
}

// ---------------------------------------------------------------------------
// Bucketing (grouping changes only how days are combined, never the range)
// ---------------------------------------------------------------------------

export interface AnalyticsBucket {
  key: string;
  start: string;
  end: string;
  /** Short axis label. */
  label: string;
  /** Tooltip title: the full period, clipped to the selected range. */
  title: string;
  /** Inclusive index range into the daily series. */
  first: number;
  last: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return { y: y!, m: m!, d: d!, dow: new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() };
}

export function formatShortDay(day: string): string {
  const p = parts(day);
  return `${MONTHS[p.m - 1]} ${p.d}`;
}

export function formatLongDay(day: string): string {
  const p = parts(day);
  return `${WEEKDAYS[p.dow]}, ${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

export function formatDayRange(start: string, end: string): string {
  if (start === end) return formatLongDay(start);
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y) return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
  return `${MONTHS[a.m - 1]} ${a.d}, ${a.y} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
}

/** Weeks start on Monday. Partial first/last periods are clipped to the range. */
export function buildBuckets(days: string[], grouping: AnalyticsGrouping): AnalyticsBucket[] {
  const out: AnalyticsBucket[] = [];
  const multiYear = days.length > 0 && days[0]!.slice(0, 4) !== days[days.length - 1]!.slice(0, 4);
  days.forEach((day, i) => {
    let key: string;
    if (grouping === "daily") key = day;
    else if (grouping === "weekly") {
      const dow = parts(day).dow;
      key = addDays(day, -((dow + 6) % 7));
    } else key = day.slice(0, 7);

    const prev = out[out.length - 1];
    if (prev && prev.key === key) {
      prev.end = day;
      prev.last = i;
      return;
    }
    out.push({ key, start: day, end: day, label: "", title: "", first: i, last: i });
  });

  for (const b of out) {
    if (grouping === "daily") {
      b.label = formatShortDay(b.start);
      b.title = formatLongDay(b.start);
    } else if (grouping === "weekly") {
      b.label = formatShortDay(b.start);
      b.title = `Week of ${formatDayRange(b.start, b.end)}`;
    } else {
      const p = parts(b.start);
      const monthStart = `${b.key}-01`;
      const monthEnd = addDays(`${p.m === 12 ? p.y + 1 : p.y}-${String((p.m % 12) + 1).padStart(2, "0")}-01`, -1);
      b.label = multiYear ? `${MONTHS[p.m - 1]} ${String(p.y).slice(2)}` : MONTHS[p.m - 1]!;
      const full = `${MONTHS_LONG[p.m - 1]} ${p.y}`;
      b.title = b.start === monthStart && b.end === monthEnd ? full : `${full} (${formatDayRange(b.start, b.end)})`;
    }
  }
  return out;
}

export function sumIntoBuckets(values: number[], buckets: AnalyticsBucket[]): number[] {
  return buckets.map((b) => {
    let s = 0;
    for (let i = b.first; i <= b.last; i++) s += values[i] ?? 0;
    return s;
  });
}

/** Default grouping for a range length: daily up to ~3 months, then weekly, then monthly. */
export function suggestedGrouping(days: number): AnalyticsGrouping {
  if (days <= 92) return "daily";
  if (days <= 366) return "weekly";
  return "monthly";
}

// ---------------------------------------------------------------------------
// Colors (brand-derived)
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

function parseColor(value: string): Rgb | null {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((n) => Math.min(255, n)) as Rgb;
  return null;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function luminance(rgb: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

export function contrastAgainstWhite(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 1;
  return 1.05 / (luminance(rgb) + 0.05);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}

function distance(a: Rgb, b: Rgb): number {
  // "Redmean" weighted RGB distance: cheap and close enough to perceptual for picking.
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** Darken (in HSL lightness) until the color clears `min` contrast against white. */
function fitOnWhite(rgb: Rgb, min: number): Rgb {
  const [h, s, l0] = rgbToHsl(rgb);
  let l = l0;
  let cur = rgb;
  for (let i = 0; i < 40 && 1.05 / (luminance(cur) + 0.05) < min; i++) {
    l = Math.max(0, l - 0.025);
    cur = hslToRgb(h, s, l);
  }
  return cur.map((n) => Math.round(n)) as Rgb;
}

export interface AnalyticsPalette {
  revenue: string;
  projects: string;
  /** Text color on a revenue / projects fill (metric cards). */
  revenueForeground: string;
  projectsForeground: string;
  /** True when the two brand colors are too close to tell apart: New Projects is drawn dashed. */
  projectsDashed: boolean;
  /** Ordered colors for service slices (named slices take them in order). */
  services: string[];
  other: string;
}

/**
 * Chart colors from the business's brand. Revenue = primary, New Projects = accent,
 * both as the admin theme renders them (contrast-fitted against white cards).
 * Service colors start from the brand colors and fan out around the accent hue,
 * skipping candidates too close to one already chosen.
 */
export function analyticsPalette(primaryColor: string, accentColor: string, count = 6): AnalyticsPalette {
  const theme = deriveBrandTheme(primaryColor, accentColor, "light");
  const primary = parseColor(theme.primary) ?? [15, 23, 42];
  const accent = parseColor(theme.accent) ?? [79, 70, 229];
  const projectsDashed = distance(primary, accent) < 90;

  const [ha, sa] = rgbToHsl(accent);
  const [hp, sp] = rgbToHsl(primary);
  const baseHue = sa >= 0.15 ? ha : sp >= 0.15 ? hp : 220;
  const sat = Math.min(0.78, Math.max(0.45, sa >= 0.15 ? sa : sp >= 0.15 ? sp : 0.5));

  const candidates: Rgb[] = [accent, primary];
  candidates.push(fitOnWhite(hslToRgb(baseHue, sat, 0.62), 2));
  for (const offset of [40, -40, 80, -80, 140, -140, 180, 20, -20, 110, -110]) {
    for (const l of [0.45, 0.6]) candidates.push(fitOnWhite(hslToRgb(baseHue + offset, sat, l), 2));
  }

  const chosen: Rgb[] = [];
  for (const minDist of [110, 80, 55, 0]) {
    for (const c of candidates) {
      if (chosen.length >= count) break;
      if (chosen.some((x) => distance(x, c) < minDist || toHex(x) === toHex(c))) continue;
      chosen.push(c);
    }
    if (chosen.length >= count) break;
  }

  return {
    revenue: toHex(primary),
    projects: toHex(accent),
    revenueForeground: theme.primaryForeground,
    projectsForeground: theme.accentForeground,
    projectsDashed,
    services: chosen.map(toHex),
    other: "#94A3B8",
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers shared by the chart and the summary row
// ---------------------------------------------------------------------------

export function formatCents(cents: number, opts: { compact?: boolean } = {}): string {
  const dollars = cents / 100;
  if (opts.compact && Math.abs(dollars) >= 1000) {
    return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
  }
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
    minimumFractionDigits: cents % 100 ? 2 : 0,
  });
}

/** "Nice" axis maximum and tick step for 4 intervals. */
export function niceAxis(max: number, intervals = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: intervals, step: 1 };
  const rough = max / intervals;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const n = rough / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  let step = nice * pow;
  if (step < 1 && Number.isInteger(max)) step = 1;
  return { max: step * intervals, step };
}
