/**
 * Reporting ranges in the analytics timezone (ANALYTICS_REPORTING_TZ, default
 * America/Chicago). Ranges are [from, to) in UTC instants that map to whole local days.
 */

export const DEFAULT_REPORTING_TZ = "America/Chicago";
export const RANGE_PRESETS = ["today", "7d", "30d", "90d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type ReportRange = {
  preset: RangePreset;
  tz: string;
  /** Local calendar days, inclusive (YYYY-MM-DD). */
  startDay: string;
  endDay: string;
  from: Date;
  to: Date;
  days: string[];
  label: string;
};

export function reportingTimeZone(): string {
  const tz = process.env.ANALYTICS_REPORTING_TZ?.trim() || DEFAULT_REPORTING_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_REPORTING_TZ;
  }
}

/** YYYY-MM-DD of an instant in `tz`. */
export function localDay(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - instant.getTime();
}

/** UTC instant of local midnight for `day` in `tz` (DST-safe). */
export function startOfLocalDay(day: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  t = guess - tzOffsetMs(new Date(t), tz);
  return new Date(t);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function build(preset: RangePreset, startDay: string, endDay: string, tz: string, label: string): ReportRange {
  return {
    preset,
    tz,
    startDay,
    endDay,
    from: startOfLocalDay(startDay, tz),
    to: startOfLocalDay(addDays(endDay, 1), tz),
    days: daysBetween(startDay, endDay),
    label,
  };
}

export function parseReportRange(
  params: { range?: string | null; from?: string | null; to?: string | null },
  now = new Date(),
  tz = reportingTimeZone()
): ReportRange {
  const today = localDay(now, tz);
  const preset = (RANGE_PRESETS as readonly string[]).includes(params.range ?? "") ? (params.range as RangePreset) : "30d";
  if (preset === "custom" && params.from && params.to && DAY_RE.test(params.from) && DAY_RE.test(params.to)) {
    let [a, b] = [params.from, params.to].sort() as [string, string];
    if (b > today) b = today;
    if (a > b) a = b;
    if (daysBetween(a, b).length >= 400) a = addDays(b, -365);
    return build("custom", a, b, tz, `${a} – ${b}`);
  }
  if (preset === "today") return build("today", today, today, tz, "Today");
  const n = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  return build(preset === "custom" ? "30d" : preset, addDays(today, -(n - 1)), today, tz, `Last ${n} days`);
}

/** The equal-length period immediately before `r`. */
export function previousRange(r: ReportRange): ReportRange {
  const len = r.days.length;
  const endDay = addDays(r.startDay, -1);
  const startDay = addDays(endDay, -(len - 1));
  return build(r.preset, startDay, endDay, r.tz, "Previous period");
}

export function inRange(iso: string | null | undefined, r: { from: Date; to: Date }): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t >= r.from.getTime() && t < r.to.getTime();
}
