/**
 * Instant Booking — pure logic checks (no database, no network).
 * Run: npm run test:instant-booking
 */
import assert from "node:assert/strict";
import {
  bookingSettingsError,
  combinedDuration,
  defaultBookingSettings,
  mergeBookingSettings,
  travelTiersError,
} from "../src/lib/booking/settings";
import {
  evaluateStart,
  mergeSlotsAcrossStaff,
  qualificationFit,
  rankStaffForStart,
  slotsForStaff,
  sortSlots,
  type EngineInput,
  type EngineStaff,
} from "../src/lib/booking/engine";
import { addDaysToKey, zonedInstant, zonedParts } from "../src/lib/booking/time";
import { decideServiceArea, priceTravel } from "../src/lib/booking/travel-pricing";
import { buildEventText, renderEventTemplate } from "../src/lib/booking/event-template";
import { openBookingToken, sealBookingToken } from "../src/lib/booking/token";
import { reminderDecision, reminderWhen } from "../src/lib/booking/reminder-rules";
import { parseAddressComponents } from "../src/lib/places";
import { shootMinutes, shootWeekSegment } from "../src/lib/calendar-week";
import { usTimeZoneFor } from "../src/lib/us-time-zones";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

const TZ = "America/Chicago";
const MIN = 60_000;
// Tuesday 2030-04-16 in Chicago.
const DAY = "2030-04-16";
const at = (hhmm: string, day = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedInstant(day, h * 60 + m, TZ);
};

const settings = defaultBookingSettings();
const drive: Record<string, number> = {
  "base→property": 25,
  "property→base": 25,
  "a→property": 18,
  "property→a": 18,
  "b→property": 24,
  "property→b": 24,
  "base→a": 20,
};
function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    timeZone: TZ,
    nowMs: at("06:00", "2030-04-10"),
    rules: { ...settings, slotIntervalMinutes: 30 },
    durationMinutes: 90,
    bufferBeforeMinutes: 15,
    bufferAfterMinutes: 15,
    propertyAddress: "property",
    travelMinutes: (from, to) => drive[`${from}→${to}`] ?? null,
    unknownTravelMinutes: 30,
    ...overrides,
  };
}
function staff(overrides: Partial<EngineStaff> = {}): EngineStaff {
  return {
    userId: "u1",
    name: "Ryan",
    workingHours: settings.workingHours,
    maxShootsPerDay: 6,
    baseAddress: "base",
    appointments: [],
    busy: [],
    weights: settings.assignmentWeights,
    fitScore: 1,
    ...overrides,
  };
}

console.log("time");
test("zonedInstant round-trips wall clock (CDT)", () => {
  const ms = at("10:00");
  const p = zonedParts(ms, TZ);
  assert.equal(p.dayKey, DAY);
  assert.equal(p.minuteOfDay, 600);
  assert.equal(new Date(ms).toISOString(), "2030-04-16T15:00:00.000Z");
});
test("zonedInstant handles standard time (CST)", () => {
  assert.equal(new Date(zonedInstant("2030-01-15", 600, TZ)).toISOString(), "2030-01-15T16:00:00.000Z");
});
test("addDaysToKey crosses months", () => assert.equal(addDaysToKey("2030-01-31", 1), "2030-02-01"));

