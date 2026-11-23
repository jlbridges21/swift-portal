/**
 * Availability engine. Pure and synchronous: every input (appointments, Google busy
 * times, holds, drive times) is gathered beforehand by availability-server.ts, so this
 * module is fully unit-testable. Public instant booking and manual scheduling by the
 * business both run through `evaluateStart`, so the same rules apply everywhere.
 *
 * Terms
 *  - shoot window  [start, end)                       on-site time
 *  - block window  [start − bufferBefore, end + bufferAfter)   what nothing else may overlap
 *  - travel happens between one block window and the next.
 */

import type { AssignmentWeights, BookingSettings, WeeklyHours } from "@/lib/booking/settings";
import { wallTimeToMinutes } from "@/lib/booking/settings";
import { weekdayOfKey, zonedInstant, zonedParts } from "@/lib/booking/time";

const MINUTE = 60_000;

export type BusyInterval = { start: number; end: number; label?: string; /** "hold": another client is mid-booking. */ kind?: "calendar" | "hold" };

export type EngineAppointment = {
  id: string;
  projectId: string;
  start: number;
  end: number;
  bufferBefore: number;
  bufferAfter: number;
  address: string | null;
};

export type EngineStaff = {
  userId: string;
  name: string;
  workingHours: WeeklyHours;
  maxShootsPerDay: number;
  baseAddress: string | null;
  /** Confirmed appointments for this person (the one being moved is already removed). */
  appointments: EngineAppointment[];
  /** Google busy times and other people's active holds. */
  busy: BusyInterval[];
  weights: AssignmentWeights;
  /** 0–1: how well this person's qualifications match the requested services. */
  fitScore: number;
  /** Set when this person's calendars could not be read: never offered publicly. */
  calendarUnavailable?: boolean;
};

export type EngineRules = Pick<
  BookingSettings,
  | "minNoticeMinutes"
  | "bookingWindowDays"
  | "slotIntervalMinutes"
  | "travelSafetyMarginMinutes"
  | "startOfDayRule"
  | "endOfDayRule"
  | "allowReturnTravelOutsideHours"
>;

export type EngineInput = {
  timeZone: string;
  nowMs: number;
  rules: EngineRules;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  propertyAddress: string | null;
  /** Drive minutes between two addresses; null when unknown. */
  travelMinutes: (from: string | null, to: string | null) => number | null;
  /** Used when a drive time is unknown (no Routes key, lookup failed). */
  unknownTravelMinutes: number;
};

export type SlotViolation =
  | "not_working_day"
  | "outside_hours"
  | "too_soon"
  | "too_far_ahead"
  | "max_per_day"
  | "conflict_appointment"
  | "conflict_calendar"
  | "conflict_hold"
  | "travel_from_previous"
  | "travel_to_next"
  | "start_of_day_travel"
  | "end_of_day_travel"
  | "calendar_unavailable";

export type SlotEvaluation = {
  ok: boolean;
  violations: SlotViolation[];
  start: number;
  end: number;
  travelInMinutes: number;
  travelOutMinutes: number;
  previous: EngineAppointment | null;
  next: EngineAppointment | null;
  shootsThatDay: number;
};

export type EngineSlot = {
  start: number;
  end: number;
  userId: string;
  travelInMinutes: number;
  travelOutMinutes: number;
  /** Lower is better. */
  cost: number;
};

