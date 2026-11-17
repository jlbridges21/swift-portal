/**
 * Instant Booking settings — stored in business_settings.settings.booking (JSON).
 * Pure: no network, no database. Every load path goes through `mergeBookingSettings`,
 * so a malformed stored value can never break settings or the booking flow.
 */

export type BookingMode = "off" | "optional" | "required";
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

/** "HH:MM" 24-hour wall clock in the business time zone. */
export type WallTime = string;

export type DayHours = { enabled: boolean; start: WallTime; end: WallTime };
/** Index 0 = Sunday … 6 = Saturday. */
export type WeeklyHours = DayHours[];

export type StartOfDayRule = "travel_before_hours" | "travel_within_hours";
export type EndOfDayRule = "finish_by_close" | "start_before_close";
export type SlotSort = "chronological" | "optimized";
export type CalendarStrategy = "shared" | "individual";
export type OutsideAreaBehavior = "custom_quote" | "request_only" | "allow";
export type TravelFeeModel = "per_mile" | "tiers" | "none";
export type TravelPricingOrigin = "business" | "assigned_staff";

export type AssignmentWeights = {
  /** 0–100. How much a shorter drive matters. */
  distance: number;
  /** 0–100. How much a lighter schedule matters. */
  workload: number;
  /** 0–100. How much a closer service match matters. */
  fit: number;
};

export type TravelFeeTier = {
  fromMiles: number;
  /** Null on the last tier = "and beyond". */
  toMiles: number | null;
  feeCents: number;
};

export type TravelPricingSettings = {
  model: TravelFeeModel;
  /** Per-mile: miles included before charging (one-way). */
  freeMiles: number;
  perMileCents: number;
  /** Per-mile: charge the round trip (there and back). */
  roundTrip: boolean;
  tiers: TravelFeeTier[];
  /** 0 = no cap. */
  maxFeeCents: number;
  origin: TravelPricingOrigin;
};

export type EventTemplateSettings = {
  titleTemplate: string;
  descriptionTemplate: string;
  includeProjectLink: boolean;
  includeAddressAsLocation: boolean;
  inviteClient: boolean;
  inviteAssignedStaff: boolean;
};

export type BookingSettings = {
  mode: BookingMode;
  /** Google calendar ids whose busy times block availability (business-level). */
  blockCalendarIds: string[];
  /** Google calendar confirmed shoots are written to. Empty = the connected calendar. */
  destinationCalendarId: string;
  calendarStrategy: CalendarStrategy;
  workingHours: WeeklyHours;
  minNoticeMinutes: number;
  bookingWindowDays: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  maxShootsPerDay: number;
  slotIntervalMinutes: number;
  slotSort: SlotSort;
  travelSafetyMarginMinutes: number;
  startOfDayRule: StartOfDayRule;
  endOfDayRule: EndOfDayRule;
  allowReturnTravelOutsideHours: boolean;
  serviceRadiusEnabled: boolean;
  serviceRadiusMiles: number;
  outsideAreaBehavior: OutsideAreaBehavior;
  allowClientReschedule: boolean;
  rescheduleNoticeHours: number;
  allowClientCancel: boolean;
  cancelNoticeHours: number;
  /** Combined duration of several services: sum, or the longest one. */
  combineDurations: "sum" | "longest";
  setupMinutes: number;
  interServiceBufferMinutes: number;
  durationPercentAdd: number;
  /** Team: clients may pick a specific photographer. */
  clientChoosesStaff: boolean;
  /** Team: show unavailable photographers (greyed) when the client chooses. */
  showUnavailableStaff: boolean;
  assignmentWeights: AssignmentWeights;
  events: EventTemplateSettings;
  travel: TravelPricingSettings;
};

export const DEFAULT_WORKING_HOURS: WeeklyHours = [
  { enabled: false, start: "08:00", end: "18:00" },
  { enabled: true, start: "08:00", end: "18:00" },
  { enabled: true, start: "08:00", end: "18:00" },
  { enabled: true, start: "08:00", end: "18:00" },
  { enabled: true, start: "08:00", end: "18:00" },
  { enabled: true, start: "08:00", end: "18:00" },
  { enabled: false, start: "08:00", end: "18:00" },
];

export const DEFAULT_TRAVEL_FEE_TIERS: TravelFeeTier[] = [
  { fromMiles: 0, toMiles: 15, feeCents: 0 },
  { fromMiles: 15, toMiles: 30, feeCents: 2500 },
  { fromMiles: 30, toMiles: null, feeCents: 5000 },
];

