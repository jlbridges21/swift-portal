/**
 * New interface Projects page — Calendar (Month / Week) helpers. Pure and client-safe.
 *
 * Every date is handled as a "yyyy-MM-dd" day key in the business time zone, so a
 * shoot lands on the same day for every viewer regardless of their browser's zone.
 */
import type { ProjectStatus } from "@/lib/constants";

/**
 * Shoots have no stored duration. Google Calendar sync writes every shoot as a
 * one-hour event (EVENT_DURATION_MS in lib/google-calendar.ts); the week grid uses the
 * same length so both calendars agree.
 */
export const SHOOT_EVENT_MINUTES = 60;

export type CalendarProjectInput = {
  id: string;
  status: ProjectStatus;
  shoot_date: string | null;
  confirmedShootAt?: string | null;
};

export type ProjectCalendarEvent<T extends CalendarProjectInput = CalendarProjectInput> = {
  project: T;
  dayKey: string;
  /** Confirmed shoot time. Date-only shoots (shoot_date without a confirmed time) are all-day. */
  allDay: boolean;
  /** Minutes after midnight (business zone); 0 for all-day events. */
  startMin: number;
  endMin: number;
  /** ISO instant for timed events, for labels. */
  startIso: string | null;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function partsFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** Day key and minutes-after-midnight of an instant in `timeZone`. */
export function zonedDayAndMinutes(iso: string | Date, timeZone: string): { dayKey: string; minutes: number } | null {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  const parts = partsFormatter(timeZone).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  return { dayKey: `${get("year")}-${get("month")}-${get("day")}`, minutes: hour * 60 + Number(get("minute")) };
}

export function todayKey(timeZone: string, now: Date = new Date()): string {
  return zonedDayAndMinutes(now, timeZone)?.dayKey ?? now.toISOString().slice(0, 10);
}

/** Build calendar events; unscheduled projects are left out (never placed on a made-up day). */
export function projectCalendarEvents<T extends CalendarProjectInput>(projects: T[], timeZone: string): ProjectCalendarEvent<T>[] {
  const events: ProjectCalendarEvent<T>[] = [];
  for (const project of projects) {
    if (project.confirmedShootAt) {
      const z = zonedDayAndMinutes(project.confirmedShootAt, timeZone);
      if (!z) continue;
      events.push({
        project,
        dayKey: z.dayKey,
        allDay: false,
        startMin: z.minutes,
        endMin: Math.min(24 * 60, z.minutes + SHOOT_EVENT_MINUTES),
        startIso: project.confirmedShootAt,
      });
    } else if (project.shoot_date && YMD.test(project.shoot_date.slice(0, 10))) {
      events.push({ project, dayKey: project.shoot_date.slice(0, 10), allDay: true, startMin: 0, endMin: 0, startIso: null });
    }
  }
  return events.sort((a, b) => a.dayKey.localeCompare(b.dayKey) || Number(b.allDay) - Number(a.allDay) || a.startMin - b.startMin);
}

export function groupEventsByDay<E extends { dayKey: string }>(events: E[]): Map<string, E[]> {
  const map = new Map<string, E[]>();
  for (const e of events) {
    const list = map.get(e.dayKey);
    if (list) list.push(e);
    else map.set(e.dayKey, [e]);
  }
  return map;
}

// ── Day-key arithmetic (UTC-based so DST never shifts a day) ────────────────

function keyToUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function utcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return utcToKey(d);
}

/** First day of the month `months` away from the month containing `key`. */
export function addMonthsKey(key: string, months: number): string {
  const d = keyToUtc(key);
  return utcToKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)));
}

export function weekdayOfKey(key: string): number {
  return keyToUtc(key).getUTCDay();
}

export function startOfWeekKey(key: string): string {
  return addDaysKey(key, -weekdayOfKey(key));
}

export function weekKeys(anchorKey: string): string[] {
  const start = startOfWeekKey(anchorKey);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
}

/** Sunday-first weeks covering the month of `anchorKey`, padded with adjacent-month days. */
export function monthGridKeys(anchorKey: string): string[][] {
  const first = `${anchorKey.slice(0, 7)}-01`;
  const d = keyToUtc(first);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = d.getUTCDay();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const start = addDaysKey(first, -lead);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => addDaysKey(start, w * 7 + i)));
}