console.log("settings");
test("merge never throws and clamps", () => {
  const m = mergeBookingSettings({ mode: "bogus", minNoticeMinutes: -5, bufferBeforeMinutes: "20", workingHours: [1, 2] });
  assert.equal(m.mode, "off");
  assert.equal(m.minNoticeMinutes, 0);
  assert.equal(m.bufferBeforeMinutes, 20);
  assert.equal(m.workingHours.length, 7);
});
test("invalid tiers are rejected on save", () => {
  assert.ok(travelTiersError([{ fromMiles: 0, toMiles: 10, feeCents: 0 }, { fromMiles: 12, toMiles: null, feeCents: 100 }]));
  assert.equal(travelTiersError(settings.travel.tiers), null);
  assert.ok(bookingSettingsError({ travel: { model: "tiers", tiers: [{ fromMiles: 5, toMiles: null, feeCents: 0 }] } }));
});
test("enabling booking requires a working day", () => {
  const closed = settings.workingHours.map((d) => ({ ...d, enabled: false }));
  assert.ok(bookingSettingsError({ mode: "optional", workingHours: closed }));
});
test("combined duration: sum + adjustments, longest", () => {
  const s = { combineDurations: "sum" as const, setupMinutes: 10, interServiceBufferMinutes: 5, durationPercentAdd: 0 };
  assert.equal(combinedDuration([{ durationMinutes: 90, bufferMinutes: 0 }, { durationMinutes: 30, bufferMinutes: 10 }], s).durationMinutes, 135);
  assert.equal(
    combinedDuration([{ durationMinutes: 90, bufferMinutes: 0 }, { durationMinutes: 30, bufferMinutes: 0 }], { ...s, combineDurations: "longest", setupMinutes: 0 }).durationMinutes,
    90
  );
  assert.equal(combinedDuration([{ durationMinutes: 60, bufferMinutes: 0 }], { ...s, setupMinutes: 0, durationPercentAdd: 10 }).durationMinutes, 70);
});

console.log("engine");
test("empty day: first slot at opening (travel before hours allowed)", () => {
  const slots = slotsForStaff(input(), staff(), [DAY]);
  assert.equal(slots[0].start, at("08:00"));
  // 90 min shoot must finish by 18:00 → last start 16:30
  assert.equal(slots[slots.length - 1].start, at("16:30"));
});
test("start-of-day rule pushes first slot by drive + margin + buffer", () => {
  const rules = { ...settings, startOfDayRule: "travel_within_hours" as const };
  const slots = slotsForStaff(input({ rules }), staff(), [DAY]);
  // 08:00 + 25 drive + 10 margin + 15 buffer = 08:50 → next 30-min step 09:00
  assert.equal(slots[0].start, at("09:00"));
});
test("weekend is closed by default", () => {
  assert.equal(slotsForStaff(input(), staff(), ["2030-04-20"]).length, 0);
});
test("existing appointment blocks overlap and requires drive time", () => {
  const appt = { id: "x", projectId: "p", start: at("10:00"), end: at("11:30"), bufferBefore: 15, bufferAfter: 15, address: "a" };
  const s = staff({ appointments: [appt] });
  const ev1 = evaluateStart(input(), s, at("11:30"));
  assert.ok(ev1.violations.includes("conflict_appointment"));
  // Leaves 11:45, +18 drive +10 margin = 12:13 must be ≤ start − 15 → start ≥ 12:28 → 12:30 ok, 12:00 not.
  assert.ok(evaluateStart(input(), s, at("12:00")).violations.includes("travel_from_previous"));
  assert.ok(evaluateStart(input(), s, at("12:30")).ok);
  // Before it: end+15 +18 +10 ≤ 09:45 → end ≤ 09:02 → start ≤ 07:32 → outside hours.
  assert.ok(evaluateStart(input(), s, at("08:00")).violations.includes("travel_to_next"));
});
test("google busy time blocks", () => {
  const s = staff({ busy: [{ start: at("13:00"), end: at("14:00") }] });
  assert.ok(evaluateStart(input(), s, at("12:00")).violations.includes("conflict_calendar"));
  assert.ok(evaluateStart(input(), s, at("14:30")).ok);
});
test("another client's hold says so (not 'Google Calendar')", () => {
  const s = staff({ busy: [{ start: at("13:00"), end: at("14:00"), kind: "hold" }] });
  const v = evaluateStart(input(), s, at("12:30")).violations;
  assert.ok(v.includes("conflict_hold"));
  assert.ok(!v.includes("conflict_calendar"));
});
test("max shoots per day closes the day", () => {
  const appt = { id: "x", projectId: "p", start: at("08:00"), end: at("09:00"), bufferBefore: 0, bufferAfter: 0, address: "a" };
  assert.equal(slotsForStaff(input(), staff({ maxShootsPerDay: 1, appointments: [appt] }), [DAY]).length, 0);
});
test("minimum notice", () => {
  const now = at("09:00");
  const ev = evaluateStart(input({ nowMs: now }), staff(), at("10:30"));
  assert.ok(ev.violations.includes("too_soon"));
  assert.ok(evaluateStart(input({ nowMs: now }), staff(), at("11:00")).ok);
});
test("return travel inside hours when disallowed outside", () => {
  const rules = { ...settings, allowReturnTravelOutsideHours: false };
  // 16:30 start → 18:00 end + 15 buffer + 25 drive = 18:40 > 18:00
  assert.ok(evaluateStart(input({ rules }), staff(), at("16:30")).violations.includes("end_of_day_travel"));
  assert.ok(evaluateStart(input({ rules }), staff(), at("15:30")).ok);
});
test("unknown drive time uses the conservative fallback", () => {
  const ev = evaluateStart(input({ travelMinutes: () => null }), staff(), at("08:00"));
  assert.equal(ev.travelInMinutes, 30);
});
test("calendar unavailable is never bookable", () => {
  assert.ok(evaluateStart(input(), staff({ calendarUnavailable: true }), at("10:00")).violations.includes("calendar_unavailable"));
});