export const EVENT_TEMPLATE_FIELDS = [
  { token: "{property_address}", label: "Property address" },
  { token: "{client_name}", label: "Client name" },
  { token: "{client_phone}", label: "Client phone" },
  { token: "{client_email}", label: "Client email" },
  { token: "{project_name}", label: "Project name" },
  { token: "{services}", label: "Services" },
  { token: "{photographer}", label: "Photographer" },
  { token: "{duration}", label: "Duration" },
  { token: "{business_name}", label: "Business name" },
] as const;

export function defaultBookingSettings(): BookingSettings {
  return {
    mode: "off",
    blockCalendarIds: [],
    destinationCalendarId: "",
    calendarStrategy: "shared",
    workingHours: DEFAULT_WORKING_HOURS.map((d) => ({ ...d })),
    minNoticeMinutes: 120,
    bookingWindowDays: 60,
    bufferBeforeMinutes: 15,
    bufferAfterMinutes: 15,
    maxShootsPerDay: 6,
    slotIntervalMinutes: 30,
    slotSort: "chronological",
    travelSafetyMarginMinutes: 10,
    startOfDayRule: "travel_before_hours",
    endOfDayRule: "finish_by_close",
    allowReturnTravelOutsideHours: true,
    serviceRadiusEnabled: false,
    serviceRadiusMiles: 40,
    outsideAreaBehavior: "custom_quote",
    allowClientReschedule: true,
    rescheduleNoticeHours: 24,
    allowClientCancel: true,
    cancelNoticeHours: 24,
    combineDurations: "sum",
    setupMinutes: 0,
    interServiceBufferMinutes: 0,
    durationPercentAdd: 0,
    clientChoosesStaff: false,
    showUnavailableStaff: false,
    assignmentWeights: { distance: 80, workload: 50, fit: 80 },
    events: {
      titleTemplate: "Shoot: {property_address}",
      descriptionTemplate: "Real estate media shoot\n\nClient: {client_name}\nServices: {services}\nPhotographer: {photographer}",
      includeProjectLink: true,
      includeAddressAsLocation: true,
      inviteClient: false,
      inviteAssignedStaff: true,
    },
    travel: {
      model: "none",
      freeMiles: 15,
      perMileCents: 75,
      roundTrip: false,
      tiers: DEFAULT_TRAVEL_FEE_TIERS.map((t) => ({ ...t })),
      maxFeeCents: 0,
      origin: "business",
    },
  };
}