export function sameMonthKey(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Formats a day key without the viewer's zone shifting it. */
export function formatDayKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return keyToUtc(key).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

/** "9am", "9:30am" — compact chip label in the business zone. */
export function compactTime(iso: string, timeZone: string): string {
  const s = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  return s.replace(":00", "").replace(/\s?(AM|PM)$/i, (_, p: string) => p.toLowerCase());
}

export function formatTimeRange(startIso: string, minutes: number, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const start = new Date(startIso);
  return `${fmt.format(start)} – ${fmt.format(new Date(start.getTime() + minutes * 60_000))}`;
}

// ── Week grid overlap layout ────────────────────────────────────────────────

export type PositionedEvent<E> = { event: E; column: number; columns: number };

/**
 * Side-by-side columns for overlapping timed events (Google-style): events that overlap
 * transitively form a cluster; each cluster splits its width between its columns.
 */
export function layoutOverlaps<E extends { startMin: number; endMin: number }>(events: E[]): PositionedEvent<E>[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: PositionedEvent<E>[] = [];
  let cluster: PositionedEvent<E>[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const p of cluster) p.columns = colEnds.length;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  for (const event of sorted) {
    // A zero-length event still occupies a minimum visual slot.
    const end = Math.max(event.endMin, event.startMin + 15);
    if (event.startMin >= clusterEnd && cluster.length) flush();
    let column = colEnds.findIndex((e) => e <= event.startMin);
    if (column < 0) {
      column = colEnds.length;
      colEnds.push(end);
    } else colEnds[column] = end;
    cluster.push({ event, column, columns: 0 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) flush();
  return out;
}

// ── Colors by workflow stage (same hues as the Pipeline columns) ───────────

export const CALENDAR_EVENT_STYLES: Record<ProjectStatus, { chip: string; dot: string; block: string }> = {
  new_request: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-900 hover:bg-blue-100 surface-dark:bg-blue-500/15 surface-dark:text-blue-100", block: "border-blue-500 bg-blue-50 text-blue-950 surface-dark:bg-blue-500/20 surface-dark:text-blue-50" },
  quote_sent: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-900 hover:bg-violet-100 surface-dark:bg-violet-500/15 surface-dark:text-violet-100", block: "border-violet-500 bg-violet-50 text-violet-950 surface-dark:bg-violet-500/20 surface-dark:text-violet-50" },
  proposal_approved: { dot: "bg-amber-400", chip: "bg-amber-50 text-amber-900 hover:bg-amber-100 surface-dark:bg-amber-500/15 surface-dark:text-amber-100", block: "border-amber-400 bg-amber-50 text-amber-950 surface-dark:bg-amber-500/20 surface-dark:text-amber-50" },
  scheduled: { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-900 hover:bg-sky-100 surface-dark:bg-sky-500/15 surface-dark:text-sky-100", block: "border-sky-500 bg-sky-50 text-sky-950 surface-dark:bg-sky-500/20 surface-dark:text-sky-50" },
  shoot_complete_editing: { dot: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-900 hover:bg-indigo-100 surface-dark:bg-indigo-500/15 surface-dark:text-indigo-100", block: "border-indigo-500 bg-indigo-50 text-indigo-950 surface-dark:bg-indigo-500/20 surface-dark:text-indigo-50" },
  ready_for_review: { dot: "bg-pink-500", chip: "bg-pink-50 text-pink-900 hover:bg-pink-100 surface-dark:bg-pink-500/15 surface-dark:text-pink-100", block: "border-pink-500 bg-pink-50 text-pink-950 surface-dark:bg-pink-500/20 surface-dark:text-pink-50" },
  awaiting_payment: { dot: "bg-orange-500", chip: "bg-orange-50 text-orange-900 hover:bg-orange-100 surface-dark:bg-orange-500/15 surface-dark:text-orange-100", block: "border-orange-500 bg-orange-50 text-orange-950 surface-dark:bg-orange-500/20 surface-dark:text-orange-50" },
  delivered: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-900 hover:bg-emerald-100 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-100", block: "border-emerald-500 bg-emerald-50 text-emerald-950 surface-dark:bg-emerald-500/20 surface-dark:text-emerald-50" },
};
