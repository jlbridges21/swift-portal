/**
 * Marketing analytics verification (no database, no network).
 * Drives the real collector, ingestion, attribution, and report aggregation with an
 * in-memory store through the customer-journey scenarios in docs/ANALYTICS.md.
 *
 * Run: npx tsx scripts/verify-analytics.ts
 */

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { handleCollect, isAllowedAnalyticsHost } from "../src/lib/analytics/collector";
import type { AnalyticsStore, EventRow, SessionRow } from "../src/lib/analytics/ingest";
import { classifyChannel, referrerHostFrom } from "../src/lib/analytics/channels";
import { isBotUserAgent, deviceClass } from "../src/lib/analytics/request-meta";
import { resetAnalyticsRateLimitForTests } from "../src/lib/analytics/rate-limit";
import { buildAttributionSnapshot, snapshotToRow, type AttributionEvent, type AttributionSession } from "../src/lib/analytics/attribution";
import {
  buildArticles,
  buildChannels,
  buildLifecycles,
  buildOverview,
  buildTimeseries,
  earliestByBusiness,
  type AttributionRec,
  type BusinessRec,
  type ReportInput,
} from "../src/lib/analytics/aggregate";
import { parseReportRange, previousRange, startOfLocalDay } from "../src/lib/analytics/range";

let failures = 0;
let passes = 0;
function assert(cond: unknown, msg: string) {
  if (cond) passes++;
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
}
function section(name: string) {
  console.log(`• ${name}`);
}

// ------------------------------------------------------------------ in-memory store
class MemoryStore implements AnalyticsStore {
  salts = new Map<string, string>();
  sessions = new Map<string, SessionRow>();
  events: EventRow[] = [];
  async getDailySalt(day: string) {
    if (!this.salts.has(day)) this.salts.set(day, randomUUID());
    return this.salts.get(day)!;
  }
  async findRecentSessionId(visitorKey: string, sinceIso: string) {
    const recent = this.events
      .filter((e) => e.visitor_key === visitorKey && e.occurred_at >= sinceIso)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
    return recent?.session_id ?? null;
  }
  async ensureSession(row: SessionRow) {
    if (!this.sessions.has(row.id)) this.sessions.set(row.id, row);
  }
  async insertEvent(row: EventRow) {
    if (!this.events.some((e) => e.client_event_id === row.client_event_id)) this.events.push(row);
  }
}

const ROOT = "shootportal.app";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function headers(extra: Record<string, string> = {}) {
  return new Headers({ host: `www.${ROOT}`, "user-agent": UA, "x-forwarded-for": "203.0.113.7", ...extra });
}

async function collect(store: MemoryStore, body: Record<string, unknown>, opts: { at: Date; headers?: Headers }) {
  return handleCollect(JSON.stringify({ v: 1, eventId: randomUUID(), ...body }), opts.headers ?? headers(), {
    platformRootDomain: ROOT,
    allowDev: false,
    store,
    now: opts.at,
  });
}

function visitor() {
  return { visitorId: randomUUID(), sessionId: randomUUID() };
}

function attributionFor(store: MemoryStore, visitorId: string, signupAt: Date) {
  const key = `v:${visitorId}`;
  const sessions = [...store.sessions.values()].filter((s) => s.visitor_key === key) as AttributionSession[];
  const events = store.events.filter((e) => e.visitor_key === key) as AttributionEvent[];
  return buildAttributionSnapshot(sessions, events, signupAt);
}

const T0 = new Date("2026-10-01T15:00:00Z");
const at = (mins: number) => new Date(T0.getTime() + mins * 60_000);