console.log("team");
test("any-photographer merge gives each time to the cheaper person", () => {
  const near = staff({ userId: "near", baseAddress: "a" }); // a→property 18
  const far = staff({ userId: "far", baseAddress: "b" }); // b→property 24
  const merged = mergeSlotsAcrossStaff([slotsForStaff(input(), far, [DAY]), slotsForStaff(input(), near, [DAY])]);
  assert.ok(merged.length > 0);
  assert.ok(merged.every((s) => s.userId === "near"));
});
test("workload weighs in ranking", () => {
  const appt = { id: "x", projectId: "p", start: at("08:00"), end: at("08:30"), bufferBefore: 0, bufferAfter: 0, address: "base" };
  const busy = staff({ userId: "busy", appointments: [appt, { ...appt, id: "y", start: at("16:00"), end: at("16:30") }], weights: { distance: 0, workload: 100, fit: 0 } });
  const free = staff({ userId: "free", weights: { distance: 0, workload: 100, fit: 0 } });
  const ranked = rankStaffForStart(input(), [busy, free], at("11:00"));
  assert.equal(ranked[0].staff.userId, "free");
});
test("qualification fit", () => {
  assert.equal(qualificationFit(["s1"], ["s1", "s2"]).qualified, false);
  assert.equal(qualificationFit([], ["s1"]).qualified, true);
  assert.ok(qualificationFit(["s1"], ["s1"]).score > qualificationFit(["s1", "s2", "s3", "s4"], ["s1"]).score);
});
test("optimized sort puts least driving first", () => {
  const sorted = sortSlots(
    [
      { start: 1, end: 2, userId: "a", travelInMinutes: 0, travelOutMinutes: 0, cost: 0.5 },
      { start: 2, end: 3, userId: "a", travelInMinutes: 0, travelOutMinutes: 0, cost: 0.1 },
    ],
    "optimized"
  );
  assert.equal(sorted[0].start, 2);
});

console.log("travel pricing");
const pricing = settings.travel;
test("per-mile beyond free miles", () => {
  const q = priceTravel(40, { ...pricing, model: "per_mile", freeMiles: 15, perMileCents: 75 });
  assert.equal(q.feeCents, 1875);
  assert.equal(q.outcome, "fee");
  const rt = priceTravel(40, { ...pricing, model: "per_mile", freeMiles: 15, perMileCents: 75, roundTrip: true });
  assert.equal(rt.feeCents, 3750);
});
test("tiers", () => {
  assert.equal(priceTravel(10, { ...pricing, model: "tiers" }).feeCents, 0);
  assert.equal(priceTravel(20, { ...pricing, model: "tiers" }).feeCents, 2500);
  assert.equal(priceTravel(80, { ...pricing, model: "tiers" }).feeCents, 5000);
});
test("no fee model and cap", () => {
  assert.equal(priceTravel(80, { ...pricing, model: "none" }).outcome, "disabled");
  assert.equal(priceTravel(80, { ...pricing, model: "per_mile", freeMiles: 0, perMileCents: 100, maxFeeCents: 5000 }).outcome, "over_cap");
});
test("service area: outside requires quote", () => {
  const s = { serviceRadiusEnabled: true, serviceRadiusMiles: 40, outsideAreaBehavior: "allow" as const };
  assert.deepEqual(decideServiceArea({ oneWayMiles: 30, settings: s, servicesRequireQuote: false }), { inside: true });
  const allow = decideServiceArea({ oneWayMiles: 50, settings: s, servicesRequireQuote: false });
  assert.equal(allow.inside, false);
  assert.equal(!allow.inside && allow.behavior, "allow");
  const quote = decideServiceArea({ oneWayMiles: 50, settings: s, servicesRequireQuote: true });
  assert.equal(!quote.inside && quote.requiresQuote, true);
  assert.deepEqual(decideServiceArea({ oneWayMiles: 500, settings: { ...s, serviceRadiusEnabled: false }, servicesRequireQuote: true }), { inside: true });
});

