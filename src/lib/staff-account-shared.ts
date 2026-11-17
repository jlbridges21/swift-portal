/**
 * Staff account Settings — shared, client-safe pieces: per-event notification choices,
 * time off and personal preferences. No server imports.
 */

import { addDaysToKey, isDayKey, zonedInstant } from "@/lib/booking/time";
import { isWallTime, wallTimeToMinutes } from "@/lib/booking/settings";

// ── per-event notifications ───────────────────────────────────────────────

export const STAFF_NOTIFICATION_EVENTS = [
  {
    key: "assigned",
    label: "Added to a project",
    hint: "When the studio adds you to a project or books a shoot with you.",
  },
  {
    key: "reminder_day_before",
    label: "Shoot reminder the day before",
    hint: "Around 5 PM the evening before each of your shoots.",
  },
  {
    key: "reminder_morning_of",
    label: "Shoot reminder the morning of",
    hint: "Around 7 AM on the day of each of your shoots.",
  },
  {
    key: "client_messages",
    label: "Client messages",
    hint: "New messages from clients on your projects.",
  },
  {
    key: "schedule_changes",
    label: "Schedule changes & cancellations",
    hint: "A shoot on your projects is booked, moved or cancelled.",
  },
  {
    key: "revisions",
    label: "Revision requests & review feedback",
    hint: "A client asks for changes or comments on a video review.",
  },
] as const;

export type StaffNotificationEventKey = (typeof STAFF_NOTIFICATION_EVENTS)[number]["key"];
export type StaffNotificationEventPrefs = Partial<Record<StaffNotificationEventKey, boolean>>;

const EVENT_KEYS = new Set<string>(STAFF_NOTIFICATION_EVENTS.map((e) => e.key));

/** Which per-event choice governs a notification type for a team member (null = always on). */
export function staffEventForNotificationType(type: string): StaffNotificationEventKey | null {
  switch (type) {
    case "project_assigned":
      return "assigned";
    case "project_message":
      return "client_messages";
    case "shoot_proposed":
    case "schedule_change_requested":
      return "schedule_changes";
    case "revision_requested":
    case "video_review_activity":
      return "revisions";
    default:
      return null;
  }
}

export function parseStaffEventPrefs(raw: unknown): StaffNotificationEventPrefs {
  const out: StaffNotificationEventPrefs = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (EVENT_KEYS.has(key) && typeof value === "boolean") out[key as StaffNotificationEventKey] = value;
  }
  return out;
}

/** Missing = on, so nobody silently loses alerts before they visit Settings. */
export function isStaffEventOn(prefs: unknown, key: StaffNotificationEventKey): boolean {
  return parseStaffEventPrefs(prefs)[key] !== false;
}

// ── time off ───────────────────────────────────────────────────────────────

export type TimeOffEntry = {
  id: string;
  /** First day off (YYYY-MM-DD, business time zone). */
  startDay: string;
  /** Last day off, inclusive. */
  endDay: string;
  /** Optional partial day (both set): only this window is blocked on each day. */
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
};

export const TIME_OFF_LIMIT = 200;

export function parseTimeOffEntry(raw: unknown): TimeOffEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isDayKey(r.startDay) || !isDayKey(r.endDay)) return null;
  const startDay = r.startDay as string;
  const endDay = (r.endDay as string) < startDay ? startDay : (r.endDay as string);
  // Cap a single entry at a year so a typo can't block someone forever.
  if (endDay > addDaysToKey(startDay, 366)) return null;
  let startTime: string | null = null;
  let endTime: string | null = null;
  if (isWallTime(r.startTime) && isWallTime(r.endTime) && wallTimeToMinutes(r.endTime) > wallTimeToMinutes(r.startTime)) {
    startTime = r.startTime;
    endTime = r.endTime;
  }
  const id = typeof r.id === "string" && /^[A-Za-z0-9_-]{4,40}$/.test(r.id) ? r.id : randomId();
  const note = typeof r.note === "string" ? r.note.trim().slice(0, 120) : "";
  return { id, startDay, endDay, startTime, endTime, note: note || null };
}

export function parseTimeOff(raw: unknown): TimeOffEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TimeOffEntry[] = [];
  for (const item of raw) {
    const entry = parseTimeOffEntry(item);
    if (entry) out.push(entry);
    if (out.length >= TIME_OFF_LIMIT) break;
  }
  return out.sort((a, b) => a.startDay.localeCompare(b.startDay) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

/** Drop entries that ended before `todayKey` (kept tidy on save). */
export function upcomingTimeOff(entries: TimeOffEntry[], todayKey: string): TimeOffEntry[] {
  return entries.filter((e) => e.endDay >= todayKey);
}

/** Time off as busy intervals (ms) for the availability engine. */
export function timeOffToBusy(
  entries: TimeOffEntry[],
  timeZone: string,
  fromMs: number,
  toMs: number
): { start: number; end: number; label: string }[] {
  const out: { start: number; end: number; label: string }[] = [];
  for (const e of entries) {
    if (e.startTime && e.endTime) {
      let day = e.startDay;
      for (let i = 0; i <= 366 && day <= e.endDay; i++, day = addDaysToKey(day, 1)) {
        const start = zonedInstant(day, wallTimeToMinutes(e.startTime), timeZone);
        const end = zonedInstant(day, wallTimeToMinutes(e.endTime), timeZone);
        if (end > fromMs && start < toMs) out.push({ start, end, label: "Time off" });
      }
    } else {
      const start = zonedInstant(e.startDay, 0, timeZone);
      const end = zonedInstant(addDaysToKey(e.endDay, 1), 0, timeZone);
      if (end > fromMs && start < toMs) out.push({ start, end, label: "Time off" });
    }
  }
  return out;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

// ── preferences ────────────────────────────────────────────────────────────

export type ThemePreference = "studio" | "light" | "dark";

export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "studio";
}

export function isValidTimeZone(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw || raw.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return true;
  } catch {
    return false;
  }
}