// ── parsing helpers ────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min: number, max: number, integer = true): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(max, Math.max(min, n));
  return integer ? Math.round(clamped) : clamped;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function str(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

const WALL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isWallTime(value: unknown): value is WallTime {
  return typeof value === "string" && WALL_TIME.test(value);
}

export function wallTimeToMinutes(value: WallTime): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToWallTime(minutes: number): WallTime {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function mergeWeeklyHours(raw: unknown, fallback: WeeklyHours = DEFAULT_WORKING_HOURS): WeeklyHours {
  if (!Array.isArray(raw) || raw.length !== 7) return fallback.map((d) => ({ ...d }));
  return raw.map((day, i) => {
    const base = fallback[i];
    if (!isRecord(day)) return { ...base };
    const start = isWallTime(day.start) ? day.start : base.start;
    const end = isWallTime(day.end) ? day.end : base.end;
    const valid = wallTimeToMinutes(end) > wallTimeToMinutes(start);
    return {
      enabled: bool(day.enabled, base.enabled) && valid,
      start: valid ? start : base.start,
      end: valid ? end : base.end,
    };
  });
}

function mergeTiers(raw: unknown): TravelFeeTier[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_TRAVEL_FEE_TIERS.map((t) => ({ ...t }));
  const tiers: TravelFeeTier[] = [];
  for (const row of raw.slice(0, 12)) {
    if (!isRecord(row)) continue;
    const fromMiles = num(row.fromMiles, NaN, 0, 5000, false);
    const toMiles = row.toMiles == null || row.toMiles === "" ? null : num(row.toMiles, NaN, 0, 5000, false);
    const feeCents = num(row.feeCents, NaN, 0, 10_000_000);
    if (!Number.isFinite(fromMiles) || !Number.isFinite(feeCents) || (toMiles !== null && !Number.isFinite(toMiles))) continue;
    tiers.push({ fromMiles, toMiles, feeCents });
  }
  return travelTiersError(tiers) ? DEFAULT_TRAVEL_FEE_TIERS.map((t) => ({ ...t })) : tiers;
}

export function mergeAssignmentWeights(raw: unknown, fallback: AssignmentWeights): AssignmentWeights {
  const r = isRecord(raw) ? raw : {};
  return {
    distance: num(r.distance, fallback.distance, 0, 100),
    workload: num(r.workload, fallback.workload, 0, 100),
    fit: num(r.fit, fallback.fit, 0, 100),
  };
}

/** Load path: never throws. Unknown or invalid values fall back to defaults field by field. */
export function mergeBookingSettings(stored: unknown): BookingSettings {
  const d = defaultBookingSettings();
  if (!isRecord(stored)) return d;
  const s = stored;
  const ev = isRecord(s.events) ? s.events : {};
  const tr = isRecord(s.travel) ? s.travel : {};
  const blockIds = Array.isArray(s.blockCalendarIds)
    ? [...new Set(s.blockCalendarIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0))].slice(0, 20)
    : d.blockCalendarIds;
  return {
    mode: oneOf(s.mode, ["off", "optional", "required"] as const, d.mode),
    blockCalendarIds: blockIds,
    destinationCalendarId: str(s.destinationCalendarId, d.destinationCalendarId, 300),
    calendarStrategy: oneOf(s.calendarStrategy, ["shared", "individual"] as const, d.calendarStrategy),
    workingHours: mergeWeeklyHours(s.workingHours),
    minNoticeMinutes: num(s.minNoticeMinutes, d.minNoticeMinutes, 0, 60 * 24 * 30),
    bookingWindowDays: num(s.bookingWindowDays, d.bookingWindowDays, 1, 365),
    bufferBeforeMinutes: num(s.bufferBeforeMinutes, d.bufferBeforeMinutes, 0, 240),
    bufferAfterMinutes: num(s.bufferAfterMinutes, d.bufferAfterMinutes, 0, 240),
    maxShootsPerDay: num(s.maxShootsPerDay, d.maxShootsPerDay, 1, 50),
    slotIntervalMinutes: [15, 30, 60].includes(Number(s.slotIntervalMinutes)) ? Number(s.slotIntervalMinutes) : 30,
    slotSort: oneOf(s.slotSort, ["chronological", "optimized"] as const, d.slotSort),
    travelSafetyMarginMinutes: num(s.travelSafetyMarginMinutes, d.travelSafetyMarginMinutes, 0, 120),
    startOfDayRule: oneOf(s.startOfDayRule, ["travel_before_hours", "travel_within_hours"] as const, d.startOfDayRule),
    endOfDayRule: oneOf(s.endOfDayRule, ["finish_by_close", "start_before_close"] as const, d.endOfDayRule),
    allowReturnTravelOutsideHours: bool(s.allowReturnTravelOutsideHours, d.allowReturnTravelOutsideHours),
    serviceRadiusEnabled: bool(s.serviceRadiusEnabled, d.serviceRadiusEnabled),
    serviceRadiusMiles: num(s.serviceRadiusMiles, d.serviceRadiusMiles, 1, 1000),
    outsideAreaBehavior: oneOf(s.outsideAreaBehavior, ["custom_quote", "request_only", "allow"] as const, d.outsideAreaBehavior),
    allowClientReschedule: bool(s.allowClientReschedule, d.allowClientReschedule),
    rescheduleNoticeHours: num(s.rescheduleNoticeHours, d.rescheduleNoticeHours, 0, 24 * 14),
    allowClientCancel: bool(s.allowClientCancel, d.allowClientCancel),
    cancelNoticeHours: num(s.cancelNoticeHours, d.cancelNoticeHours, 0, 24 * 14),
    combineDurations: oneOf(s.combineDurations, ["sum", "longest"] as const, d.combineDurations),
    setupMinutes: num(s.setupMinutes, d.setupMinutes, 0, 240),
    interServiceBufferMinutes: num(s.interServiceBufferMinutes, d.interServiceBufferMinutes, 0, 120),
    durationPercentAdd: num(s.durationPercentAdd, d.durationPercentAdd, 0, 100),
    clientChoosesStaff: bool(s.clientChoosesStaff, d.clientChoosesStaff),
    showUnavailableStaff: bool(s.showUnavailableStaff, d.showUnavailableStaff),
    assignmentWeights: mergeAssignmentWeights(s.assignmentWeights, d.assignmentWeights),
    events: {
      titleTemplate: str(ev.titleTemplate, d.events.titleTemplate, 200).trim() || d.events.titleTemplate,
      descriptionTemplate: str(ev.descriptionTemplate, d.events.descriptionTemplate, 4000),
      includeProjectLink: bool(ev.includeProjectLink, d.events.includeProjectLink),
      includeAddressAsLocation: bool(ev.includeAddressAsLocation, d.events.includeAddressAsLocation),
      inviteClient: bool(ev.inviteClient, d.events.inviteClient),
      inviteAssignedStaff: bool(ev.inviteAssignedStaff, d.events.inviteAssignedStaff),
    },
    travel: {
      model: oneOf(tr.model, ["per_mile", "tiers", "none"] as const, d.travel.model),
      freeMiles: num(tr.freeMiles, d.travel.freeMiles, 0, 1000, false),
      perMileCents: num(tr.perMileCents, d.travel.perMileCents, 0, 100_000),
      roundTrip: bool(tr.roundTrip, d.travel.roundTrip),
      tiers: mergeTiers(tr.tiers),
      maxFeeCents: num(tr.maxFeeCents, d.travel.maxFeeCents, 0, 10_000_000),
      origin: oneOf(tr.origin, ["business", "assigned_staff"] as const, d.travel.origin),
    },
  };
}

/** Why these tiers cannot be saved; null when ordered, contiguous and non-overlapping. */
export function travelTiersError(tiers: TravelFeeTier[]): string | null {
  if (!tiers.length) return "Add at least one distance tier.";
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (i === 0 && t.fromMiles !== 0) return "The first tier must start at 0 miles.";
    if (t.toMiles === null && i !== tiers.length - 1) return "Only the last tier can be open-ended (e.g. “31+ miles”).";
    if (t.toMiles !== null && t.toMiles <= t.fromMiles) return `The tier starting at ${t.fromMiles} miles must end after it starts.`;
    if (i > 0) {
      const prev = tiers[i - 1];
      if (prev.toMiles === null) return "Only the last tier can be open-ended.";
      if (t.fromMiles !== prev.toMiles) return `Tiers must connect: one ends at ${prev.toMiles} miles, the next starts at ${t.fromMiles}.`;
    }
  }
  return null;
}

