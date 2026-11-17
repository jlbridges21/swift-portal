/** Pure reminder timing rules (tested in scripts/verify-instant-booking.ts). */
import { addDaysToKey, formatZoned, zonedParts } from "@/lib/booking/time";
import type { ReminderSettings } from "@/lib/booking/settings";

const HOUR = 3600_000;

export type ReminderDecision = "not_due" | "send" | "skip_booked_late" | "disabled";

/** Pure: what to do with one appointment at `nowMs`. */
export function reminderDecision(
  args: { startMs: number; createdMs: number; nowMs: number },
  settings: Pick<ReminderSettings, "enabled" | "leadHours" | "notifyClient" | "notifyPhotographer">
): ReminderDecision {
  if (!settings.enabled || (!settings.notifyClient && !settings.notifyPhotographer)) return "disabled";
  const dueAt = args.startMs - settings.leadHours * HOUR;
  if (args.nowMs < dueAt) return "not_due";
  if (args.nowMs >= args.startMs) return "skip_booked_late";
  // Booked after the reminder would have gone out: the confirmation was the reminder.
  if (args.createdMs > dueAt) return "skip_booked_late";
  return "send";
}

/** "today at 10:00 AM" / "tomorrow at 10:00 AM" / "Thu, Nov 26 at 10:00 AM". */
export function reminderWhen(startMs: number, nowMs: number, timeZone: string): string {
  const time = formatZoned(startMs, timeZone, { hour: "numeric", minute: "2-digit" });
  const day = zonedParts(startMs, timeZone).dayKey;
  const today = zonedParts(nowMs, timeZone).dayKey;
  if (day === today) return `today at ${time}`;
  if (day === addDaysToKey(today, 1)) return `tomorrow at ${time}`;
  return `${formatZoned(startMs, timeZone, { weekday: "short", month: "short", day: "numeric" })} at ${time}`;
}