export const VIOLATION_COPY: Record<SlotViolation, string> = {
  not_working_day: "Not a working day for this team member.",
  outside_hours: "Outside working hours.",
  too_soon: "Inside the minimum notice period.",
  too_far_ahead: "Beyond the booking window.",
  max_per_day: "This team member already has the maximum shoots that day.",
  conflict_appointment: "Overlaps another shoot (including buffers).",
  conflict_calendar: "Overlaps a busy time on a connected Google Calendar.",
  conflict_hold: "Another client is booking this time right now.",
  travel_from_previous: "Not enough drive time from the previous shoot.",
  travel_to_next: "Not enough drive time to the next shoot.",
  start_of_day_travel: "Drive from the base address would start before working hours.",
  end_of_day_travel: "Return drive would end after working hours.",
  calendar_unavailable: "This team member's Google Calendar could not be read.",
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function dayWindow(staff: EngineStaff, dayKey: string, timeZone: string) {
  const hours = staff.workingHours[weekdayOfKey(dayKey)];
  if (!hours?.enabled) return null;
  return {
    open: zonedInstant(dayKey, wallTimeToMinutes(hours.start), timeZone),
    close: zonedInstant(dayKey, wallTimeToMinutes(hours.end), timeZone),
  };
}

function appointmentsOnDay(staff: EngineStaff, dayKey: string, timeZone: string): EngineAppointment[] {
  return staff.appointments
    .filter((a) => zonedParts(a.start, timeZone).dayKey === dayKey)
    .sort((a, b) => a.start - b.start);
}

function travel(input: EngineInput, from: string | null, to: string | null): number {
  if (!from || !to) return from === to && from ? 0 : input.unknownTravelMinutes;
  if (from.trim().toLowerCase() === to.trim().toLowerCase()) return 0;
  const minutes = input.travelMinutes(from, to);
  return minutes == null ? input.unknownTravelMinutes : minutes;
}

/**
 * Check one start time for one team member. Used for slot generation, for the final
 * server-side recheck before confirming, and for manual scheduling (where violations are
 * shown as warnings an admin may override).
 */
export function evaluateStart(input: EngineInput, staff: EngineStaff, startMs: number): SlotEvaluation {
  const { rules, timeZone } = input;
  const end = startMs + input.durationMinutes * MINUTE;
  const blockStart = startMs - input.bufferBeforeMinutes * MINUTE;
  const blockEnd = end + input.bufferAfterMinutes * MINUTE;
  const dayKey = zonedParts(startMs, timeZone).dayKey;
  const violations: SlotViolation[] = [];
  const margin = rules.travelSafetyMarginMinutes * MINUTE;

  if (staff.calendarUnavailable) violations.push("calendar_unavailable");
  if (startMs < input.nowMs + rules.minNoticeMinutes * MINUTE) violations.push("too_soon");
  if (startMs > input.nowMs + rules.bookingWindowDays * 24 * 60 * MINUTE) violations.push("too_far_ahead");

  const window = dayWindow(staff, dayKey, timeZone);
  if (!window) {
    violations.push("not_working_day");
  } else {
    const endsOk = rules.endOfDayRule === "finish_by_close" ? end <= window.close : startMs < window.close;
    if (startMs < window.open || !endsOk) violations.push("outside_hours");
  }

  const dayAppointments = appointmentsOnDay(staff, dayKey, timeZone);
  if (dayAppointments.length >= staff.maxShootsPerDay) violations.push("max_per_day");

  for (const a of staff.appointments) {
    const aBlockStart = a.start - a.bufferBefore * MINUTE;
    const aBlockEnd = a.end + a.bufferAfter * MINUTE;
    if (overlaps(blockStart, blockEnd, aBlockStart, aBlockEnd)) {
      violations.push("conflict_appointment");
      break;
    }
  }
  const busyHits = staff.busy.filter((b) => overlaps(blockStart, blockEnd, b.start, b.end));
  if (busyHits.some((b) => b.kind !== "hold")) violations.push("conflict_calendar");
  if (busyHits.some((b) => b.kind === "hold")) violations.push("conflict_hold");

  let previous: EngineAppointment | null = null;
  let next: EngineAppointment | null = null;
  for (const a of dayAppointments) {
    if (a.end <= startMs) previous = a;
    else if (a.start >= end && !next) next = a;
  }

  let travelIn: number;
  if (previous) {
    travelIn = travel(input, previous.address, input.propertyAddress);
    const leaveAt = previous.end + previous.bufferAfter * MINUTE;
    if (leaveAt + travelIn * MINUTE + margin > blockStart) violations.push("travel_from_previous");
  } else {
    travelIn = travel(input, staff.baseAddress, input.propertyAddress);
    if (window && rules.startOfDayRule === "travel_within_hours" && window.open + travelIn * MINUTE + margin > blockStart) {
      violations.push("start_of_day_travel");
    }
  }

  let travelOut: number;
  if (next) {
    travelOut = travel(input, input.propertyAddress, next.address);
    const arriveBy = next.start - next.bufferBefore * MINUTE;
    if (blockEnd + travelOut * MINUTE + margin > arriveBy) violations.push("travel_to_next");
  } else {
    travelOut = travel(input, input.propertyAddress, staff.baseAddress);
    if (window && !rules.allowReturnTravelOutsideHours && blockEnd + travelOut * MINUTE > window.close) {
      violations.push("end_of_day_travel");
    }
  }

  return {
    ok: violations.length === 0,
    violations: [...new Set(violations)],
    start: startMs,
    end,
    travelInMinutes: travelIn,
    travelOutMinutes: travelOut,
    previous,
    next,
    shootsThatDay: dayAppointments.length,
  };
}

/**
 * False when the drive from this person's base to the property can never fit in any of
 * their working days (for example a property hundreds of miles away with "drive within
 * working hours"). Only judged on a known drive time, so a failed lookup never hides times.
 */
export function travelFitsAWorkingDay(input: EngineInput, staff: EngineStaff): boolean {
  const { rules } = input;
  if (!staff.baseAddress || !input.propertyAddress) return true;
  if (staff.baseAddress.trim().toLowerCase() === input.propertyAddress.trim().toLowerCase()) return true;
  const longestDay = Math.max(
    0,
    ...staff.workingHours.filter((h) => h?.enabled).map((h) => wallTimeToMinutes(h.end) - wallTimeToMinutes(h.start))
  );
  // No working days, or a shoot longer than the day, is a different problem; don't call it distance.
  if (!longestDay || input.durationMinutes > longestDay) return true;
  // Mirrors evaluateStart's day rules, in minutes from opening time.
  let earliestStart = 0;
  let distanceMatters = false;
  if (rules.startOfDayRule === "travel_within_hours") {
    const inbound = input.travelMinutes(staff.baseAddress, input.propertyAddress);
    if (inbound == null) return true;
    earliestStart = inbound + rules.travelSafetyMarginMinutes + input.bufferBeforeMinutes;
    distanceMatters = true;
  }
  const end = earliestStart + input.durationMinutes;
  let fits = rules.endOfDayRule === "finish_by_close" ? end <= longestDay : earliestStart < longestDay;
  if (!rules.allowReturnTravelOutsideHours) {
    const outbound = input.travelMinutes(input.propertyAddress, staff.baseAddress);
    if (outbound == null) return true;
    fits = fits && end + input.bufferAfterMinutes + outbound <= longestDay;
    distanceMatters = true;
  }
  return !distanceMatters || fits;
}

/** Cost of giving this slot to this person. Lower is better; 0–1. */
export function slotCost(staff: EngineStaff, evaluation: SlotEvaluation): number {
  const w = staff.weights;
  const total = w.distance + w.workload + w.fit || 1;
  const drive = Math.min(1, (evaluation.travelInMinutes + evaluation.travelOutMinutes) / 120);
  const load = Math.min(1, evaluation.shootsThatDay / Math.max(1, staff.maxShootsPerDay));
  const fit = 1 - Math.max(0, Math.min(1, staff.fitScore));
  return (w.distance * drive + w.workload * load + w.fit * fit) / total;
}

/** Every bookable start for one person on the given days. */
export function slotsForStaff(input: EngineInput, staff: EngineStaff, dayKeys: string[]): EngineSlot[] {
  const out: EngineSlot[] = [];
  const step = input.rules.slotIntervalMinutes * MINUTE;
  for (const dayKey of dayKeys) {
    const window = dayWindow(staff, dayKey, input.timeZone);
    if (!window) continue;
    if (appointmentsOnDay(staff, dayKey, input.timeZone).length >= staff.maxShootsPerDay) continue;
    for (let t = window.open; t < window.close; t += step) {
      const ev = evaluateStart(input, staff, t);
      if (!ev.ok) continue;
      out.push({
        start: t,
        end: ev.end,
        userId: staff.userId,
        travelInMinutes: ev.travelInMinutes,
        travelOutMinutes: ev.travelOutMinutes,
        cost: slotCost(staff, ev),
      });
    }
  }
  return out;
}

/**
 * "Any photographer": one slot per start time, given to the best-scoring person.
 * Ties keep the earlier person in `staff` order (stable).
 */
export function mergeSlotsAcrossStaff(perStaff: EngineSlot[][]): EngineSlot[] {
  const best = new Map<number, EngineSlot>();
  for (const list of perStaff) {
    for (const slot of list) {
      const current = best.get(slot.start);
      if (!current || slot.cost < current.cost) best.set(slot.start, slot);
    }
  }
  return [...best.values()].sort((a, b) => a.start - b.start);
}

/** Rank candidates for a fixed start time (manual scheduling and the "recommended" badge). */
export function rankStaffForStart(
  input: EngineInput,
  staff: EngineStaff[],
  startMs: number
): { staff: EngineStaff; evaluation: SlotEvaluation; cost: number }[] {
  return staff
    .map((s) => {
      const evaluation = evaluateStart(input, s, startMs);
      return { staff: s, evaluation, cost: slotCost(s, evaluation) };
    })
    .sort((a, b) => Number(b.evaluation.ok) - Number(a.evaluation.ok) || a.cost - b.cost);
}

/** Order a day's slots for display. Optimized puts the least driving first; time breaks ties. */
export function sortSlots(slots: EngineSlot[], sort: BookingSettings["slotSort"]): EngineSlot[] {
  const copy = [...slots];
  if (sort === "optimized") copy.sort((a, b) => a.cost - b.cost || a.start - b.start);
  else copy.sort((a, b) => a.start - b.start);
  return copy;
}

/** Fraction of qualifications covered: 1 when qualified for everything or no services given. */
export function qualificationFit(qualifiedServiceIds: string[], requestedServiceIds: string[]): {
  qualified: boolean;
  score: number;
} {
  if (!requestedServiceIds.length) return { qualified: true, score: 1 };
  if (!qualifiedServiceIds.length) return { qualified: true, score: 0.75 };
  const set = new Set(qualifiedServiceIds);
  const qualified = requestedServiceIds.every((id) => set.has(id));
  if (!qualified) return { qualified: false, score: 0 };
  // A specialist (few qualifications, all requested) fits better than a generalist.
  return { qualified: true, score: Math.min(1, 0.6 + 0.4 * (requestedServiceIds.length / set.size)) };
}