console.log("calendar events");
test("templates render known fields and keep unknown tokens", () => {
  const values = {
    property_address: "1234 Maple Grove Dr",
    client_name: "Emily",
    client_phone: "",
    client_email: "",
    project_name: "Maple",
    services: "Photos",
    photographer: "Ryan",
    duration_minutes: 135,
    business_name: "Studio",
  };
  assert.equal(renderEventTemplate("Shoot: {property_address} ({duration}) {nope}", values), "Shoot: 1234 Maple Grove Dr (2 hr 15 min) {nope}");
  const text = buildEventText({ settings: settings.events, values, projectUrl: "https://x.test/admin/projects/1", pending: false });
  assert.equal(text.summary, "Shoot: 1234 Maple Grove Dr");
  assert.ok(text.description.includes("https://x.test/admin/projects/1"));
  assert.equal(text.location, "1234 Maple Grove Dr");
});

console.log("reminders");
test("reminder goes out once the lead time is reached, not before", () => {
  const r = { enabled: true, leadHours: 24, notifyClient: true, notifyPhotographer: true };
  const start = Date.UTC(2026, 10, 26, 15, 0);
  const created = start - 5 * 24 * 3600_000;
  assert.equal(reminderDecision({ startMs: start, createdMs: created, nowMs: start - 25 * 3600_000 }, r), "not_due");
  assert.equal(reminderDecision({ startMs: start, createdMs: created, nowMs: start - 24 * 3600_000 }, r), "send");
  assert.equal(reminderDecision({ startMs: start, createdMs: created, nowMs: start - 2 * 3600_000 }, r), "send");
});
test("shoots booked inside the window skip the reminder", () => {
  const r = { enabled: true, leadHours: 24, notifyClient: true, notifyPhotographer: true };
  const start = Date.UTC(2026, 10, 26, 15, 0);
  assert.equal(reminderDecision({ startMs: start, createdMs: start - 3 * 3600_000, nowMs: start - 2 * 3600_000 }, r), "skip_booked_late");
  assert.equal(reminderDecision({ startMs: start, createdMs: start - 48 * 3600_000, nowMs: start + 60_000 }, r), "skip_booked_late");
});
test("reminders off, or no recipients, never send", () => {
  const start = Date.UTC(2026, 10, 26, 15, 0);
  const args = { startMs: start, createdMs: start - 5 * 24 * 3600_000, nowMs: start - 3600_000 };
  assert.equal(reminderDecision(args, { enabled: false, leadHours: 24, notifyClient: true, notifyPhotographer: true }), "disabled");
  assert.equal(reminderDecision(args, { enabled: true, leadHours: 24, notifyClient: false, notifyPhotographer: false }), "disabled");
});
test("reminder wording uses the business time zone", () => {
  const tz = "America/Chicago";
  const start = Date.UTC(2026, 10, 26, 16, 0); // 10:00 AM CST
  assert.equal(reminderWhen(start, Date.UTC(2026, 10, 25, 17, 0), tz), "tomorrow at 10:00 AM");
  assert.equal(reminderWhen(start, Date.UTC(2026, 10, 26, 13, 0), tz), "today at 10:00 AM");
  assert.equal(reminderWhen(start, Date.UTC(2026, 10, 24, 17, 0), tz), "Thu, Nov 26 at 10:00 AM");
});
test("reminder settings merge and reject unknown lead times", () => {
  const merged = mergeBookingSettings({ reminders: { enabled: false, leadHours: 7, notifyClient: false } });
  assert.equal(merged.reminders.enabled, false);
  assert.equal(merged.reminders.leadHours, 24);
  assert.equal(merged.reminders.notifyClient, false);
  assert.equal(merged.reminders.notifyPhotographer, true);
  assert.equal(mergeBookingSettings({ reminders: { leadHours: 48 } }).reminders.leadHours, 48);
});

