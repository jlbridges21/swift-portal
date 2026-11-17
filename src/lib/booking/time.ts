/**
 * Time-zone helpers for the booking engine. Pure, Intl-only (no date library), DST-safe.
 * A "day key" is a civil date "YYYY-MM-DD" in the business time zone.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
  dayKey: string;
  minuteOfDay: number;
};

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: WEEKDAYS[get("weekday")] ?? 0,
    dayKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minuteOfDay: hour * 60 + minute,
  };
}

/** Offset (ms) of the zone from UTC at an instant: local wall clock − UTC. */
function offsetAt(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  const second = new Date(ms).getUTCSeconds();
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, second);
  return asUtc - (ms - (ms % 1000));
}

/**
 * UTC instant (ms) for a wall-clock minute on a civil date in a zone.
 * In a spring-forward gap the time is pushed forward; in a fall-back overlap the first one wins.
 */
export function zonedInstant(dayKey: string, minuteOfDay: number, timeZone: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0) + minuteOfDay * 60_000;
  const first = guess - offsetAt(guess, timeZone);
  return guess - offsetAt(first, timeZone);
}

export function addDaysToKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

export function weekdayOfKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dayKeysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let k = fromKey;
  for (let i = 0; i < 400 && k <= toKey; i++) {
    out.push(k);
    k = addDaysToKey(k, 1);
  }
  return out;
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatZoned(ms: number, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(new Date(ms));
}

export function formatTimeShort(ms: number, timeZone: string): string {
  return formatZoned(ms, timeZone, { hour: "numeric", minute: "2-digit" });
}

/** "Central Time (CT)" style label for a zone. */
export function timeZoneLabel(timeZone: string, at = Date.now()): string {
  try {
    const long = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
      .formatToParts(new Date(at))
      .find((p) => p.type === "timeZoneName")?.value;
    const short = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date(at))
      .find((p) => p.type === "timeZoneName")?.value;
    if (!long) return timeZone;
    const generic = long.replace(/ (Standard|Daylight) Time$/, " Time");
    const abbrev = short && /^[A-Z]{3,4}$/.test(short) ? `${short[0]}${short[short.length - 1]}` : null;
    return abbrev ? `${generic} (${abbrev})` : generic;
  } catch {
    return timeZone;
  }
}