/** Save path: returns a user-facing error for values a person would want to fix, else null. */
export function bookingSettingsError(raw: unknown): string | null {
  if (!isRecord(raw)) return "Booking settings must be an object.";
  const merged = mergeBookingSettings(raw);
  const tr = isRecord(raw.travel) ? raw.travel : null;
  if (tr && Array.isArray(tr.tiers) && merged.travel.model === "tiers") {
    const tiers = (tr.tiers as unknown[]).filter(isRecord).map((t) => ({
      fromMiles: Number(t.fromMiles),
      toMiles: t.toMiles == null || t.toMiles === "" ? null : Number(t.toMiles),
      feeCents: Math.round(Number(t.feeCents)),
    }));
    const error = travelTiersError(tiers);
    if (error) return error;
  }
  if (merged.mode !== "off" && !merged.workingHours.some((d) => d.enabled)) {
    return "Turn on at least one working day before enabling Instant Booking.";
  }
  return null;
}

// ── durations ──────────────────────────────────────────────────────────────

export type ServiceDuration = { durationMinutes: number; bufferMinutes: number };

/**
 * On-site duration for a set of services under the business's combine rules.
 * Rounded up to 5 minutes. Service-level buffers are added on top of the business buffers
 * (the largest service buffer is used, once).
 */
export function combinedDuration(
  services: ServiceDuration[],
  settings: Pick<BookingSettings, "combineDurations" | "setupMinutes" | "interServiceBufferMinutes" | "durationPercentAdd">
): { durationMinutes: number; serviceBufferMinutes: number } {
  if (!services.length) return { durationMinutes: 60, serviceBufferMinutes: 0 };
  const durations = services.map((s) => Math.max(5, s.durationMinutes || 60));
  let total = settings.combineDurations === "longest" ? Math.max(...durations) : durations.reduce((a, b) => a + b, 0);
  if (settings.combineDurations === "sum" && services.length > 1) {
    total += settings.interServiceBufferMinutes * (services.length - 1);
  }
  total += settings.setupMinutes;
  if (settings.durationPercentAdd > 0) total += (total * settings.durationPercentAdd) / 100;
  const rounded = Math.ceil(total / 5) * 5;
  return {
    durationMinutes: Math.min(24 * 60, rounded),
    serviceBufferMinutes: Math.max(0, ...services.map((s) => s.bufferMinutes || 0)),
  };
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  if (!r) return h === 1 ? "1 hr" : `${h} hr`;
  return `${h} hr ${r} min`;
}

export function bookingModeLabel(mode: BookingMode): string {
  return mode === "off" ? "Off" : mode === "optional" ? "Optional for client" : "Required for client";
}