console.log("address autocomplete");
test("Google address components become street / city / state / ZIP", () => {
  const a = parseAddressComponents(
    [
      { longText: "26994", shortText: "26994", types: ["street_number"] },
      { longText: "Spyglass Drive", shortText: "Spyglass Dr", types: ["route"] },
      { longText: "Unit 4", shortText: "4", types: ["subpremise"] },
      { longText: "Orange Beach", shortText: "Orange Beach", types: ["locality", "political"] },
      { longText: "Alabama", shortText: "AL", types: ["administrative_area_level_1", "political"] },
      { longText: "36561", shortText: "36561", types: ["postal_code"] },
      { longText: "United States", shortText: "US", types: ["country", "political"] },
    ],
    "26994 Spyglass Dr #4, Orange Beach, AL 36561, USA"
  );
  assert.equal(a.street, "26994 Spyglass Dr #4");
  assert.equal(a.city, "Orange Beach");
  assert.equal(a.state, "AL");
  assert.equal(a.zip, "36561");
  assert.equal(a.formatted, `${a.street}, Orange Beach, AL 36561`);
});
test("missing components fall back to Google's formatted address", () => {
  const a = parseAddressComponents([], "County Rd 6, Gulf Shores, AL 36542, USA");
  assert.equal(a.street, "County Rd 6");
  assert.equal(a.formatted, "County Rd 6, Gulf Shores, AL 36542");
});

console.log("calendar");
test("calendar blocks use the booked end time, not a fixed hour", () => {
  const seg = shootWeekSegment("2026-11-20T20:00:00.000Z", "America/Chicago", "2026-11-20T22:00:00.000Z")!;
  assert.equal(seg.startMin, 14 * 60);
  assert.equal(seg.endMin, 16 * 60);
  assert.equal(shootWeekSegment("2026-11-20T20:00:00.000Z", "America/Chicago")!.endMin, 15 * 60);
  assert.equal(shootMinutes("2026-11-20T20:00:00.000Z", "2026-11-20T19:00:00.000Z"), 60);
});
test("business time zone from the address", () => {
  assert.equal(usTimeZoneFor("AL"), "America/Chicago");
  assert.equal(usTimeZoneFor("fl", -87.2), "America/Chicago"); // Pensacola
  assert.equal(usTimeZoneFor("FL", -81.4), "America/New_York"); // Orlando
  assert.equal(usTimeZoneFor("TN", -86.8), "America/Chicago"); // Nashville
  assert.equal(usTimeZoneFor("ZZ"), null);
});
test("team colors keep valid hex per team member only", () => {
  const id = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
  const merged = mergeBookingSettings({ teamColors: { [id]: "#16A34A", "not-a-user": "#000000", ["48ef9959-23c6-4555-9827-5cae51fff3a7"]: "red" } });
  assert.deepEqual(merged.teamColors, { [id]: "#16A34A" });
});

console.log("token");
test("booking token seals, opens, and expires", () => {
  process.env.PLATFORM_SESSION_SECRET ||= "test-secret-for-verify-script";
  const t = sealBookingToken({ businessId: "b", clientId: "c", projectId: "p" });
  assert.equal(openBookingToken(t)?.p, "p");
  assert.equal(openBookingToken(t, Date.now() + 100 * 24 * 3600 * 1000), null);
  assert.equal(openBookingToken(t.slice(0, -2) + "xx"), null);
});

console.log(`\n${passed} checks passed.`);
