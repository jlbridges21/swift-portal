/**
 * Team pay — pure checks: pay periods, the pay calculation, statements and exports.
 * No database, no network. Run: npx tsx scripts/verify-team-pay.ts
 */
import { readFileSync } from "node:fs";
import {
  adjustmentLine,
  buildStatement,
  checkedInMinutes,
  computeShootLine,
  exampleLine,
  isLateCancel,
  lateCancelLine,
  overtimeWeeks,
  totalsOf,
} from "../src/lib/team-pay/calc";
import { buildExport, csvCell } from "../src/lib/team-pay/export";
import { addDays, formatPeriod, isDateKey, periodContaining, shiftPeriod, weekStart } from "../src/lib/team-pay/periods";
import {
  describePlan,
  driveTripLabel,
  formatCents,
  formatMileRate,
  formatMinutes,
  NEW_PLAN,
  type PayPlan,
  type ShootFacts,
  type TeamPayPerson,
} from "../src/lib/team-pay/types";

let failures = 0;
function assert(cond: unknown, label: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const plan = (patch: Partial<PayPlan> = {}): PayPlan => ({ ...NEW_PLAN, id: "plan", name: "Plan", ...patch });
const shoot = (patch: Partial<ShootFacts> = {}): ShootFacts => ({
  proposalId: "p1",
  projectId: "proj",
  userId: "u1",
  startIso: "2026-11-18T15:00:00.000Z",
  dateKey: "2026-11-18",
  plannedMinutes: 120,
  title: "9500 US-98",
  address: "9500 US-98, Pensacola, FL",
  services: [
    { id: "svc-photos", name: "Photos" },
    { id: "svc-drone", name: "Drone" },
  ],
  priceCents: 37500,
  travelFeeCents: 2500,
  drive: { inMinutes: 40, inMiles: 30, from: "home", outMinutes: 35, outMiles: 28 },
  edit: null,
  pendingRequest: null,
  upcoming: false,
  ...patch,
});
const none = { rateOverride: null };
const rules = { reviewOverMinutes: 30 };

console.log("Pay periods");
{
  const wk = periodContaining("2026-11-25", "weekly", "2026-01-04");
  assert(wk.start === "2026-11-22" && wk.end === "2026-11-28", "weekly: Sunday start from a Sunday anchor");
  const mon = periodContaining("2026-11-25", "weekly", "2026-01-05");
  assert(mon.start === "2026-11-23" && mon.end === "2026-11-29", "weekly: Monday start from a Monday anchor");
  const bi = periodContaining("2026-11-25", "biweekly", "2026-01-04");
  assert(bi.start === "2026-11-22" && bi.end === "2026-12-05", "biweekly counts from the anchor");
  assert(periodContaining("2025-12-30", "biweekly", "2026-01-04").start === "2025-12-21", "biweekly works before the anchor");
  const a = periodContaining("2026-02-10", "semimonthly", "x");
  const b = periodContaining("2026-02-20", "semimonthly", "x");
  assert(a.start === "2026-02-01" && a.end === "2026-02-15" && b.start === "2026-02-16" && b.end === "2026-02-28", "twice a month: 1–15, 16–end");
  const m = periodContaining("2028-02-10", "monthly", "x");
  assert(m.start === "2028-02-01" && m.end === "2028-02-29", "monthly handles leap February");
  const next = shiftPeriod(bi, "biweekly", "2026-01-04", 1);
  const prev = shiftPeriod(bi, "biweekly", "2026-01-04", -1);
  assert(next.start === "2026-12-06" && prev.end === "2026-11-21", "next / previous periods touch without overlap");
  assert(shiftPeriod(b, "semimonthly", "x", 1).start === "2026-03-01", "twice a month rolls into the next month");
  assert(addDays("2026-12-31", 1) === "2027-01-01" && weekStart("2026-11-25") === "2026-11-22", "date helpers");
  assert(isDateKey("2026-02-28") && !isDateKey("2026-02-30") && !isDateKey("nope"), "date keys are validated");
  assert(formatPeriod(bi) === "Nov 22 – Dec 5, 2026", "period label");
}

console.log("Pay for the shoot");
{
  const hourly = computeShootLine(shoot(), plan({ baseType: "hourly", baseRateCents: 3000 }), none, rules);
  assert(hourly.amountCents === 6000 && hourly.onsiteSource === "booked", "hourly: 2 hr × $30 = $60");
  assert(computeShootLine(shoot({ plannedMinutes: 100 }), plan({ baseRateCents: 3000 }), none, rules).amountCents === 5000, "hourly rounds to the cent (1 hr 40)");
  assert(computeShootLine(shoot(), plan({ baseRateCents: 3000 }), { rateOverride: 3500 }, rules).amountCents === 7000, "a person's own rate replaces the plan's");
  assert(computeShootLine(shoot(), plan({ baseType: "per_shoot", baseRateCents: 12000 }), none, rules).amountCents === 12000, "per shoot: flat amount");
  const svc = computeShootLine(shoot(), plan({ baseType: "per_service", serviceRates: { "svc-photos": 9000, "svc-drone": 6000 } }), none, rules);
  assert(svc.amountCents === 15000 && svc.parts.length === 2, "per service: each service's pay adds up");
  const missing = computeShootLine(shoot(), plan({ baseType: "per_service", serviceRates: {} }), none, rules);
  assert(missing.amountCents === 0 && missing.flags[0]?.code === "no_rate", "per service with no pay set is flagged");
  const pct = computeShootLine(shoot(), plan({ baseType: "percent", percent: 40 }), none, rules);
  assert(pct.amountCents === 15000, "percent: 40% of $375 (travel fee not counted)");
  assert(computeShootLine(shoot(), plan({ baseType: "percent", percent: 40 }), { rateOverride: 5000 }, rules).amountCents === 18750, "percent override is percent × 100");
  const noPrice = computeShootLine(shoot({ priceCents: null }), plan({ baseType: "percent", percent: 40 }), none, rules);
  assert(noPrice.amountCents === 0 && noPrice.flags[0]?.code === "no_price", "percent with no estimate is flagged");
}

console.log("Driving");
{
  const base = { baseType: "per_shoot" as const, baseRateCents: 10000 };
  const hour = computeShootLine(shoot(), plan({ ...base, driveType: "hour", driveHourCents: 2000 }), none, rules);
  assert(hour.driveMinutes === 75 && hour.amountCents === 10000 + 2500, "by the hour: drive in + drive home (75 min × $20)");
  const mile = computeShootLine(shoot(), plan({ ...base, driveType: "mile", mileCents: 70 }), none, rules);
  assert(mile.miles === 58 && mile.amountCents === 10000 + 4060, "by the mile: 58 mi × $0.70");
  const both = computeShootLine(shoot(), plan({ ...base, driveType: "both", driveHourCents: 2000, mileCents: 72.5 }), none, rules);
  assert(both.amountCents === 10000 + 2500 + 4205, "hours + miles, with a half-cent mile rate");
  const noHome = computeShootLine(shoot(), plan({ ...base, driveType: "mile", mileCents: 100, payDriveHome: false }), none, rules);
  assert(noHome.miles === 30 && !noHome.includesDriveHome, "drive home can be left unpaid");
  const noFirst = computeShootLine(shoot(), plan({ ...base, driveType: "mile", mileCents: 100, payFirstDrive: false }), none, rules);
  assert(noFirst.miles === 28, "the drive from home to the first shoot can be left unpaid");
  const second = computeShootLine(
    shoot({ drive: { inMinutes: 20, inMiles: 12, from: "previous", outMinutes: 0, outMiles: 0 } }),
    plan({ ...base, driveType: "mile", mileCents: 100, payFirstDrive: false }),
    none,
    rules
  );
  assert(second.miles === 12, "the drive between two shoots is always paid");
  const fee = computeShootLine(shoot(), plan({ ...base, driveType: "travel_fee" }), none, rules);
  assert(fee.amountCents === 12500 && fee.parts.some((p) => p.label === "Client's travel fee"), "travel fee: the client's fee passes through");
  assert(hour.driveLegs?.length === 2 && driveTripLabel(hour.driveLegs) === "there and back", "both legs counted: 'there and back'");
  assert(driveTripLabel(noHome.driveLegs) === "one way" && noHome.driveLegs?.[0].kind === "from_home", "drive home unpaid: 'one way' from home");
  assert(driveTripLabel(noFirst.driveLegs) === "drive home only", "first drive unpaid: 'drive home only'");
  assert(driveTripLabel(second.driveLegs) === "from last shoot", "second shoot of the day: 'from last shoot'");
  assert(driveTripLabel(undefined) === null, "no legs (old statements): no label");
  const editedDrive = computeShootLine(
    shoot({ edit: { onsiteMinutes: null, driveMinutes: 90, miles: 70, amountCents: null, note: null, arrivedAt: null, doneAt: null } }),
    plan({ ...base, driveType: "mile", mileCents: 100 }),
    none,
    rules
  );
  assert(editedDrive.driveEdited && editedDrive.miles === 70 && editedDrive.driveLegs?.length === 2, "a typed-in total is marked edited; planned legs stay for reference");
  const unknown = computeShootLine(shoot({ drive: null }), plan({ ...base, driveType: "mile", mileCents: 70 }), none, rules);
  assert(unknown.flags.some((f) => f.code === "no_drive") && unknown.amountCents === 10000, "an unknown route is flagged, never guessed");
  const notPaid = computeShootLine(shoot({ drive: null }), plan(base), none, rules);
  assert(notPaid.flags.length === 0, "no flag when driving isn't paid");
}

console.log("Minimum, corrections, check-in");
{
  const min = computeShootLine(shoot({ plannedMinutes: 30 }), plan({ baseRateCents: 3000, minPerShootCents: 5000 }), none, rules);
  assert(min.amountCents === 5000 && min.parts.length === 2, "minimum per shoot tops a short shoot up");
  const edited = computeShootLine(
    shoot({ edit: { onsiteMinutes: 190, driveMinutes: null, miles: null, amountCents: null, note: "Ran long", arrivedAt: null, doneAt: null } }),
    plan({ baseRateCents: 3000 }),
    none,
    rules
  );
  assert(edited.amountCents === 9500 && edited.onsiteSource === "edited" && edited.note === "Ran long", "the owner's time replaces the booked time");
  const fixed = computeShootLine(
    shoot({ edit: { onsiteMinutes: null, driveMinutes: null, miles: null, amountCents: 8800, note: null, arrivedAt: null, doneAt: null } }),
    plan({ baseType: "per_service", serviceRates: {} }),
    none,
    rules
  );
  assert(fixed.amountCents === 8800 && fixed.amountEdited && fixed.flags.length === 0, "a set amount wins and clears the flag");
  assert(checkedInMinutes("2026-11-18T15:00:00Z", "2026-11-18T17:10:00Z") === 130 && checkedInMinutes("x", null) === null, "check-in minutes");
  const within = computeShootLine(
    shoot({ edit: { onsiteMinutes: null, driveMinutes: null, miles: null, amountCents: null, note: null, arrivedAt: "2026-11-18T15:00:00Z", doneAt: "2026-11-18T17:20:00Z" } }),
    plan({ baseRateCents: 3000 }),
    none,
    rules
  );
  assert(within.onsiteMinutes === 140 && within.onsiteSource === "checked_in" && within.flags.length === 0, "a check-in close to the booked time is used");
  const over = computeShootLine(
    shoot({ edit: { onsiteMinutes: null, driveMinutes: null, miles: null, amountCents: null, note: null, arrivedAt: "2026-11-18T15:00:00Z", doneAt: "2026-11-18T18:10:00Z" } }),
    plan({ baseRateCents: 3000 }),
    none,
    rules
  );
  assert(over.onsiteMinutes === 120 && over.flags[0]?.code === "over_time" && over.flags[0].minutes === 190, "a long check-in waits for the owner and pays booked time meanwhile");
  const asked = computeShootLine(shoot({ pendingRequest: { id: "r1", onsiteMinutes: 150, note: null } }), plan(), none, rules);
  assert(asked.flags[0]?.code === "time_request" && asked.onsiteMinutes === 120, "a time request is flagged and doesn't change pay until approved");
}

console.log("Late cancellations and adjustments");
{
  assert(isLateCancel("2026-11-18T15:00:00Z", "2026-11-18T09:00:00Z", 24), "6 hours before counts as late (24 hr rule)");
  assert(!isLateCancel("2026-11-18T15:00:00Z", "2026-11-16T09:00:00Z", 24), "2 days before isn't late");
  assert(!isLateCancel("2026-11-18T15:00:00Z", null, 24), "no cancel time, no fee");
  assert(isLateCancel("2026-11-18T15:00:00Z", "2026-11-18T16:00:00Z", 24), "cancelled after the start is late");
  const line = lateCancelLine({ proposalId: "p9", projectId: "x", dateKey: "2026-11-18", startIso: "2026-11-18T15:00:00Z", title: "Main St", address: null }, 5000, 6);
  assert(line.kind === "late_cancel" && line.amountCents === 5000, "late cancel pays the flat fee");
  const deduction = adjustmentLine({ id: "a1", userId: "u1", dateKey: "2026-11-19", kind: "deduction", label: "Gear", amountCents: -2000 });
  assert(deduction.amountCents === -2000 && deduction.adjustmentKind === "deduction", "deductions are negative");
}

console.log("Statements");
{
  const p = plan({ baseRateCents: 3000, driveType: "mile", mileCents: 100 });
  const past = computeShootLine(shoot(), p, none, rules);
  const future = computeShootLine(shoot({ proposalId: "p2", dateKey: "2026-11-27", upcoming: true }), p, none, rules);
  const bonus = adjustmentLine({ id: "a2", userId: "u1", dateKey: "2026-11-20", kind: "bonus", label: "Great week", amountCents: 5000 });
  const totals = totalsOf([past, future, bonus]);
  assert(totals.shoots === 1 && totals.upcomingShoots === 1, "upcoming shoots are shown but not counted");
  assert(totals.amountCents === past.amountCents + 5000 && totals.adjustmentsCents === 5000, "totals add shoots and adjustments");
  const period = { start: "2026-11-22", end: "2026-12-05" };
  const running = buildStatement({ userId: "u1", period, lines: [past], workerType: "contractor", todayKey: "2026-11-25" });
  const over = buildStatement({ userId: "u1", period, lines: [past], workerType: "contractor", todayKey: "2026-12-06" });
  assert(running.status === "in_progress" && over.status === "ready", "in progress until the period ends, then ready");
  const flagged = computeShootLine(shoot({ pendingRequest: { id: "r", onsiteMinutes: 200, note: null } }), p, none, rules);
  assert(buildStatement({ userId: "u1", period, lines: [flagged], workerType: "contractor", todayKey: "2026-12-06" }).status === "to_review", "anything flagged makes it 'to review'");
  const long = Array.from({ length: 5 }, (_, i) =>
    computeShootLine(shoot({ proposalId: `w${i}`, dateKey: addDays("2026-11-23", i), plannedMinutes: 540, drive: null }), plan(), none, rules)
  );
  assert(overtimeWeeks(long).length === 1 && overtimeWeeks(long)[0].minutes === 2700, "45 hours in a week is flagged");
  assert(buildStatement({ userId: "u1", period, lines: long, workerType: "contractor", todayKey: "2026-12-06" }).overtimeWeeks.length === 0, "the 40-hour check is for employees only");
  assert(buildStatement({ userId: "u1", period, lines: long, workerType: "employee", todayKey: "2026-12-06" }).overtimeWeeks.length === 1, "employees get the 40-hour check");
}

console.log("Labels, example and exports");
{
  assert(formatCents(123456) === "$1,234.56" && formatCents(-500) === "-$5.00", "money");
  assert(formatMinutes(150) === "2 hr 30 min" && formatMinutes(45) === "45 min" && formatMinutes(120) === "2 hr", "durations");
  assert(formatMileRate(70) === "$0.70" && formatMileRate(72.5) === "$0.725", "mile rates keep half cents");
  assert(describePlan(plan({ baseRateCents: 3000, driveType: "both", driveHourCents: 2000, mileCents: 70 })) === "$30/hr on site · $20/hr driving · $0.70/mi", "plan summary");
  const ex = exampleLine(plan({ baseRateCents: 3000 }), [{ id: "s", name: "Photos" }]);
  assert(ex.amountCents === 6000, "the builder's example: 2 hr × $30");

  const contractor: TeamPayPerson = { userId: "u1", name: "Brenden H", email: "b@example.com", avatarUrl: null, role: "staff", workerType: "contractor", plan: plan(), rateOverride: null };
  const employee: TeamPayPerson = { ...contractor, userId: "u2", name: "=Maya", workerType: "employee" };
  const period = { start: "2026-11-22", end: "2026-12-05" };
  const lines = [computeShootLine(shoot(), plan({ baseRateCents: 3000 }), none, rules)];
  const st = (userId: string, workerType: "contractor" | "employee") => buildStatement({ userId, period, lines, workerType, todayKey: "2026-12-06" });
  const entries = [
    { person: contractor, statement: st("u1", "contractor") },
    { person: employee, statement: st("u2", "employee") },
  ];
  const summary = buildExport("summary", period, entries);
  assert(summary.filename === "team-pay-summary_2026-11-22_to_2026-12-05.csv" && summary.csv.split("\r\n").length === 4, "summary: a header and one row per person");
  assert(summary.csv.includes("'=Maya"), "a name that looks like a formula is neutralised");
  assert(csvCell('a "b", c') === '"a ""b"", c"' && csvCell(-5) === "-5", "CSV quoting (numbers stay numbers)");
  const bills = buildExport("quickbooks_bills", period, entries).csv;
  assert(bills.includes("Brenden H") && !bills.includes("Maya") && bills.includes("60.00"), "QuickBooks bills: contractors only");
  const time = buildExport("quickbooks_time", period, entries).csv;
  assert(time.includes("Maya") && !time.includes("Brenden") && time.includes("2.00"), "QuickBooks time: employees' hours only");
  assert(buildExport("gusto_hours", period, entries).csv.split("\r\n").length === 3, "Gusto hours: one row per employee");
  assert(buildExport("detail", period, entries).csv.includes("9500 US-98"), "detail lists each shoot");
}

console.log("Privacy and access (source checks)");
{
  const myPay = read("src/lib/team-pay/my-pay.ts");
  const meRoute = read("src/app/api/team-pay/me/route.ts");
  const mainRoute = read("src/app/api/team-pay/route.ts");
  const settingsRoute = read("src/app/api/team-pay/settings/route.ts");
  const stub = read("src/app/api/team-pay/stub/route.ts");
  assert(/onlyUserId: userId/.test(myPay) && /hideClientPrices\(mine\)/.test(myPay), "My pay only ever loads the signed-in person, with client prices hidden");
  assert(/teamPayActor\("member"/.test(meRoute) && /buildMyPay\(ctx\.businessId, ctx\.profile\.id/.test(meRoute), "My pay API uses the session's own id");
  assert(/teamPayActor\("manager"\)/.test(mainRoute) && /teamPayActor\("manager", true\)/.test(mainRoute), "review API needs the owner or the approve permission");
  assert(!/teamPayActor\("(member|manager)"/.test(settingsRoute), "pay plans and rates are owner only");
  assert(/userId !== ctx\.profile\.id && !ctx\.manager/.test(stub), "a team member can't open someone else's pay stub");
  const shell = read("src/components/admin/app-shell/admin-app-shell.tsx");
  assert(/if \(caps\.showTeamPay\)/.test(shell) && /if \(caps\.showMyPay\)/.test(shell), "sidebar items appear only when Team pay is on");
  const server = read("src/lib/team-pay/server.ts");
  assert(/select\("enabled"\)\.maybeSingle\(\)/.test(server), "the every-page visibility check is one small read when Team pay is off");
  assert(/"teampay\.approve"/.test(read("src/lib/staff-permissions.ts")) && /!k\.startsWith\("teampay\."\)/.test(read("src/lib/staff-permissions.ts")), "the approve permission exists and isn't in 'full access except money'");
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Team pay checks passed");
