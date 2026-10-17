/**
 * SEO Growth Engine verification (no database, no network).
 * Exercises HTML extraction, robots/sitemap parsing, the crawler (mocked fetch), Google
 * inspection parsing, page health, content audit, opportunity scoring, organic conversion
 * math, and the access-control guards on the new routes.
 *
 * Run: npx tsx scripts/verify-seo-growth.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeEntities, extractPage, isNoindex, parseRobots, parseSitemap, robotsAllows, toInternalPath } from "../src/lib/seo-growth/html-extract";
import { crawlSite, type CrawlResult, type PageCrawl } from "../src/lib/seo-growth/crawl";
import { inspectUrls, parseInspection, type InspectionRun, type UrlInspection } from "../src/lib/seo-growth/url-inspection";
import { assessPages, googleState, siteChecks } from "../src/lib/seo-growth/health";
import { auditContent, keywordOverlap } from "../src/lib/seo-growth/content-audit";
import { buildOpportunities, priorityScore } from "../src/lib/seo-growth/opportunities";
import { buildOrganicConversions, sampleConfidence } from "../src/lib/seo-growth/conversions";
import { buildInventory, type InventoryPage } from "../src/lib/seo-growth/inventory";
import { CONTENT_GAPS, RESEARCH_IDEAS } from "../src/lib/seo-growth/content-gaps";
import { buildLifecycles, type ReportInput } from "../src/lib/analytics/aggregate";
import { parseReportRange } from "../src/lib/analytics/range";
import sitemap from "../src/app/sitemap";

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

const ORIGIN = "https://www.shootportal.app";
const HOSTS = ["www.shootportal.app", "shootportal.app"];
const NOW = new Date("2026-10-16T12:00:00Z");

function html(opts: { title?: string; desc?: string; canonical?: string; robots?: string; body?: string; nav?: string } = {}) {
  return `<!doctype html><html><head>
${opts.title !== undefined ? `<title>${opts.title}</title>` : ""}
${opts.desc !== undefined ? `<meta name="description" content="${opts.desc}">` : ""}
${opts.robots ? `<meta name="robots" content="${opts.robots}">` : ""}
${opts.canonical ? `<link rel="canonical" href="${opts.canonical}">` : ""}
<meta property="og:image" content="${ORIGIN}/og.png">
</head><body>
<header><nav>${opts.nav ?? `<a href="/pricing">Pricing</a><a href="/tools">Tools</a>`}</nav></header>
<main>${opts.body ?? "<h1>Hello</h1><p>Some words here.</p>"}</main>
<footer><a href="/privacy">Privacy</a></footer>
</body></html>`;
}

function pageCrawl(path: string, extracted: ReturnType<typeof extractPage> | null, extra: Partial<PageCrawl> = {}): PageCrawl {
  return { path, url: `${ORIGIN}${path}`, status: 200, redirectedTo: null, xRobotsTag: null, contentType: "text/html", ms: 10, error: null, page: extracted, ...extra };
}

function inspection(path: string, over: Partial<UrlInspection> = {}): UrlInspection {
  return {
    url: `${ORIGIN}${path}`,
    path,
    ok: true,
    error: null,
    verdict: "PASS",
    coverageState: "Submitted and indexed",
    indexingState: "INDEXING_ALLOWED",
    robotsTxtState: "ALLOWED",
    pageFetchState: "SUCCESSFUL",
    lastCrawlTime: "2026-10-12T00:00:00Z",
    googleCanonical: `${ORIGIN}${path === "/" ? "/" : path}`,
    userCanonical: `${ORIGIN}${path === "/" ? "/" : path}`,
    sitemaps: [`${ORIGIN}/sitemap.xml`],
    referringUrls: [],
    richResults: null,
    inspectionLink: null,
    ...over,
  };
}

function page(path: string, over: Partial<InventoryPage> = {}): InventoryPage {
  return { path, kind: "article", title: path, primaryKeyword: null, secondaryKeywords: [], cluster: "Test", commercialValue: 1, expectedLinks: [], monitor: true, ...over };
}

function crawlOf(pages: PageCrawl[], extra: Partial<CrawlResult> = {}): CrawlResult {
  return {
    baseUrl: ORIGIN,
    startedAt: NOW.toISOString(),
    finishedAt: NOW.toISOString(),
    robots: { status: 200, groups: parseRobots("User-agent: *\nAllow: /\nDisallow: /platform\nDisallow: /partner$\n"), error: null },
    sitemap: { status: 200, urls: pages.map((p) => `${ORIGIN}${p.path === "/" ? "/" : p.path}`), error: null },
    pages,
    otherInternal: [],
    external: [],
    externalCapped: false,
    ...extra,
  };
}

async function main() {
  // ------------------------------------------------------------------ extraction
  section("HTML extraction");
  const ex = extractPage(
    html({
      title: "Best Drone Software (2026) &amp; More",
      desc: "A &quot;quoted&quot; description",
      canonical: `${ORIGIN}/blog/x`,
      body: `<h1>Best Drone Software 2026</h1><h2>A</h2><h2>B</h2>
        <p>Use <a href="/tools/drone-photography-pricing-calculator?ref=1#top">the calculator</a> and
        <a href="https://shootportal.app/pricing/">pricing</a> or <a href="https://example.com/a#x">a source</a>.
        We send reminder emails and automatic reminders.</p>
        <a href="mailto:a@b.co">mail</a><a href="#faq">faq</a>
        <img src="a.png" alt="A drone"><img src="b.png" alt=""><img src="c.png">
        <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article"},{"@type":["BreadcrumbList","Thing"]}]}</script>
        <script type="application/ld+json">{not json}</script>`,
    }),
    `${ORIGIN}/blog/x`,
    HOSTS,
    NOW
  );
  assert(ex.title === "Best Drone Software (2026) & More", "title decoded");
  assert(ex.metaDescription === 'A "quoted" description', "description decoded");
  assert(ex.canonical === `${ORIGIN}/blog/x`, "canonical extracted");
  assert(ex.metaRobots === null, "no robots meta");
  assert(ex.h1.length === 1 && ex.h2Count === 2, "headings counted");
  assert(ex.internalLinks.some((l) => l.path === "/tools/drone-photography-pricing-calculator"), "query and hash stripped from internal link");
  assert(ex.internalLinks.some((l) => l.path === "/pricing"), "apex host + trailing slash normalized to internal path");
  assert(ex.contextualLinks.every((l) => l.path !== "/privacy" && l.path !== "/tools"), "nav/footer links excluded from contextual links");
  assert(ex.contextualLinks.some((l) => l.path === "/pricing"), "body links kept as contextual");
  assert(ex.externalLinks.length === 1 && ex.externalLinks[0] === "https://example.com/a", "external link de-hashed; mailto/hash ignored");
  assert(ex.images === 3 && ex.imagesMissingAlt === 1, "alt='' is decorative, only a missing alt counts");
  assert(ex.jsonLdTypes.includes("Article") && ex.jsonLdTypes.includes("BreadcrumbList") && ex.jsonLdErrors === 1, "JSON-LD @graph types and parse errors");
  assert(ex.headlineYears.length === 1 && ex.headlineYears[0] === 2026, "headline year detected once");
  assert(ex.mentions.reminders === 2, "watched claim phrases counted");
  assert(ex.wordCount > 5 && ex.hasOgImage, "word count and og:image");
  assert(decodeEntities("&#39;a&#x27;") === "'a'", "numeric entities decoded");
  assert(toInternalPath("https://evil.com/x", ORIGIN, HOSTS) === null, "foreign host is not internal");

  section("Robots directives");
  assert(isNoindex("noindex, follow") && isNoindex("NONE") && isNoindex("googlebot: noindex"), "noindex variants detected");
  assert(!isNoindex("index, follow") && !isNoindex(null) && !isNoindex("max-image-preview:large"), "indexable directives pass");

  section("robots.txt");
  const groups = parseRobots("User-agent: *\nAllow: /\nDisallow: /platform\nDisallow: /partner$\nDisallow: /partner/\nDisallow: /*.pdf$\n\nUser-agent: badbot\nDisallow: /\n");
  assert(robotsAllows(groups, "/partners"), "/partner$ does not block /partners");
  assert(!robotsAllows(groups, "/partner") && !robotsAllows(groups, "/partner/x"), "partner app blocked");
  assert(!robotsAllows(groups, "/platform/analytics/seo/growth"), "platform blocked");
  assert(!robotsAllows(groups, "/files/a.pdf") && robotsAllows(groups, "/files/a.pdf.html"), "wildcard + $ anchor");
  assert(robotsAllows(groups, "/blog/x"), "marketing allowed");
  assert(robotsAllows(parseRobots("User-agent: *\nDisallow: /a\nAllow: /a/b\n"), "/a/b/c"), "longest match wins");
  assert(robotsAllows(parseRobots("User-agent: *\nDisallow: /a\nAllow: /a\n"), "/a"), "allow wins ties");

  section("Sitemap ↔ inventory");
  const inventory = buildInventory();
  const sitemapPaths = new Set(sitemap().map((e) => new URL(e.url).pathname.replace(/\/$/, "") || "/"));
  const invPaths = new Set(inventory.map((p) => p.path));
  assert([...sitemapPaths].every((p) => invPaths.has(p)), "every sitemap URL is monitored");
  assert([...invPaths].every((p) => sitemapPaths.has(p)), "every monitored page is in the sitemap");
  assert(inventory.filter((p) => p.kind === "article").length === 25 && inventory.filter((p) => p.kind === "solution").length === 10, "25 articles and 10 landing pages monitored");
  assert(parseSitemap("<urlset><url><loc> https://a.b/x?a=1&amp;b=2 </loc></url></urlset>")[0] === "https://a.b/x?a=1&b=2", "sitemap loc parsed and decoded");

  // ------------------------------------------------------------------ crawler (mocked)
  section("Crawler");
  const responses: Record<string, { status: number; body?: string; headers?: Record<string, string>; headStatus?: number; url?: string }> = {
    [`${ORIGIN}/robots.txt`]: { status: 200, body: "User-agent: *\nAllow: /\n" },
    [`${ORIGIN}/sitemap.xml`]: { status: 200, body: `<urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/a</loc></url></urlset>` },
    [`${ORIGIN}/`]: { status: 200, body: html({ title: "Home", canonical: `${ORIGIN}/`, body: `<h1>Home</h1><a href="/a">A</a><a href="/missing">gone</a><a href="https://help.example.com/ok">h</a><a href="https://dead.example.com/x">d</a><a href="https://blocked.example.com/">b</a>` }), headers: { "content-type": "text/html; charset=utf-8" } },
    [`${ORIGIN}/a`]: { status: 200, body: html({ title: "A", robots: "noindex" }), headers: { "content-type": "text/html", "x-robots-tag": "noindex" } },
    [`${ORIGIN}/missing`]: { status: 404 },
    "https://help.example.com/ok": { status: 200, headStatus: 404 },
    "https://dead.example.com/x": { status: 404, headStatus: 404 },
    "https://blocked.example.com/": { status: 403, headStatus: 403 },
  };
  const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const r = responses[url];
    if (!r) return new Response("not found", { status: 404 });
    const status = init?.method === "HEAD" && r.headStatus ? r.headStatus : r.status;
    const res = new Response(init?.method === "HEAD" ? null : r.body ?? "", { status, headers: r.headers });
    Object.defineProperty(res, "url", { value: r.url ?? url });
    return res;
  }) as typeof fetch;
  const crawl = await crawlSite({ baseUrl: ORIGIN, paths: ["/", "/a"], hosts: HOSTS, fetchFn: mockFetch, now: NOW });
  assert(crawl.sitemap.urls.length === 2 && crawl.robots.status === 200, "robots + sitemap fetched");
  assert(crawl.pages.length === 2 && crawl.pages[0]!.page?.title === "Home", "pages crawled and extracted");
  assert(crawl.pages[1]!.xRobotsTag === "noindex", "X-Robots-Tag captured");
  assert(crawl.otherInternal.find((l) => l.url === "/missing")?.result === "broken", "broken internal link detected");
  assert(crawl.external.find((l) => l.url === "https://help.example.com/ok")?.result === "ok", "HEAD 404 confirmed by GET 200 is not broken");
  assert(crawl.external.find((l) => l.url === "https://dead.example.com/x")?.result === "broken", "HEAD+GET 404 is broken");
  assert(crawl.external.find((l) => l.url === "https://blocked.example.com/")?.result === "blocked", "403 is 'blocked', not broken");

  // ------------------------------------------------------------------ Google inspection
  section("URL Inspection parsing");
  const parsed = parseInspection(`${ORIGIN}/x/`, {
    inspectionResult: {
      inspectionResultLink: "https://search.google.com/x",
      indexStatusResult: { verdict: "NEUTRAL", coverageState: "Discovered - currently not indexed", sitemap: [`${ORIGIN}/sitemap.xml`] },
      richResultsResult: { verdict: "FAIL", detectedItems: [{ richResultType: "FAQ", items: [{ issues: [{ issueMessage: "Missing field", severity: "ERROR" }] }] }] },
    },
  });
  assert(parsed.path === "/x" && parsed.coverageState?.startsWith("Discovered") && parsed.richResults?.issues.length === 1, "inspection response parsed");
  assert(googleState(parsed) === "waiting", "discovered → waiting");
  assert(googleState(inspection("/a")) === "indexed", "PASS → indexed");
  assert(googleState(inspection("/a", { verdict: "NEUTRAL", coverageState: "URL is unknown to Google" })) === "unknown_to_google", "unknown to Google");
  assert(googleState(inspection("/a", { verdict: "NEUTRAL", coverageState: "Crawled - currently not indexed" })) === "crawled_not_indexed", "crawled not indexed");
  assert(googleState(inspection("/a", { verdict: "FAIL", coverageState: "Excluded by 'noindex' tag" })) === "excluded", "noindex exclusion");
  assert(googleState(undefined) === "not_checked" && googleState(inspection("/a", { ok: false, error: "x" })) === "error", "missing / failed inspection");

  section("URL Inspection time budget");
  process.env.GSC_SITE_URL ??= "sc-domain:example.test";
  process.env.GSC_CLIENT_EMAIL ??= "test@example.test";
  process.env.GSC_PRIVATE_KEY ??= "test";
  const urls = Array.from({ length: 10 }, (_, i) => `${ORIGIN}/p${i}`);
  let calls = 0;
  const slow = async (url: string) => {
    calls++;
    await new Promise((r) => setTimeout(r, url.endsWith("p9") ? 400 : 10));
    return { ...inspection(new URL(url).pathname), checkedAt: `2026-10-16T00:00:0${url.slice(-1)}Z` };
  };
  const partial = await inspectUrls(urls, { concurrency: 3, budgetMs: 150, run: slow });
  assert(partial.status === "ok" && partial.pending === 1 && partial.results.length === 9, "budget returns finished results and counts the pending one");
  assert(partial.status === "ok" && !!partial.inflight, "unfinished work is exposed so it can complete in the background");
  if (partial.status === "ok") await partial.inflight;
  assert(calls === 10, "every URL is still inspected exactly once");
  const full = await inspectUrls(urls, { concurrency: 4, run: slow });
  assert(full.status === "ok" && full.pending === 0 && full.results.map((r) => r.path).join() === urls.map((u) => new URL(u).pathname).join(), "without a budget all results return in input order");
  assert(full.status === "ok" && full.checkedAt === "2026-10-16T00:00:00Z", "checkedAt is the oldest result");

  // ------------------------------------------------------------------ page health
  section("Page health");
  const good = (path: string, body = "<h1>T</h1><p>words</p>") => extractPage(html({ title: "T", desc: "D", canonical: `${ORIGIN}${path}`, body }), `${ORIGIN}${path}`, HOSTS, NOW);
  const inv: InventoryPage[] = [
    page("/", { kind: "home", commercialValue: 3 }),
    page("/l", { kind: "solution", commercialValue: 3 }),
    page("/noindex"),
    page("/other-canonical"),
    page("/gcanon"),
    page("/wait", { kind: "tool", commercialValue: 2 }),
    page("/unchecked"),
  ];
  const hCrawl = crawlOf([
    pageCrawl("/", good("/", `<h1>Home</h1><a href="/l">L</a><a href="/wait">W</a><a href="/noindex">n</a>`)),
    pageCrawl("/l", good("/l", `<h1>L</h1><a href="/gcanon">g</a><a href="/other-canonical">o</a>`)),
    pageCrawl("/noindex", extractPage(html({ title: "N", desc: "D", canonical: `${ORIGIN}/noindex`, robots: "noindex" }), `${ORIGIN}/noindex`, HOSTS)),
    pageCrawl("/other-canonical", extractPage(html({ title: "O", desc: "D", canonical: `${ORIGIN}/l` }), `${ORIGIN}/other-canonical`, HOSTS)),
    pageCrawl("/gcanon", good("/gcanon")),
    pageCrawl("/wait", good("/wait")),
    pageCrawl("/unchecked", good("/unchecked")),
  ]);
  hCrawl.sitemap.urls = hCrawl.sitemap.urls.filter((u) => !u.endsWith("/unchecked"));
  const run: InspectionRun = {
    status: "ok",
    siteUrl: "sc-domain:shootportal.app",
    checkedAt: NOW.toISOString(),
    skipped: 0,
    pending: 0,
    results: [
      inspection("/"),
      inspection("/l"),
      inspection("/noindex"),
      inspection("/other-canonical"),
      inspection("/gcanon", { googleCanonical: `${ORIGIN}/l` }),
      inspection("/wait", { verdict: "NEUTRAL", coverageState: "Discovered - currently not indexed", lastCrawlTime: null }),
    ],
  };
  const health = assessPages({ inventory: inv, crawl: hCrawl, inspection: run, canonicalOrigin: ORIGIN, now: NOW });
  const h = (p: string) => health.find((x) => x.path === p)!;
  assert(h("/").status === "healthy" && h("/").issues.length === 0, "indexed, clean page is healthy");
  assert(h("/l").status === "healthy" && h("/l").site.contextualInbound === 1, "contextual inbound counted");
  assert(h("/noindex").status === "critical" && h("/noindex").issues.some((i) => i.id === "site-noindex"), "noindex is critical");
  assert(h("/other-canonical").issues.some((i) => i.id === "site-canonical-other" && i.severity === "critical"), "canonical to another URL is critical");
  assert(h("/gcanon").issues.some((i) => i.id === "google-canonical" && i.source === "google"), "Google-selected canonical mismatch reported as Google evidence");
  assert(h("/wait").status === "attention" && h("/wait").issues[0]!.id === "google-not-indexed" && h("/wait").issues[0]!.severity === "warning", "not-yet-indexed tool page needs attention (warning)");
  assert(h("/unchecked").status !== "healthy" && h("/unchecked").google.state === "not_checked", "unchecked page is never 'healthy'");
  assert(h("/unchecked").issues.some((i) => i.id === "site-sitemap"), "page missing from sitemap flagged");
  assert(h("/unchecked").issues.some((i) => i.id === "site-orphan"), "page with no in-content links flagged");
  const noGoogle = assessPages({ inventory: inv, crawl: hCrawl, inspection: { status: "not_configured" }, canonicalOrigin: ORIGIN, now: NOW });
  assert(noGoogle.find((x) => x.path === "/")!.status === "unknown", "clean page without Google data is 'unknown', not healthy");
  assert(noGoogle.every((x) => x.issues.every((i) => i.source === "site")), "no Google issues are invented when Search Console is absent");

  const checks = siteChecks({ crawl: crawl, sitemaps: null, canonicalOrigin: ORIGIN, inventory: [page("/"), page("/a")] });
  assert(checks.find((c) => c.id === "internal-links")?.ok === false, "site check reports broken internal links");
  assert(checks.find((c) => c.id === "external-links")?.title.startsWith("1 broken"), "site check counts only truly broken external links");
  assert(!checks.some((c) => c.id === "gsc-sitemap"), "no Google sitemap check without Search Console");

  // ------------------------------------------------------------------ content audit
  section("Content audit");
  const art = (path: string, over: Partial<InventoryPage> = {}) =>
    page(path, { article: { slug: path.slice(6), publishedAt: "2026-10-15", updatedAt: null, factsVerifiedAt: "2026-01-01", category: "software-comparisons", comparison: true }, ...over });
  const cInv = [
    art("/blog/a", { expectedLinks: ["/l", "/tools/x"], cluster: "Pricing", primaryKeyword: "drone pricing software" }),
    art("/blog/b", { primaryKeyword: "drone pricing software" }),
  ];
  const cCrawl = crawlOf(
    [
      pageCrawl("/blog/a", extractPage(html({ title: "Best X (2026)", body: `<h1>Best X 2026</h1><a href="/l">l</a>` }), `${ORIGIN}/blog/a`, HOSTS, NOW)),
      pageCrawl("/blog/b", extractPage(html({ title: "B (2025)", body: "<h1>B</h1>" }), `${ORIGIN}/blog/b`, HOSTS, NOW)),
    ],
    { external: [{ url: "https://x.com/dead", status: 404, result: "broken", sources: ["/blog/a"] }] }
  );
  const content = auditContent({ inventory: cInv, crawl: cCrawl, now: NOW });
  const ca = content.find((c) => c.path === "/blog/a")!;
  const cb = content.find((c) => c.path === "/blog/b")!;
  assert(ca.items.some((i) => i.id === "year-rollover" && i.dueAt === "2026-12-15"), "current-year headline scheduled for December refresh");
  assert(cb.items.some((i) => i.id === "year-stale"), "last year's headline flagged as stale");
  assert(ca.items.some((i) => i.id === "facts-stale"), "comparison facts older than 180 days flagged");
  assert(ca.items.some((i) => i.id === "missing-links" && i.detail === "/tools/x"), "missing expected link listed (present link not flagged)");
  assert(ca.items.some((i) => i.id === "no-tool-link"), "pricing article without a calculator link flagged");
  assert(ca.items.some((i) => i.id === "broken-external"), "broken external link attached to its page");
  assert(ca.items.some((i) => i.id === "overlap-/blog/b"), "two articles with the same primary keyword flagged");
  assert(keywordOverlap("photography crm", "real estate photography crm") < 0.99, "partial keyword overlap is not treated as identical");
  const jan = auditContent({ inventory: cInv, crawl: cCrawl, now: new Date("2027-01-02T00:00:00Z") });
  assert(jan.find((c) => c.path === "/blog/a")!.items.some((i) => i.id === "year-stale"), "after New Year the headline becomes stale");

  // ------------------------------------------------------------------ opportunities
  section("Opportunities");
  const ps = priorityScore(5, 3, "high", "low");
  assert(ps.score === 13 && ps.priority === "high", "score = (impact×2 + value) × confidence ÷ effort");
  assert(priorityScore(2, 1, "low", "high").priority === "low", "low-confidence, high-effort work ranks low");
  const opps = buildOpportunities({ inventory: inv, health, siteChecks: checks, content, gsc: null, organic: null, inspectedAt: NOW.toISOString(), now: NOW });
  assert(opps.every((o) => o.evidence.length > 0 && o.action && o.why), "every opportunity has evidence, a reason, and an action");
  assert(!opps.some((o) => o.category === "search-results"), "no search-result opportunities without Search Console data");
  assert(opps.some((o) => o.id === "technical:critical:/noindex" && o.evidenceType === "site"), "noindex page becomes a site-evidence opportunity");
  assert(opps.some((o) => o.rule === "not-indexed" && o.evidenceType === "google"), "not-indexed pages become a Google-evidence opportunity");
  assert(opps.filter((o) => o.rule === "content-gap").every((o) => o.evidenceType === "research"), "content gaps are labelled research-based");
  assert(opps.every((o, i) => i === 0 || opps[i - 1]!.score >= o.score), "sorted by score");
  assert(new Set(opps.map((o) => o.id)).size === opps.length, "ids are unique (review state keys)");
  assert(!JSON.stringify(opps).match(/\b\d+(\.\d+)?% (more|increase|lift)/i), "no predicted traffic or conversion lifts");

  const withGsc = buildOpportunities({
    inventory: [page("/l", { kind: "solution", commercialValue: 3 }), page("/blog/q")],
    health: [],
    siteChecks: [],
    content: [],
    gsc: {
      startDay: "2026-09-15",
      endDay: "2026-10-12",
      pages: [
        { path: "/l", clicks: 2, impressions: 400, ctr: 0.005, position: 6 },
        { path: "/blog/q", clicks: 1, impressions: 80, ctr: 0.0125, position: 12 },
      ],
      pageQueries: [
        { path: "/l", query: "crm for photographers", clicks: 1, impressions: 50, ctr: 0.02, position: 7 },
        { path: "/blog/q", query: "crm for photographers", clicks: 0, impressions: 30, ctr: 0, position: 14 },
      ],
    },
    organic: null,
    inspectedAt: null,
    now: NOW,
  });
  assert(withGsc.some((o) => o.id === "search:low-ctr:/l" && o.evidenceType === "google"), "low CTR at a page-one position detected");
  assert(withGsc.some((o) => o.id === "search:striking:/blog/q"), "near-page-one page detected");
  assert(withGsc.some((o) => o.id === "search:overlap:crm for photographers" && o.pages.length === 2), "query shared by two pages detected");
  assert(!withGsc.some((o) => o.id === "search:low-ctr:/blog/q"), "low CTR needs ≥100 impressions");

  section("Research content");
  assert(CONTENT_GAPS.every((g) => g.evidence.length && g.checkedAt && g.productFit), "every gap has evidence, a check date, and product fit");
  assert(!JSON.stringify(CONTENT_GAPS).match(/search volume of|\d[\d,]* (monthly )?searches/i), "no search volumes claimed");
  assert(RESEARCH_IDEAS.every((r) => r.ethics.length > 20), "every research idea states its ethics");

  // ------------------------------------------------------------------ conversions
  section("Organic conversions");
  const range = parseReportRange({ range: "30d" }, NOW, "America/Chicago");
  const t = (d: string) => `${d}T15:00:00Z`;
  const attr = (id: string, ft: string, ftPath: string, lt: string, ltPath: string, articles: string[] = []) => ({
    business_id: id, status: "attributed" as const, unknown_reason: null, visitor_key: `v:${id}`,
    ft_channel: ft as never, ft_referrer_host: null, ft_utm_source: null, ft_utm_campaign: null, ft_landing_path: ftPath, ft_at: t("2026-10-01"),
    lt_channel: lt as never, lt_referrer_host: null, lt_utm_source: null, lt_utm_campaign: null, lt_landing_path: ltPath, lt_at: t("2026-10-02"),
    first_article_slug: null, last_article_slug: null, articles_viewed: articles, signup_cta_id: null, signup_cta_location: null, signup_cta_path: null,
    sessions_before_signup: 2, signup_at: t("2026-10-03"),
  });
  const biz = (id: string) => ({ id, name: id, slug: id, created_at: t("2026-10-03"), created_via: "signup", trial_ends_at: "2026-11-01T00:00:00Z", subscription_status: "trialing", is_protected: false, deleted_at: null });
  const input: ReportInput = {
    range,
    now: NOW,
    sessions: [
      { id: "s1", visitor_key: "v:b1", consent_mode: "persistent", started_at: t("2026-10-01"), landing_path: "/l", landing_article_slug: null, channel: "google_organic", referrer_host: "www.google.com", utm_source: null, utm_medium: null, utm_campaign: null, device_class: "desktop" },
      { id: "s2", visitor_key: "v:x", consent_mode: "persistent", started_at: t("2026-10-01"), landing_path: "/l", landing_article_slug: null, channel: "direct", referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: null, device_class: "mobile" },
      { id: "s3", visitor_key: "c:y", consent_mode: "cookieless", started_at: t("2026-10-02"), landing_path: "/blog/q", landing_article_slug: "q", channel: "bing_organic", referrer_host: "www.bing.com", utm_source: null, utm_medium: null, utm_campaign: null, device_class: "desktop" },
    ],
    events: [
      { session_id: "s1", visitor_key: "v:b1", event_type: "pageview", path: "/l", article_slug: null, cta_id: null, cta_location: null, occurred_at: t("2026-10-01") },
      { session_id: "s1", visitor_key: "v:b1", event_type: "cta_click", path: "/l", article_slug: null, cta_id: "seo:crm:hero", cta_location: "hero", occurred_at: t("2026-10-01") },
      { session_id: "s2", visitor_key: "v:x", event_type: "cta_click", path: "/l", article_slug: null, cta_id: "seo:crm:hero", cta_location: "hero", occurred_at: t("2026-10-01") },
      { session_id: "s3", visitor_key: "c:y", event_type: "cta_click", path: "/blog/q", article_slug: "q", cta_id: "tool:drone-pricing:calculated", cta_location: null, occurred_at: t("2026-10-02") },
    ],
    businesses: [biz("b1"), biz("b2"), biz("b3")],
    attribution: [attr("b1", "google_organic", "/l", "direct", "/pricing", ["q"]), attr("b2", "direct", "/l", "google_organic", "/l")],
    firstProjectAt: new Map([["b1", t("2026-10-04")]]),
    payments: [{ business_id: "b1", amount_paid_cents: 2900, paid_at: t("2026-10-05") }],
    lifecycle: [],
    articles: [{ slug: "q", title: "Q" }],
    excludedBusinessIds: new Set(),
  };
  const conv = buildOrganicConversions(input, buildLifecycles(input), [page("/l", { kind: "solution" }), page("/blog/q"), page("/pricing", { kind: "core" })]);
  const rl = conv.rows.find((r) => r.path === "/l")!;
  const rq = conv.rows.find((r) => r.path === "/blog/q")!;
  assert(conv.summary.organicSessions === 2 && conv.summary.sessions === 3, "organic = Google + Bing sessions only");
  assert(rl.entrances === 2 && rl.organicEntrances === 1, "organic entrances exclude direct sessions");
  assert(rl.organicSignupClicks === 1, "signup clicks from direct sessions are not credited to organic");
  assert(rq.organicEngagement === 1 && rq.organicSignupClicks === 0, "tool interactions are separate from signup clicks");
  assert(rl.first.registrations === 1 && rl.first.paid === 1 && rl.first.revenueCents === 2900, "first touch: organic landing on /l credited with paid + revenue");
  assert(rl.last.registrations === 1, "last touch: b2's organic last visit credited to /l");
  assert(conv.rows.find((r) => r.path === "/pricing")!.last.registrations === 0, "direct last touch is never credited as organic");
  assert(rq.assistedRegistrations === 1 && rl.assistedRegistrations === null, "assisted counts only for articles");
  assert(conv.summary.organicFirstTouch === 1 && conv.summary.organicLastTouch === 1 && conv.summary.unknownAttribution === 1, "summary counts, with b3 as unknown attribution");
  assert(sampleConfidence(0) === "none" && sampleConfidence(12) === "too_early" && sampleConfidence(80) === "directional" && sampleConfidence(500) === "reasonable", "sample confidence bands");

  // ------------------------------------------------------------------ access control (static)
  section("Access control");
  const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  assert(/await requireSuperAdminPage\(\)/.test(src("src/app/platform/analytics/seo/growth/page.tsx")), "growth page requires super admin");
  assert(/await requireSuperAdminPage\(\)/.test(src("src/app/platform/analytics/layout.tsx")), "analytics layout requires super admin");
  for (const r of ["refresh", "review"]) {
    const code = src(`src/app/api/platform/seo-growth/${r}/route.ts`);
    assert(/const auth = await requireSuperAdminApi\(\);\s*if \(!auth\.ok\) return auth\.response;/.test(code), `${r} API rejects non-super-admins before doing anything`);
  }
  assert(!/NEXT_PUBLIC_/.test(src("src/lib/seo-growth/url-inspection.ts") + src("src/lib/seo-growth/data.ts")), "Google credentials are never exposed to the client bundle");

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
