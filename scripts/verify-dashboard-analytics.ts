/**
 * Command Center business analytics verification (no database, no network).
 * Exercises the pure aggregator with fixtures: partial payments, refunds, payments vs
 * invoices views, multi-service projects, "Other" grouping, timezone/DST day bucketing,
 * daily/weekly/monthly re-bucketing, range parsing, brand palette, and tenant isolation
 * (foreign rows dropped + static checks on the loader and API route).
 *
 * Run: npx tsx scripts/verify-dashboard-analytics.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateDashboardAnalytics,
  drilldownAttributions,
  moveColumn,
  normalizeColumnPrefs,
  parseServiceKeysParam,
  analyticsPalette,
  buildBuckets,
  buildServiceBreakdown,
  contrastAgainstWhite,
  defaultAnalyticsRange,
  enumerateDays,
  NO_SERVICE_KEY,
  OTHER_SERVICE_KEY,
  parseAnalyticsRange,
  rangeBoundsUtc,
  sumIntoBuckets,
  zonedDay,
  zonedMidnightUtc,
  type AnalyticsPaymentRow,
  type AnalyticsProjectRow,
  type DashboardAnalyticsInput,
} from "../src/lib/dashboard-analytics";

let failures = 0;
let passes = 0;
function assert(cond: unknown, msg: string) {
  if (cond) passes++;
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
}
function eq<T>(actual: T, expected: T, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(ok, `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}
function section(name: string) {
  console.log(`• ${name}`);
}
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const A = "biz-a";
const B = "biz-b";
const TZ = "America/Chicago";
const RANGE = { from: "2026-10-01", to: "2026-10-31" };

function pay(p: Partial<AnalyticsPaymentRow> & Pick<AnalyticsPaymentRow, "id" | "project_id" | "amount" | "status" | "created_at">): AnalyticsPaymentRow {
  return { business_id: A, paid_at: null, updated_at: p.created_at, ...p };
}
function proj(id: string, created_at: string, service_keys: string[], extra: Partial<AnalyticsProjectRow> = {}): AnalyticsProjectRow {
  return { id, business_id: A, created_at, service_keys, ...extra };
}

const fixture: DashboardAnalyticsInput = {
  businessId: A,
  range: RANGE,
  timeZone: TZ,
  refundsTracked: true,
  payments: [
    // P1: deposit + balance (partial payments). Balance paid 03:00Z Oct 20 = Oct 19 in Chicago.
    pay({ id: "p1", project_id: "P1", amount: 50_000, status: "paid", created_at: "2026-10-01T17:00:00Z", paid_at: "2026-10-03T15:00:00Z" }),
    pay({ id: "p1", project_id: "P1", amount: 50_000, status: "paid", created_at: "2026-10-01T17:00:00Z", paid_at: "2026-10-03T15:00:00Z" }), // duplicate row
    pay({ id: "p2", project_id: "P1", amount: 150_000, status: "paid", created_at: "2026-10-01T17:00:00Z", paid_at: "2026-10-20T03:00:00Z" }),
    // P2: ACH still processing → invoice only, not received.
    pay({ id: "p3", project_id: "P2", amount: 100_000, status: "processing", created_at: "2026-10-05T15:00:00Z" }),
    // P3: cancelled request replaced by a new one → invoice counted once.
    pay({ id: "p4", project_id: "P3", amount: 80_000, status: "cancelled", created_at: "2026-10-06T15:00:00Z" }),
    pay({ id: "p5", project_id: "P3", amount: 80_000, status: "sent", created_at: "2026-10-06T16:00:00Z" }),
    // P4: paid with no paid_at → updated_at; fully refunded later.
    pay({ id: "p6", project_id: "P4", amount: 30_000, status: "paid", created_at: "2026-10-02T15:00:00Z", updated_at: "2026-10-10T12:00:00Z" }),
    // P5: paid before the range (refund inside the range still subtracts).
    pay({ id: "p7", project_id: "P5", amount: 20_000, status: "paid", created_at: "2026-09-28T15:00:00Z", paid_at: "2026-09-30T12:00:00Z" }),
    pay({ id: "p8", project_id: "P2", amount: 40_000, status: "draft", created_at: "2026-10-07T15:00:00Z" }),
    pay({ id: "p9", project_id: "P6", amount: 25_000, status: "expired", created_at: "2026-10-08T15:00:00Z" }),
    // Soft-deleted project: excluded everywhere.
    pay({ id: "p10", project_id: "P7", amount: 60_000, status: "paid", created_at: "2026-10-12T15:00:00Z", paid_at: "2026-10-12T16:00:00Z", project_deleted: true }),
    // Another business: must be dropped.
    pay({ id: "pX", business_id: B, project_id: "PX", amount: 999_999, status: "paid", created_at: "2026-10-05T15:00:00Z", paid_at: "2026-10-05T16:00:00Z" }),
  ],
  refunds: [
    { business_id: A, payment_id: "p6", project_id: "P4", amount: 30_000, refunded_at: "2026-10-15T18:00:00Z" },
    { business_id: A, payment_id: "p7", project_id: "P5", amount: 5_000, refunded_at: "2026-10-16T18:00:00Z" },
    { business_id: B, payment_id: "pX", project_id: "PX", amount: 1, refunded_at: "2026-10-16T18:00:00Z" },
  ],
  projects: [
    proj("P1", "2026-10-01T15:00:00Z", ["photo"]),
    proj("P2", "2026-10-02T15:00:00Z", ["photo", "video"]), // multi-service
    proj("P3", "2026-10-03T15:00:00Z", []), // no service
    proj("P4", "2026-10-04T15:00:00Z", ["video", "video"]), // duplicate association
    proj("P5", "2026-09-28T15:00:00Z", ["photo"]), // before range
    proj("P6", "2026-11-01T04:30:00Z", ["drone"]), // 11:30pm Oct 31 in Chicago → in range
    proj("P8", "2026-11-01T06:00:00Z", ["drone"]), // 1:00am Nov 1 CDT → out of range
    proj("P7", "2026-10-12T15:00:00Z", ["photo"], { deleted: true }),
    { id: "PX", business_id: B, created_at: "2026-10-05T15:00:00Z", service_keys: ["photo"] },
  ],
  leads: [
    { id: "L1", business_id: A, created_at: "2026-10-01T15:00:00Z" },
    { id: "L2", business_id: A, created_at: "2026-10-09T15:00:00Z" },
    { id: "L3", business_id: A, created_at: "2026-11-01T04:59:00Z" }, // Oct 31 local
    { id: "L4", business_id: A, created_at: "2026-10-10T15:00:00Z", deleted: true },
    { id: "L5", business_id: A, created_at: "2026-09-30T15:00:00Z" },
    { id: "LX", business_id: B, created_at: "2026-10-10T15:00:00Z" },
  ],
  services: [
    { key: "photo", label: "Photography", order: 0 },
    { key: "video", label: "Video", order: 1 },
    { key: "drone", label: "Drone", order: 2 },
  ],
};

function main() {
  const r = aggregateDashboardAnalytics(fixture);
  const day = (d: string) => r.days.indexOf(d);

  section("Range and days");
  eq(r.days.length, 31, "31 calendar days in October");
  eq([r.days[0], r.days[30]], ["2026-10-01", "2026-10-31"], "days run From → To inclusive");

  section("Payments received (partial payments, refunds, processing, deleted)");
  eq(r.summary.paymentsGrossCents, 230_000, "gross = deposit + balance + paid-without-paid_at");
  eq(r.summary.refundsCents, 35_000, "refunds in range subtracted (incl. refund of a pre-range payment)");
  eq(r.summary.paymentsNetCents, 195_000, "net = gross − refunds");
  eq(r.summary.paymentCount, 3, "duplicate payment row counted once; processing/draft/expired/cancelled excluded");
  eq(r.revenue.payments[day("2026-10-03")], 50_000, "deposit on its paid date");
  eq(r.revenue.payments[day("2026-10-19")], 150_000, "balance paid 03:00Z Oct 20 lands on Oct 19 Chicago time");
  eq(r.revenue.payments[day("2026-10-20")], 0, "nothing on Oct 20");
  eq(r.revenue.payments[day("2026-10-10")], 30_000, "paid_at missing → updated_at");
  eq(r.revenue.payments[day("2026-10-15")], -30_000, "refund subtracted on refund date");
  eq(r.revenue.payments[day("2026-10-16")], -5_000, "refund of a September payment subtracted in October");
  eq(r.revenue.payments.reduce((a, b) => a + b, 0), r.summary.paymentsNetCents, "daily series sums to the net total");
  eq(r.revenue.payments[day("2026-10-12")], 0, "payment on a soft-deleted project excluded");

  section("Average revenue per paid project");
  eq(r.summary.paidProjects, 1, "only P1 has net payments above zero (P4 fully refunded, P5 net negative)");
  eq(r.summary.avgPerPaidProjectCents, 195_000, "avg = net payments ÷ projects with net positive payments");

  section("Invoices issued (no double counting)");
  eq(r.summary.invoiceCount, 5, "p1, p2, p3 (processing), p5 (replacement), p6; not draft/cancelled/expired/deleted");
  eq(r.summary.invoicesCents, 410_000, "invoice total");
  eq(r.revenue.invoices[day("2026-10-01")], 200_000, "deposit + balance requests on their issue date");
  eq(r.revenue.invoices[day("2026-10-06")], 80_000, "cancelled request and its replacement count once");
  eq(r.revenue.invoices.reduce((a, b) => a + b, 0), r.summary.invoicesCents, "invoice series sums to the total");
  assert(r.revenue.invoices.every((v) => v >= 0), "invoice view is never reduced by refunds");

  section("New projects and new requests");
  eq(r.summary.newProjects, 5, "P1, P2, P3, P4, P6 (deleted, out-of-range, and foreign excluded)");
  eq(r.newProjects[day("2026-10-31")], 1, "11:30pm Oct 31 local counts on Oct 31");
  eq(r.summary.newRequests, 3, "client requests in range (deleted, out-of-range, foreign excluded)");

  section("Projects by service (multi-service, none, Other)");
  const sv = r.services;
  eq(sv.uniqueProjects, 5, "center shows unique projects");
  eq(sv.associations, 6, "P2 counts for Photography and Video; P4's duplicate association counts once");
  const slice = (k: string) => sv.slices.find((s) => s.key === k);
  eq(slice("photo")?.count, 2, "Photography = P1 + P2");
  eq(slice("video")?.count, 2, "Video = P2 + P4");
  eq(slice("drone")?.count, 1, "Drone = P6");
  eq(slice(NO_SERVICE_KEY)?.label, "No service set", "project with no service is labelled");
  eq(Math.round(sv.slices.reduce((a, s) => a + s.share, 0) * 1000) / 1000, 1, "shares sum to 100% of associations");
  eq(sv.slices.map((s) => s.label), ["Photography", "Video", "Drone", "No service set"], "sorted by count, then configured order");

  const many = Array.from({ length: 12 }, (_, i) => ({ key: `s${i}`, label: `Service ${i}`, order: i }));
  const manyProjects = many.flatMap((s, i) => Array.from({ length: 12 - i }, (_, j) => ({ id: `${s.key}-${j}`, service_keys: [s.key] })));
  const grouped = buildServiceBreakdown(manyProjects, many);
  const other = grouped.slices.find((s) => s.key === OTHER_SERVICE_KEY);
  assert(grouped.slices.length <= 6, `many services collapse to ≤ 5 named + Other (got ${grouped.slices.length})`);
  assert(other && other.members && other.members.length === 7, "Other lists the 7 grouped services");
  eq(grouped.slices.reduce((a, s) => a + s.count, 0), grouped.associations, "grouping keeps every association");
  const single = buildServiceBreakdown(
    [...Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, service_keys: ["a"] })), { id: "b0", service_keys: ["b"] }],
    [{ key: "a", label: "A" }, { key: "b", label: "B" }]
  );
  assert(!single.slices.some((s) => s.key === OTHER_SERVICE_KEY), "a lone small service is shown by name, not as Other");
  const empty = buildServiceBreakdown([], fixture.services);
  eq([empty.uniqueProjects, empty.slices.length, empty.configuredServices], [0, 0, 3], "empty range → empty breakdown");

  section("Tenant isolation");
  eq(r.foreignRowsDropped, 4, "the other business's payment, refund, project, and lead rows are all dropped");
  const onlyForeign = aggregateDashboardAnalytics({ ...fixture, businessId: B });
  eq(onlyForeign.summary.paymentsGrossCents, 999_999, "business B sees only its own payment");
  eq(onlyForeign.summary.newProjects, 1, "business B sees only its own project");
  const loader = src("src/lib/dashboard-analytics-server.ts");
  const froms = loader.match(/\.from\("[a-z_]+"\)/g) ?? [];
  const scoped = loader.match(/\.from\("[a-z_]+"\)\s*\n?\s*\.select\((?:[^()]|\([^()]*\))*\)\s*\n?\s*\.eq\("business_id", businessId\)/g) ?? [];
  assert(froms.length >= 4 && froms.length === scoped.length, `every loader query is filtered by business_id (${scoped.length}/${froms.length})`);
  const route = src("src/app/api/admin/dashboard/analytics/route.ts");
  assert(/requireAdmin\(\)/.test(route), "API route is owner-admin only (no staff gate)");
  assert(/searchParams\.has\("business_id"\)/.test(route), "API route rejects a business_id parameter");
  assert(/tenant\.businessId/.test(route) && !/searchParams\.get\("business/.test(route), "API route takes the business from the session");

  section("Grouping (daily / weekly / monthly)");
  for (const g of ["daily", "weekly", "monthly"] as const) {
    const b = buildBuckets(r.days, g);
    eq(b[0]!.first, 0, `${g}: first bucket starts at the range start`);
    eq(b[b.length - 1]!.last, r.days.length - 1, `${g}: last bucket ends at the range end`);
    assert(b.every((x, i) => i === 0 || x.first === b[i - 1]!.last + 1), `${g}: buckets are contiguous`);
    eq(sumIntoBuckets(r.revenue.payments, b).reduce((a, c) => a + c, 0), r.summary.paymentsNetCents, `${g}: payments total unchanged`);
    eq(sumIntoBuckets(r.newProjects, b).reduce((a, c) => a + c, 0), r.summary.newProjects, `${g}: projects total unchanged`);
  }
  const weeks = buildBuckets(r.days, "weekly");
  eq(weeks[0]!.start + "→" + weeks[0]!.end, "2026-10-01→2026-10-04", "first week clipped to the range (Thu–Sun)");
  eq(weeks[1]!.key, "2026-10-05", "weeks start on Monday");
  const months = buildBuckets(enumerateDays("2026-09-20", "2026-11-05"), "monthly");
  eq(months.map((m) => m.key), ["2026-09", "2026-10", "2026-11"], "monthly buckets across months");
  eq(months[1]!.title, "October 2026", "a full month is titled by name");
  assert(months[0]!.title.includes("Sep 20 – Sep 30"), "a partial month shows the covered dates");
  eq(buildBuckets(["2026-10-07"], "daily")[0]!.title, "Wed, Oct 7, 2026", "daily tooltip shows the full date");

  section("Timezones, DST, and range parsing");
  eq(zonedMidnightUtc("2026-03-08", TZ).toISOString(), "2026-03-08T06:00:00.000Z", "midnight before spring-forward is CST");
  eq(zonedMidnightUtc("2026-11-01", TZ).toISOString(), "2026-11-01T05:00:00.000Z", "midnight before fall-back is CDT");
  eq(zonedMidnightUtc("2026-11-02", TZ).toISOString(), "2026-11-02T06:00:00.000Z", "day after fall-back is CST");
  eq(rangeBoundsUtc(RANGE, TZ), { start: "2026-10-01T05:00:00.000Z", end: "2026-11-01T05:00:00.000Z" }, "range bounds are local midnights");
  eq(zonedDay("2026-11-01T04:59:59Z", TZ), "2026-10-31", "zonedDay before local midnight");
  eq(zonedDay("2026-11-01T05:00:00Z", TZ), "2026-11-01", "zonedDay at local midnight");
  const now = new Date("2026-11-05T03:00:00Z"); // Nov 4, 10pm in Chicago
  eq(defaultAnalyticsRange(TZ, now), { from: "2026-10-06", to: "2026-11-04" }, "default = last 30 days ending today (business-local)");
  eq(parseAnalyticsRange(null, null, TZ, now), { ok: true, range: { from: "2026-10-06", to: "2026-11-04" } }, "missing params → default range");
  assert(!parseAnalyticsRange("2026-10-10", "2026-10-01", TZ, now).ok, "From after To rejected");
  assert(!parseAnalyticsRange("2026-02-30", "2026-03-01", TZ, now).ok, "impossible date rejected");
  assert(!parseAnalyticsRange("2020-01-01", "2026-11-04", TZ, now).ok, "over-long range rejected");
  assert(!parseAnalyticsRange("2026-10-01'; drop", "2026-11-04", TZ, now).ok, "malformed input rejected");
  const bogusTz = aggregateDashboardAnalytics({ ...fixture, timeZone: "Not/AZone" });
  eq(bogusTz.timeZone, "America/New_York", "invalid stored timezone falls back to the default");

  section("Brand palette");
  const pal = analyticsPalette("#0F172A", "#4F46E5");
  assert(pal.revenue !== pal.projects, "revenue and projects use different colors");
  eq(pal.projectsDashed, false, "distinct brand colors → solid lines");
  eq(pal.services.length, 6, "six service colors");
  eq(new Set(pal.services).size, 6, "service colors are distinct");
  assert(pal.services.every((c) => contrastAgainstWhite(c) >= 2), "service colors are visible on a white card");
  eq(pal.services[0], pal.projects, "first service color is the accent");
  const same = analyticsPalette("#2563EB", "#2563EB");
  eq(same.projectsDashed, true, "identical brand colors → New Projects line is dashed");
  const pale = analyticsPalette("#FDE68A", "#FEF3C7");
  assert(contrastAgainstWhite(pale.revenue) >= 3 && contrastAgainstWhite(pale.projects) >= 3, "pale brand colors are darkened to stay visible");
  for (const [p, a] of [["#000000", "#000000"], ["#FFFFFF", "#FFFFFF"], ["#E11D48", "#F59E0B"], ["#16A34A", "#0EA5E9"]]) {
    const x = analyticsPalette(p!, a!);
    assert(new Set(x.services).size === x.services.length && x.services.length === 6, `palette for ${p}/${a} has 6 distinct colors`);
  }

  section("Drill-downs");
  const period = drilldownAttributions(fixture, { kind: "period" });
  const att = (id: string) => period.find((a) => a.projectId === id);
  eq(period.reduce((a, x) => a + x.paidCents, 0), r.summary.paymentsNetCents, "period rows' payments add up to the chart's net revenue");
  eq(period.reduce((a, x) => a + x.invoicedCents, 0), r.summary.invoicesCents, "period rows' invoices add up to the chart's invoice total");
  eq(period.filter((x) => x.isNew).length, r.summary.newProjects, "period rows flag exactly the chart's new projects");
  eq(period[0]?.projectId, "P1", "largest amount listed first");
  eq([att("P1")?.paidCents, att("P1")?.paymentCount, att("P1")?.invoicedCents], [200_000, 2, 200_000], "deposit + balance both attributed to P1");
  eq([att("P4")?.paidCents, att("P4")?.refundedCents], [0, 30_000], "refunded project nets to zero and shows the refund");
  eq([att("P5")?.isNew, att("P5")?.paidCents], [false, -5_000], "older project appears when refunded in the period");
  assert(!att("P7") && !att("PX") && !att("P8"), "deleted, foreign, and out-of-range projects are not listed");
  for (const d of ["2026-10-03", "2026-10-15", "2026-10-19"]) {
    const sub = drilldownAttributions({ ...fixture, range: { from: d, to: d } }, { kind: "period" });
    eq(sub.reduce((a, x) => a + x.paidCents, 0), r.revenue.payments[day(d)], `drill-down for ${d} matches that chart point`);
  }
  const weekRange = { from: "2026-10-12", to: "2026-10-18" };
  const weekRows = drilldownAttributions({ ...fixture, range: weekRange }, { kind: "period" });
  const weekBucket = buildBuckets(r.days, "weekly").find((b) => b.start === weekRange.from)!;
  eq(weekRows.reduce((a, x) => a + x.paidCents, 0), sumIntoBuckets(r.revenue.payments, [weekBucket])[0], "weekly drill-down matches the weekly point");
  const svc = (keys: string[]) => drilldownAttributions(fixture, { kind: "service", serviceKeys: keys }).map((a) => a.projectId).sort();
  eq(svc(["video"]), ["P2", "P4"], "service drill-down lists every project with that service (multi-service P2 included)");
  eq(svc([NO_SERVICE_KEY]), ["P3"], "'No service set' lists projects without a service");
  eq(svc(["photo", "drone"]), ["P1", "P2", "P6"], "'Other' (several keys) lists projects with any of them, created in range only");
  eq(svc(["video"]).length, sv.slices.find((x) => x.key === "video")?.count, "service drill-down count equals the slice count");
  eq(drilldownAttributions({ ...fixture, businessId: B }, { kind: "service", serviceKeys: ["photo"] }).map((a) => a.projectId), ["PX"], "other business sees only its own project");

  eq(parseServiceKeysParam(null), null, "no service param → period mode");
  eq(parseServiceKeysParam([]), null, "empty list → period mode");
  eq(parseServiceKeysParam(["9b2f1c1e-3c55-4d1e-9a51-0f6b8b1f2a10", "type:photos, drone", "__none__"]), ["9b2f1c1e-3c55-4d1e-9a51-0f6b8b1f2a10", "type:photos, drone", "__none__"], "valid service keys accepted, including a free-text name with a comma");
  eq(parseServiceKeysParam(["photo"]), "invalid", "arbitrary service key rejected");
  eq(parseServiceKeysParam([""]), "invalid", "empty service param rejected");
  eq(parseServiceKeysParam(Array.from({ length: 51 }, (_, i) => `type:${i}`)), "invalid", "more than 50 keys rejected");
  const droute = src("src/app/api/admin/dashboard/analytics/projects/route.ts");
  assert(/requireAdmin\(\)/.test(droute) && /searchParams\.has\("business_id"\)/.test(droute) && /tenant\.businessId/.test(droute), "drill-down route: owner-only, session tenant, business_id param rejected");
  assert(/"invalid"/.test(droute), "drill-down route rejects invalid service keys");

  section("Column preferences");
  const ALL = ["project", "client", "status", "paid", "created", "email"];
  const DEF = ["project", "client", "paid"];
  eq(normalizeColumnPrefs(null, ALL, DEF, ["project"]), { order: ["project", "client", "paid", "status", "created", "email"], visible: ["project", "client", "paid"] }, "no stored prefs → defaults first");
  eq(normalizeColumnPrefs("garbage", ALL, DEF, ["project"]).visible, ["project", "client", "paid"], "malformed prefs → defaults");
  const stored = { order: ["created", "client", "gone", "project", "paid", "status"], visible: ["created", "gone", "paid"] };
  eq(normalizeColumnPrefs(stored, ALL, DEF, ["project"]), { order: ["created", "client", "project", "paid", "status", "email"], visible: ["created", "project", "paid"] }, "stored order kept, removed column dropped, new column appended hidden, locked column forced visible");
  eq(normalizeColumnPrefs(stored, [...ALL, "lifetime"], [...DEF, "lifetime"], ["project"]).visible.includes("lifetime"), true, "a new default column appears for existing users");
  eq(moveColumn(["a", "b", "c"], "c", -1), ["a", "c", "b"], "move earlier");
  eq(moveColumn(["a", "b", "c"], "a", -1), ["a", "b", "c"], "cannot move past the start");
  eq(moveColumn(["a", "b", "c"], "a", 2), ["b", "c", "a"], "move to the end");

  section("Client/server module boundary");
  const dir = "src/components/admin/dashboard-analytics";
  for (const f of readdirSync(join(process.cwd(), dir))) {
    const text = src(`${dir}/${f}`);
    if (!text.startsWith('"use client"')) continue;
    const values = [...text.matchAll(/^export\s+(?:const|let|var)\s+(\w+)/gm)].map((m) => m[1]);
    assert(values.length === 0, `${f} ("use client") exports only components (found: ${values.join(", ") || "none"})`);
  }
  const lib = src("src/lib/dashboard-analytics.ts");
  assert(!/^["']use client["']/.test(lib) && !/^import[^;]*(supabase|next\/headers|server-only)/m.test(lib), "shared lib has no client directive and no server imports");
  const page = src("src/app/admin/page.tsx");
  assert(/from "@\/lib\/dashboard-analytics"/.test(page), "page imports shared values from the plain lib, not a client module");

  section("Dashboard layout");
  const ops = src("src/components/admin/admin-ops-dashboard.tsx");
  for (const t of ["New Requests", "Quotes Needing Attention", "Upcoming Shoots", "Payment Status"]) {
    assert(ops.includes(`title="${t}"`), `operational card kept: ${t}`);
  }
  assert(!ops.includes('title="Editing Queue"') && !ops.includes('title="Ready for Delivery"'), "Editing Queue and Ready for Delivery removed");
  for (const t of ["New Requests", "Quotes", "Upcoming Shoots", "Editing", "In Review", "Awaiting Payment"]) {
    assert(ops.includes(`label: "${t}"`), `summary card kept: ${t}`);
  }
  const order = ["<AdminOpsDashboard", "<BusinessAnalytics", "Recent Projects", "Recent Activity"].map((t) => page.indexOf(t));
  assert(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1]!)), "page order: ops → analytics → recent projects → recent activity");

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

main();
