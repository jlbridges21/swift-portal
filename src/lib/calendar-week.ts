/**
 * Shoot Calendar → Week: turns shoots and Google events into the blocks the shared week grid
 * lays out (business time zone, minutes after midnight). Pure and client-safe.
 */
import type { ExternalCalendarEvent } from "@/lib/google-calendar-pull";
import { SHOOT_EVENT_MINUTES, zonedDayAndMinutes } from "@/lib/projects-calendar";

export type WeekSegment = { dayKey: string; allDay: boolean; startMin: number; endMin: number; startIso: string | null };

/** A shoot is a one-hour block (same length Google sync writes), clipped at midnight. */
export function shootWeekSegment(proposedAt: string, timeZone: string): WeekSegment | null {
  const z = zonedDayAndMinutes(proposedAt, timeZone);
  if (!z) return null;
  return {
    dayKey: z.dayKey,
    allDay: false,
    startMin: z.minutes,
    endMin: Math.min(24 * 60, z.minutes + SHOOT_EVENT_MINUTES),
    startIso: proposedAt,
  };
}

/**
 * One segment per day a Google event covers. All-day events use Google's own dates (dayKeys);
 * a timed event that crosses midnight is drawn as one block per day. Wall-clock minutes in the
 * business zone, so DST days place events at the times the clock shows.
 */
export function externalEventWeekSegments(event: ExternalCalendarEvent, timeZone: string): WeekSegment[] {
  if (event.allDay) {
    return event.dayKeys.map((dayKey) => ({ dayKey, allDay: true, startMin: 0, endMin: 0, startIso: null }));
  }
  const start = zonedDayAndMinutes(event.start, timeZone);
  if (!start) return [];
  const end = event.end ? zonedDayAndMinutes(event.end, timeZone) : null;
  const dayKeys = event.dayKeys.length ? event.dayKeys : [start.dayKey];
  const out: WeekSegment[] = [];
  for (const dayKey of dayKeys) {
    const startMin = dayKey === start.dayKey ? start.minutes : 0;
    const endMin = end ? (dayKey === end.dayKey ? end.minutes : 24 * 60) : Math.min(24 * 60, startMin + 60);
    if (dayKey !== start.dayKey && endMin <= 0) continue; // ends exactly at midnight
    out.push({ dayKey, allDay: false, startMin, endMin: Math.max(startMin, endMin), startIso: dayKey === start.dayKey ? event.start : null });
  }
  return out;
}
