/**
 * Shoot Calendar Week view + progressive loading verification (no database, no network).
 * Exercises the pure placement rules (business time zone, DST, midnight-crossing Google events,
 * all-day events, overlap columns, drag snapping) and static checks on the page / loader wiring:
 * streamed sources, visible-calendar-only Google fetch, one scheduling mutation, permissions.
 *
 * Run: npx tsx scripts/verify-calendar-week.ts
 *      TZ=Asia/Tokyo npx tsx scripts/verify-calendar-week.ts   (viewer zone must not matter)
 */

import { readFileSync } from "node:fs";
import { externalEventWeekSegments, shootWeekSegment } from "../src/lib/calendar-week";
import { layoutOverlaps, snapMinutes, weekKeys, zonedDayAndMinutes, zonedTimeToIso } from "../src/lib/projects-calendar";
import type { ExternalCalendarEvent } from "../src/lib/google-calendar-pull";

let failures = 0;
function assert(cond: unknown, label: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const TZ = "America/Chicago";
const ev = (over: Partial<ExternalCalendarEvent>): ExternalCalendarEvent => ({
  id: "e1",
  title: "Event",
  calendarId: "work",
  calendarSummary: "Work",
  htmlLink: null,
  allDay: false,
  start: "2026-11-13T16:00:00.000Z",
  end: "2026-11-13T17:00:00.000Z",
  dayKeys: ["2026-11-13"],
  timeLabel: "10:00 AM – 11:00 AM",
  ...over,
});

console.log(`Placement (process TZ=${process.env.TZ || "system"})`);
{
  const s = shootWeekSegment("2026-11-09T19:45:00.000Z", TZ)!;
  assert(s.dayKey === "2026-11-09" && s.startMin === 13 * 60 + 45 && s.endMin === 14 * 60 + 45, "shoot 19:45Z → Mon 1:45–2:45 PM CST, one hour tall");
  const late = shootWeekSegment("2026-11-10T05:30:00.000Z", TZ)!;
  assert(late.dayKey === "2026-11-09" && late.startMin === 23 * 60 + 30 && late.endMin === 24 * 60, "11:30 PM shoot stays on its business-zone day, clipped at midnight");
  const g = externalEventWeekSegments(ev({}), TZ);
  assert(g.length === 1 && g[0].startMin === 600 && g[0].endMin === 660, "timed Google event placed at its start/end");
  const overnight = externalEventWeekSegments(
    ev({ start: "2026-11-14T04:00:00.000Z", end: "2026-11-14T07:00:00.000Z", dayKeys: ["2026-11-13", "2026-11-14"] }),
    TZ
  );
  assert(
    overnight.length === 2 && overnight[0].startMin === 22 * 60 && overnight[0].endMin === 1440 && overnight[1].startMin === 0 && overnight[1].endMin === 60,
    "event crossing midnight → one block per day (10 PM–midnight, midnight–1 AM)"
  );
  const toMidnight = externalEventWeekSegments(
    ev({ start: "2026-11-14T04:00:00.000Z", end: "2026-11-14T06:00:00.000Z", dayKeys: ["2026-11-13", "2026-11-14"] }),
    TZ
  );
  assert(toMidnight.length === 1 && toMidnight[0].endMin === 1440, "event ending exactly at midnight draws no empty block next day");
  const allDay = externalEventWeekSegments(
    ev({ allDay: true, start: "2026-11-12", end: "2026-11-15", dayKeys: ["2026-11-12", "2026-11-13", "2026-11-14"] }),
    TZ
  );
  assert(allDay.length === 3 && allDay.every((x) => x.allDay), "multi-day all-day event → all-day row on each day");
  const cols = layoutOverlaps([
    { startMin: 600, endMin: 660 },
    { startMin: 630, endMin: 690 },
    { startMin: 700, endMin: 720 },
  ]);
  assert(cols[0].columns === 2 && cols[1].columns === 2 && cols[2].columns === 1, "overlapping shoot + Google event share the slot side by side");
}

console.log("Daylight saving (America/Chicago)");
{
  // Fall back: Sun Nov 1 2026, 2:00 CDT → 1:00 CST.
  const before = shootWeekSegment("2026-11-01T06:30:00.000Z", TZ)!; // 1:30 CDT
  const after = shootWeekSegment("2026-11-01T07:30:00.000Z", TZ)!; // 1:30 CST
  assert(before.startMin === 90 && after.startMin === 90 && before.dayKey === "2026-11-01", "repeated 1:30 AM hour shows at 1:30 on the clock both times");
  assert(zonedTimeToIso("2026-11-01", 10 * 60, TZ) === "2026-11-01T16:00:00.000Z", "drop at 10:00 AM on fall-back day → 16:00Z (CST)");
  assert(zonedTimeToIso("2026-10-31", 10 * 60, TZ) === "2026-10-31T15:00:00.000Z", "drop at 10:00 AM the day before → 15:00Z (CDT)");
  // Spring forward: Sun Mar 14 2027, 2:00 CST → 3:00 CDT.
  assert(zonedTimeToIso("2027-03-14", 10 * 60, TZ) === "2027-03-14T15:00:00.000Z", "drop at 10:00 AM on spring-forward day → 15:00Z (CDT)");
  const gap = zonedTimeToIso("2027-03-14", 2 * 60 + 30, TZ);
  const z = zonedDayAndMinutes(gap, TZ)!;
  assert(z.dayKey === "2027-03-14" && z.minutes >= 3 * 60, "drop inside the skipped 2–3 AM hour lands just after it");
  // Moving a shoot across the DST boundary keeps its wall-clock time.
  const moved = zonedTimeToIso("2026-11-02", shootWeekSegment("2026-10-30T14:00:00.000Z", TZ)!.startMin, TZ);
  assert(zonedDayAndMinutes(moved, TZ)!.minutes === 9 * 60, "9:00 AM shoot moved across DST stays at 9:00 AM");
}

console.log("Week + drag rules");
{
  assert(weekKeys("2026-11-13").join(",") === "2026-11-08,2026-11-09,2026-11-10,2026-11-11,2026-11-12,2026-11-13,2026-11-14", "week is Sunday–Saturday");
  assert(snapMinutes(10 * 60 + 7, 60) === 10 * 60 + 15 - 15 && snapMinutes(10 * 60 + 8, 60) === 10 * 60 + 15, "drag snaps to 15 minutes");
  assert(snapMinutes(23 * 60 + 50, 60) === 23 * 60, "a one-hour shoot can't be dropped past 11 PM (duration preserved)");
}

console.log("Static wiring");
{
  const page = read("src/app/admin/calendar/page.tsx");
  const lib = read("src/lib/google-calendar.ts");
  const client = read("src/components/admin/shoot-calendar.tsx");
  const grid = read("src/components/admin/calendar/week-time-grid.tsx");
  const projects = read("src/components/admin/projects-workspace/projects-calendar.tsx");
  const events = read("src/app/api/integrations/google-calendar/events/route.ts");
  assert(!/await\s+(proposalsPromise|shootsSource|googleSource|coversSource|createProjectsSource)/.test(page), "page never awaits the streamed sources");
  assert(/shootsSource=\{shootsSource\}/.test(page) && /googleSource=\{googleSource\}/.test(page), "shoots and Google stream to the client independently");
  assert(/staffCan\(profile, "scheduling\.confirm"\) && !readOnlyImpersonation/.test(page), "drag needs scheduling.confirm and is off under read-only impersonation");
  assert(/filter\(\(id\) => !hidden\.has\(id\)\)/.test(lib), "Google events are fetched for visible (not hidden) calendars only");
  assert(/AbortSignal\.timeout/.test(lib) && /VIEW_GOOGLE_CONCURRENCY/.test(lib), "Google calls have a timeout and run in parallel (bounded)");
  assert(!/loadExternalEventsForOwner/.test(lib + page + events), "old sequential loader is gone");
  const streamed = client
    .slice(client.indexOf("function useStreamed"), client.indexOf("/** The Google fetch window"))
    .replace(/\/\/.*$/gm, "");
  assert(/source\.then\(\s*\(value\)[\s\S]*,\s*\(\) =>/.test(streamed) && !/\.catch\(|\.finally\(/.test(streamed), "streamed thenables use then(ok, err) — never .catch()/.finally()");
  assert(/canDrag: \(item\) => item\.kind === "shoot" && canReschedule/.test(client), "Google events are never draggable");
  assert(/saveShootTime/.test(client) && /saveShootTime/.test(projects), "both calendars save through the same shared mutation");
  assert(/action: "update_date"/.test(grid) && !/action: "update_date"/.test(client + projects), "the PATCH body lives in one place");
  assert(/<WeekTimeGrid/.test(client) && /<WeekTimeGrid/.test(projects) && !/function WeekGrid/.test(projects), "both Week views render the shared WeekTimeGrid");
  assert(/RescheduleConfirmModal/.test(client) && /RescheduleConfirmModal/.test(projects), "both use the shared confirmation modal");
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll calendar week checks passed");