async function main() {
  // ---------------------------------------------------------------- 1. organic blog → signup → first project
  section("1. Organic blog landing → signup → first project");
  const s1 = new MemoryStore();
  const v1 = visitor();
  await collect(s1, { type: "pageview", path: "/blog/best-aryeo-alternatives", referrer: "https://www.google.com/", mode: "persistent", ...v1 }, { at: at(0) });
  await collect(s1, { type: "cta_click", path: "/blog/best-aryeo-alternatives", mode: "persistent", ...v1, cta: { id: "blog:trial-card", location: "inline" } }, { at: at(3) });
  await collect(s1, { type: "signup_start", path: "/signup", mode: "persistent", ...v1 }, { at: at(3) });
  const snap1 = attributionFor(s1, v1.visitorId, at(6));
  assert(snap1.status === "attributed", "attributed");
  assert(snap1.first?.channel === "google_organic", "first touch google organic");
  assert(snap1.first_article_slug === "best-aryeo-alternatives", "first article recorded");
  assert(snap1.signup_cta_id === "blog:trial-card", "signup CTA recorded");

  // ---------------------------------------------------------------- 2. blog → leave → return direct → signup
  section("2. Blog → leave → return directly → signup");
  const s2 = new MemoryStore();
  const v2 = { visitorId: randomUUID() };
  await collect(s2, { type: "pageview", path: "/blog/best-photography-crm-software", referrer: "https://www.bing.com/", mode: "persistent", ...v2, sessionId: randomUUID() }, { at: at(0) });
  await collect(s2, { type: "pageview", path: "/pricing", mode: "persistent", ...v2, sessionId: randomUUID() }, { at: at(60 * 24 * 3) });
  const snap2 = attributionFor(s2, v2.visitorId, at(60 * 24 * 3 + 10));
  assert(snap2.first?.channel === "bing_organic", "first touch preserved as Bing");
  assert(snap2.last?.channel === "bing_organic", "last touch skips the later Direct session (last non-direct)");
  assert(snap2.sessions_before_signup === 2, "two sessions counted");

  // ---------------------------------------------------------------- 3. social UTM campaign
  section("3. Social campaign with UTM → signup");
  const s3 = new MemoryStore();
  const v3 = visitor();
  await collect(s3, { type: "pageview", path: "/", utm: { utm_source: "instagram", utm_medium: "social", utm_campaign: "fall-launch" }, mode: "persistent", ...v3 }, { at: at(0) });
  const snap3 = attributionFor(s3, v3.visitorId, at(5));
  assert(snap3.first?.channel === "instagram", "instagram channel from UTM");
  assert(snap3.first?.utm_campaign === "fall-launch", "campaign kept");
  assert(classifyChannel({ referrerHost: null, utm: { utm_source: "google", utm_medium: "cpc" } }) === "paid", "cpc = paid");
  assert(classifyChannel({ referrerHost: "l.instagram.com", utm: {} }) === "instagram", "instagram referrer");
  assert(classifyChannel({ referrerHost: null, utm: { utm_source: "newsletter", utm_medium: "email" } }) === "email", "email medium");
  assert(classifyChannel({ referrerHost: "example.com", utm: {} }) === "referral", "unknown site = referral");
  assert(classifyChannel({ referrerHost: null, utm: {} }) === "direct", "no evidence = direct");

  // ---------------------------------------------------------------- 4. direct signup without tracking
  section("4. Direct signup with no prior tracking");
  const snap4 = buildAttributionSnapshot([], [], at(0));
  assert(snap4.status === "unknown", "no sessions → unknown, never direct");
  const row4 = snapshotToRow("b4", snap4, at(0), null);
  assert(row4.ft_channel === null && row4.status === "unknown", "unknown row has no channel");

  // ---------------------------------------------------------------- 5. blog A → blog B → signup
  section("5. Blog A → Blog B → signup");
  const s5 = new MemoryStore();
  const v5 = visitor();
  await collect(s5, { type: "pageview", path: "/blog/drone-photography-pricing-guide", referrer: "https://duckduckgo.com/", mode: "persistent", ...v5 }, { at: at(0) });
  await collect(s5, { type: "pageview", path: "/blog/best-drone-business-management-software", mode: "persistent", ...v5 }, { at: at(4) });
  await collect(s5, { type: "pageview", path: "/blog/best-drone-business-management-software?utm_x=1#top", mode: "persistent", ...v5 }, { at: at(5) });
  const snap5 = attributionFor(s5, v5.visitorId, at(8));
  assert(snap5.first_article_slug === "drone-photography-pricing-guide", "first article A");
  assert(snap5.last_article_slug === "best-drone-business-management-software", "last article B");
  assert(snap5.articles_viewed.length === 2, "both articles listed once (assisted)");
  assert([...s5.sessions.values()].length === 1, "one session for continuous visit");
  assert(s5.events.every((e) => !e.path.includes("?") && !e.path.includes("#")), "query/hash never stored");

  // ---------------------------------------------------------------- report fixtures for 6–11
  const range = parseReportRange({ range: "custom", from: "2026-10-01", to: "2026-10-14" }, new Date("2026-10-15T12:00:00Z"), "America/Chicago");
  const mkBiz = (id: string, createdAt: string, trial = true): BusinessRec => ({
    id,
    name: id,
    slug: id,
    created_at: createdAt,
    created_via: "signup",
    trial_ends_at: trial ? new Date(Date.parse(createdAt) + 14 * 86_400_000).toISOString() : null,
    subscription_status: "trialing",
    is_protected: false,
    deleted_at: null,
  });
  const attributed = (business_id: string, ft: AttributionRec["ft_channel"], visitor_key: string, first: string | null, viewed: string[]): AttributionRec => ({
    business_id,
    status: "attributed",
    unknown_reason: null,
    visitor_key,
    ft_channel: ft,
    ft_referrer_host: null,
    ft_utm_source: null,
    ft_utm_campaign: null,
    ft_landing_path: first ? `/blog/${first}` : "/",
    ft_at: "2026-10-02T15:00:00Z",
    lt_channel: ft,
    lt_referrer_host: null,
    lt_utm_source: null,
    lt_utm_campaign: null,
    lt_landing_path: null,
    lt_at: "2026-10-02T15:00:00Z",
    first_article_slug: first,
    last_article_slug: viewed[viewed.length - 1] ?? null,
    articles_viewed: viewed,
    signup_cta_id: null,
    signup_cta_location: null,
    signup_cta_path: null,
    sessions_before_signup: 1,
    signup_at: "2026-10-02T16:00:00Z",
  });
  const input: ReportInput = {
    range,
    now: new Date("2026-10-15T12:00:00Z"),
    sessions: [
      { id: "sA", visitor_key: "v:aaa", consent_mode: "persistent", started_at: "2026-10-02T15:00:00Z", landing_path: "/blog/best-aryeo-alternatives", landing_article_slug: "best-aryeo-alternatives", channel: "google_organic", referrer_host: "google.com", utm_source: null, utm_medium: null, utm_campaign: null, device_class: "desktop" },
      { id: "sB", visitor_key: "c:bbb", consent_mode: "cookieless", started_at: "2026-10-03T15:00:00Z", landing_path: "/", landing_article_slug: null, channel: "direct", referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: null, device_class: "mobile" },
    ],
    events: [
      { session_id: "sA", visitor_key: "v:aaa", event_type: "pageview", path: "/blog/best-aryeo-alternatives", article_slug: "best-aryeo-alternatives", cta_id: null, cta_location: null, occurred_at: "2026-10-02T15:00:00Z" },
      { session_id: "sA", visitor_key: "v:aaa", event_type: "cta_click", path: "/blog/best-aryeo-alternatives", article_slug: null, cta_id: "blog:trial-card", cta_location: "inline", occurred_at: "2026-10-02T15:02:00Z" },
      { session_id: "sB", visitor_key: "c:bbb", event_type: "pageview", path: "/", article_slug: null, cta_id: null, cta_location: null, occurred_at: "2026-10-03T15:00:00Z" },
      { session_id: "sB", visitor_key: "c:bbb", event_type: "cta_click", path: "/", article_slug: null, cta_id: "signup:header", cta_location: "header", occurred_at: "2026-10-03T15:01:00Z" },
    ],
    businesses: [
      mkBiz("biz-paid", "2026-10-02T16:00:00Z"),
      mkBiz("biz-trial-only", "2026-10-05T16:00:00Z"),
      mkBiz("biz-unknown", "2026-10-06T16:00:00Z"),
      { ...mkBiz("biz-platform", "2026-10-06T16:00:00Z"), created_via: "platform" },
      { ...mkBiz("biz-protected", "2026-10-06T16:00:00Z"), is_protected: true },
      mkBiz("biz-old", "2026-08-01T16:00:00Z"),
    ],
    attribution: [attributed("biz-paid", "google_organic", "v:aaa", "best-aryeo-alternatives", ["best-aryeo-alternatives", "shootportal-vs-aryeo-vs-hdphotohub"])],
    firstProjectAt: earliestByBusiness([
      { business_id: "biz-paid", created_at: "2026-10-04T10:00:00Z" },
      { business_id: "biz-paid", created_at: "2026-10-03T10:00:00Z" },
      { business_id: "biz-paid", created_at: "2026-10-09T10:00:00Z" },
    ]),
    payments: [
      { business_id: "biz-paid", amount_paid_cents: 5900, paid_at: "2026-10-12T10:00:00Z" },
      { business_id: "biz-old", amount_paid_cents: 5900, paid_at: "2026-10-10T10:00:00Z" },
      { business_id: "biz-old", amount_paid_cents: 0, paid_at: "2026-10-11T10:00:00Z" },
    ],
    lifecycle: [
      { business_id: "biz-old", event_type: "subscription_canceled", occurred_at: "2026-10-13T10:00:00Z" },
      { business_id: "biz-old", event_type: "payment_failed", occurred_at: "2026-10-09T10:00:00Z" },
    ],
    articles: [
      { slug: "best-aryeo-alternatives", title: "Aryeo alternatives" },
      { slug: "shootportal-vs-aryeo-vs-hdphotohub", title: "Vs" },
      { slug: "best-photography-crm-software", title: "CRM" },
    ],
    excludedBusinessIds: new Set(),
  };
  const lifecycles = buildLifecycles(input);
  const o = buildOverview(input, lifecycles);

  section("6. Signup CTA click without completed registration");
  assert(o.ctaClicks === 2, "both CTA clicks counted");
  assert(o.registrations === 3, "CTA clicks do not create registrations (3 self-serve in range)");

  section("7. Trial signup without activation");
  assert(o.trials === 3, "three trials in cohort");
  assert(o.signupToActivation.numerator === 1 && o.signupToActivation.denominator === 3, "only one of three activated");

  section("Trials come from trial_ends_at (businesses has no trial_days column)");
  assert(lifecycles.find((l) => l.id === "biz-paid")?.trialStartedAt === "2026-10-02T16:00:00Z", "trial starts at registration when trial_ends_at is set");
  const noTrial = buildLifecycles({ ...input, businesses: [mkBiz("biz-no-trial", "2026-10-03T16:00:00Z", false)] });
  assert(noTrial[0]?.trialStartedAt === null, "no trial when trial_ends_at is null");

  section("8. First project counted once");
  assert(input.firstProjectAt.get("biz-paid") === "2026-10-03T10:00:00Z", "earliest project kept");
  assert(o.activated === 1, "activation counted once despite three projects");

  section("9. Paid subscription");
  assert(o.newPaid === 2, "first payment in range for biz-paid and biz-old");
  assert(o.revenueCents === 11800, "revenue sums positive payments only");
  assert(o.attributedRevenueCents === 5900 && o.unknownRevenueCents === 5900, "attributed vs unknown revenue split");
  assert(o.trialToPaid.numerator === 1 && o.trialToPaid.denominator === 3, "trial→paid is cohort-based");
  assert((o.trialToPaid.note ?? "").includes("still in trial"), "immature cohort flagged");

  section("10. Platform-created / protected excluded; test-mode payments excluded at load time");
  assert(!lifecycles.some((l) => l.id === "biz-platform" || l.id === "biz-protected"), "excluded from lifecycle metrics");

  section("11. Cancellation and failed payment");
  assert(o.cancellations === 1 && o.paymentFailures === 1, "lifecycle events counted in range");

  section("Visitor → registration (consented cohort)");
  assert(o.visitorToSignup.denominator === 1 && o.visitorToSignup.numerator === 1, "only consented visitors in the denominator");
  assert(o.visitors === 2 && o.consentedVisitors === 1, "visitors include cookieless; consented tracked separately");

  section("Channels and articles");
  const ch = buildChannels(input, lifecycles, "first");
  assert(ch.find((c) => c.channel === "google_organic")?.registrations === 1, "google credited first touch");
  assert(ch.find((c) => c.channel === "unknown")?.registrations === 2, "unattributed signups stay Unknown");
  assert(ch.find((c) => c.channel === "direct")?.registrations === 0, "Unknown is never folded into Direct");
  assert(ch.find((c) => c.channel === "google_organic")?.revenueCents === 5900, "channel revenue from credited business");
  const arts = buildArticles(input, lifecycles);
  const aryeo = arts.find((a) => a.slug === "best-aryeo-alternatives")!;
  const vs = arts.find((a) => a.slug === "shootportal-vs-aryeo-vs-hdphotohub")!;
  assert(aryeo.first.registrations === 1 && aryeo.ctaClicks === 1 && aryeo.pageviews === 1, "article first-touch + CTA + views");
  assert(vs.first.registrations === 0 && vs.last.registrations === 1 && vs.assisted.registrations === 1, "last-touch and assisted separate from first");
  assert(arts.length === 3, "every article listed, even with no traffic");
  const series = buildTimeseries(input, lifecycles);
  assert(series.length === 14, "one point per local day");
  assert(series.reduce((n, p) => n + p.registrations, 0) === 3, "timeseries registrations match overview");

  // ---------------------------------------------------------------- 12. consent rejected / GPC
  section("12. Consent rejected or GPC");
  const s12 = new MemoryStore();
  await collect(s12, { type: "pageview", path: "/pricing", mode: "cookieless" }, { at: at(0) });
  await collect(s12, { type: "pageview", path: "/how-it-works", mode: "cookieless" }, { at: at(10) });
  const keys12 = [...s12.sessions.values()].map((s) => s.visitor_key);
  assert(keys12.length === 1 && keys12[0]!.startsWith("c:"), "cookieless key, server-side session continuity");
  assert(!keys12[0]!.includes("203.0.113.7"), "IP not stored");
  const vGpc = visitor();
  await collect(s12, { type: "pageview", path: "/", mode: "persistent", ...vGpc }, { at: at(20), headers: headers({ "sec-gpc": "1" }) });
  assert(![...s12.sessions.values()].some((s) => s.visitor_key === `v:${vGpc.visitorId}`), "GPC forces cookieless even if ids were sent");
  await collect(s12, { type: "pageview", path: "/", mode: "cookieless" }, { at: at(60 * 25) });
  const keysNextDay = new Set([...s12.sessions.values()].map((s) => s.visitor_key));
  assert(keysNextDay.size === 2, "daily salt rotation: next-day key differs (unlinkable)");

  // ---------------------------------------------------------------- 13/14. auth + cross-tenant
  section("13–14. Authorization and tenant isolation (static checks)");
  const pagesDir = join(process.cwd(), "src/app/platform/analytics");
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of walk(pagesDir).filter((f) => f.endsWith("page.tsx") || f.endsWith("layout.tsx"))) {
    assert(readFileSync(f, "utf8").includes("await requireSuperAdminPage()"), `${f.replace(process.cwd(), "")} calls requireSuperAdminPage()`);
  }
  const middleware = readFileSync(join(process.cwd(), "src/lib/supabase/middleware.ts"), "utf8");
  assert(middleware.includes('"/platform"') || middleware.includes("'/platform'") || middleware.includes("/platform"), "middleware guards /platform");
  const migration = readFileSync(join(process.cwd(), "supabase/migration-v103-marketing-analytics.sql"), "utf8");
  for (const t of ["analytics_sessions", "analytics_events", "analytics_daily_salts", "business_attribution", "business_lifecycle_events"]) {
    assert(migration.includes(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`), `${t} RLS enabled`);
    assert(migration.includes(`REVOKE ALL ON ${t} FROM anon, authenticated`), `${t} revoked from anon/authenticated`);
  }
  assert(!/CREATE POLICY/i.test(migration), "no policies → no client access");
  assert(!isAllowedAnalyticsHost("acme.shootportal.app", ROOT, false), "tenant subdomain rejected by collector");
  assert(!isAllowedAnalyticsHost("portal.acmemedia.com", ROOT, false), "tenant custom domain rejected");
  assert(!isAllowedAnalyticsHost("localhost:3000", ROOT, false), "localhost rejected unless dev flag");
  assert(isAllowedAnalyticsHost("www.shootportal.app", ROOT, false), "www host accepted");
  assert(isAllowedAnalyticsHost("shootportal.app", ROOT, false), "apex host accepted");
  assert(isAllowedAnalyticsHost("shootportal.app", "www.shootportal.app", false), "apex accepted even if root env includes www");
  assert(isAllowedAnalyticsHost("WWW.ShootPortal.app:443", ROOT, false), "host check ignores case and port");
  const tenantRes = await collect(new MemoryStore(), { type: "pageview", path: "/", mode: "cookieless" }, { at: at(0), headers: headers({ host: "acme.shootportal.app" }) });
  assert(tenantRes.status === 204 && tenantRes.reason === "ignored_host", "tenant-host event ignored");

  // ---------------------------------------------------------------- 15. bots + duplicates + abuse
  section("15. Bots, duplicates, and abuse");
  assert(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), "Googlebot is a bot");
  assert(isBotUserAgent("curl/8.4.0"), "curl is a bot");
  assert(isBotUserAgent(""), "empty UA treated as bot");
  assert(!isBotUserAgent(UA), "Safari is not a bot");
  assert(deviceClass("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)") === "mobile", "iPhone = mobile");
  const s15 = new MemoryStore();
  const botRes = await collect(s15, { type: "pageview", path: "/", mode: "cookieless" }, { at: at(0), headers: headers({ "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0)" }) });
  assert(botRes.reason === "ignored_bot" && s15.events.length === 0, "bot event not stored");
  const dupId = randomUUID();
  const body = JSON.stringify({ v: 1, eventId: dupId, type: "pageview", path: "/", mode: "cookieless" });
  await handleCollect(body, headers(), { platformRootDomain: ROOT, allowDev: false, store: s15, now: at(0) });
  await handleCollect(body, headers(), { platformRootDomain: ROOT, allowDev: false, store: s15, now: at(0) });
  assert(s15.events.length === 1, "duplicate client_event_id stored once");
  const big = await handleCollect("x".repeat(5000), headers(), { platformRootDomain: ROOT, allowDev: false, store: s15 });
  assert(big.status === 413, "oversized body rejected");
  const bad = await handleCollect(JSON.stringify({ v: 1, type: "purchase", path: "/" }), headers(), { platformRootDomain: ROOT, allowDev: false, store: s15 });
  assert(bad.status === 400, "invalid payload rejected");
  const badCta = await collect(s15, { type: "cta_click", path: "/", mode: "cookieless", cta: { id: "<script>", location: "x" } }, { at: at(1) });
  assert(badCta.status === 400, "CTA ids are validated");
  resetAnalyticsRateLimitForTests();
  let limited = 0;
  for (let i = 0; i < 100; i++) {
    const r = await collect(new MemoryStore(), { type: "pageview", path: "/", mode: "cookieless" }, { at: at(0), headers: headers({ "x-forwarded-for": "198.51.100.9" }) });
    if (r.reason === "rate_limited") limited++;
  }
  assert(limited === 10, "per-IP rate limit after 90 events/minute");
  resetAnalyticsRateLimitForTests();

  // ---------------------------------------------------------------- ranges
  section("Reporting ranges (timezone + DST)");
  const r30 = parseReportRange({ range: "30d" }, new Date("2026-10-15T12:00:00Z"), "America/Chicago");
  assert(r30.days.length === 30 && r30.endDay === "2026-10-15", "30 local days ending today");
  assert(previousRange(r30).endDay === "2026-09-15", "previous period is adjacent and equal length");
  assert(startOfLocalDay("2026-11-02", "America/Chicago").toISOString() === "2026-11-02T06:00:00.000Z", "post-DST midnight is UTC-6");
  assert(startOfLocalDay("2026-10-15", "America/Chicago").toISOString() === "2026-10-15T05:00:00.000Z", "CDT midnight is UTC-5");
  assert(referrerHostFrom("javascript:alert(1)") === null, "non-http referrers ignored");

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
