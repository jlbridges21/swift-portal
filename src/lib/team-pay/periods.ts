/**
 * Pay periods (pure). Dates are civil YYYY-MM-DD keys; both ends of a period are inclusive.
 */
import type { PayPeriod, PeriodType } from "./types";

const DAY_MS = 86_400_000;

function toUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toKey(ms: number): string {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && toKey(toUtc(value)) === value;
}

export function addDays(key: string, days: number): string {
  return toKey(toUtc(key) + days * DAY_MS);
}

function lastOfMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return toKey(Date.UTC(y, m, 0));
}

/** The pay period a date falls in. */
export function periodContaining(dateKey: string, type: PeriodType, anchor: string): PayPeriod {
  if (type === "monthly") return { start: `${dateKey.slice(0, 8)}01`, end: lastOfMonth(dateKey) };
  if (type === "semimonthly") {
    return Number(dateKey.slice(8)) <= 15
      ? { start: `${dateKey.slice(0, 8)}01`, end: `${dateKey.slice(0, 8)}15` }
      : { start: `${dateKey.slice(0, 8)}16`, end: lastOfMonth(dateKey) };
  }
  const length = type === "weekly" ? 7 : 14;
  const base = isDateKey(anchor) ? anchor : "2026-01-04";
  const days = Math.round((toUtc(dateKey) - toUtc(base)) / DAY_MS);
  const offset = ((days % length) + length) % length;
  const start = addDays(dateKey, -offset);
  return { start, end: addDays(start, length - 1) };
}

export function shiftPeriod(period: PayPeriod, type: PeriodType, anchor: string, direction: 1 | -1): PayPeriod {
  return periodContaining(direction === 1 ? addDays(period.end, 1) : addDays(period.start, -1), type, anchor);
}

/** Sunday of the week a date falls in (for the 40-hour check). */
export function weekStart(dateKey: string): string {
  return addDays(dateKey, -new Date(toUtc(dateKey)).getUTCDay());
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDateKey(key: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const t = new Date(toUtc(key));
  const day = `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`;
  const weekday = opts.weekday ? `${WEEKDAYS[t.getUTCDay()]} ` : "";
  return `${weekday}${day}${opts.year ? `, ${t.getUTCFullYear()}` : ""}`;
}

/** "Nov 16 – Nov 29, 2026" */
export function formatPeriod(period: PayPeriod): string {
  const sameYear = period.start.slice(0, 4) === period.end.slice(0, 4);
  return `${formatDateKey(period.start, { year: !sameYear })} – ${formatDateKey(period.end, { year: true })}`;
}

export function periodDays(period: PayPeriod): number {
  return Math.round((toUtc(period.end) - toUtc(period.start)) / DAY_MS) + 1;
}
