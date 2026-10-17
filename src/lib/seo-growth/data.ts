import { unstable_cache } from "next/cache";
import { getCanonicalSiteUrl, getPlatformRootDomain } from "@/lib/site-metadata";
import { loadSearchConsole, query, searchConsoleConfig } from "@/lib/analytics/search-console";
import { addDays, parseReportRange } from "@/lib/analytics/range";
import { loadReport } from "@/lib/analytics/report-data";
import { buildLifecycles } from "@/lib/analytics/aggregate";
import { buildInventory } from "@/lib/seo-growth/inventory";
import { crawlSite, type CrawlResult } from "@/lib/seo-growth/crawl";
import { inspectUrls, loadSitemapStatus, type InspectionRun } from "@/lib/seo-growth/url-inspection";
import { assessPages, googleState, siteChecks } from "@/lib/seo-growth/health";
import { auditContent } from "@/lib/seo-growth/content-audit";
import { buildOrganicConversions } from "@/lib/seo-growth/conversions";
import { buildOpportunities, type GscInput } from "@/lib/seo-growth/opportunities";
import { loadIndexHistory, loadReviewStates, recordIndexSnapshot } from "@/lib/seo-growth/store";

/**
 * Server-only assembly of the SEO Growth dashboard. Callers MUST have passed
 * requireSuperAdminPage() / requireSuperAdminApi().
 *
 * Expensive work is cached under the "seo-growth" tag:
 *  - site crawl: 24h (≈60 page fetches + external link checks)
 *  - Google URL Inspection: 24h (≈60 of the 2,000/day quota)
 *  - Search Console sitemaps + page×query rows: 6h
 * The Refresh button expires the tag. Nothing runs on a schedule.
 */

export const SEO_GROWTH_TAG = "seo-growth";
const DAY = 24 * 60 * 60;

function crawlHosts(): string[] {
  const root = getPlatformRootDomain().toLowerCase();
  const canonical = new URL(getCanonicalSiteUrl()).hostname.toLowerCase();
  return [...new Set([canonical, root, `www.${root}`])];
}

function monitoredUrls(): string[] {
  const origin = getCanonicalSiteUrl();
  return buildInventory()
    .filter((p) => p.monitor)
    .map((p) => `${origin}${p.path === "/" ? "/" : p.path}`);
}

const cachedCrawl = unstable_cache(
  async (baseUrl: string): Promise<CrawlResult> =>
    crawlSite({ baseUrl, paths: buildInventory().map((p) => p.path), hosts: crawlHosts() }),
  ["seo-growth-crawl-v1"],
  { revalidate: DAY, tags: [SEO_GROWTH_TAG] }
);

const cachedInspection = unstable_cache(
  async (siteUrl: string): Promise<InspectionRun> => {
    void siteUrl; // part of the cache key
    const run = await inspectUrls(monitoredUrls());
    if (run.status === "ok") {
      const states = run.results.filter((r) => r.ok).map((r) => ({ path: r.path, state: googleState(r) }));
      if (states.length) {
        await recordIndexSnapshot({
          inspected: states.length,
          indexed: states.filter((s) => s.state === "indexed").length,
          waiting: states.filter((s) => s.state === "waiting").length,
          unknown: states.filter((s) => s.state === "unknown_to_google").length,
          other: states.filter((s) => !["indexed", "waiting", "unknown_to_google"].includes(s.state)).length,
          indexedPaths: states.filter((s) => s.state === "indexed").map((s) => s.path),
        }).catch((err) => console.error("[seo-growth] snapshot failed", err));
      }
    }
    return run;
  },
  ["seo-growth-inspection-v1"],
  { revalidate: DAY, tags: [SEO_GROWTH_TAG] }
);

const cachedSitemaps = unstable_cache(async (siteUrl: string) => (void siteUrl, loadSitemapStatus()), ["seo-growth-sitemaps-v1"], {
  revalidate: 6 * 60 * 60,
  tags: [SEO_GROWTH_TAG],
});

function pathOf(page: string): string {
  try {
    return new URL(page).pathname.replace(/\/$/, "") || "/";
  } catch {
    return page;
  }
}

const cachedPageQueries = unstable_cache(
  async (siteUrl: string, startDate: string, endDate: string) => {
    const cfg = searchConsoleConfig();
    if (!cfg || cfg.siteUrl !== siteUrl) return [];
    const rows = await query(cfg, { startDate, endDate, dataState: "final", dimensions: ["page", "query"], rowLimit: 5000 });
    return rows.map((r) => ({
      path: pathOf(r.keys?.[0] ?? ""),
      query: r.keys?.[1] ?? "",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.impressions ? r.ctr : null,
      position: r.impressions ? r.position : null,
    }));
  },
  ["seo-growth-page-queries-v1"],
  { revalidate: 6 * 60 * 60, tags: [SEO_GROWTH_TAG] }
);

async function settle<T>(label: string, warnings: string[], run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[seo-growth] ${label} failed`, message);
    warnings.push(`${label}: ${message}`);
    return null;
  }
}

export async function loadSeoGrowth(now = new Date()) {
  const warnings: string[] = [];
  const inventory = buildInventory();
  const origin = getCanonicalSiteUrl();
  const gscCfg = searchConsoleConfig();
  // Google's data lags 2–3 days; use the 28 complete days before that.
  const range = parseReportRange({ range: "90d" }, now);
  const gscEnd = addDays(range.endDay, -3);
  const gscStart = addDays(gscEnd, -27);

  const [crawl, inspection, sitemaps, gscReport, pageQueries, report, reviews, history] = await Promise.all([
    settle("Site crawl", warnings, () => cachedCrawl(origin)),
    gscCfg ? settle("URL Inspection", warnings, () => cachedInspection(gscCfg.siteUrl)) : Promise.resolve({ status: "not_configured" } as InspectionRun),
    gscCfg ? settle("Search Console sitemaps", warnings, () => cachedSitemaps(gscCfg.siteUrl)) : Promise.resolve(null),
    loadSearchConsole(gscStart, gscEnd),
    gscCfg ? settle("Search Console queries", warnings, () => cachedPageQueries(gscCfg.siteUrl, gscStart, gscEnd)) : Promise.resolve(null),
    settle("First-party analytics", warnings, () => loadReport(range, null, now)),
    settle("Review states", warnings, () => loadReviewStates()),
    settle("Index history", warnings, () => loadIndexHistory()),
  ]);

  if (gscReport.status === "error") warnings.push(`Search Console performance: ${gscReport.message}`);
  const sitemapList = sitemaps && sitemaps.status === "ok" ? sitemaps.sitemaps : null;
  if (sitemaps && sitemaps.status === "error") warnings.push(`Search Console sitemaps: ${sitemaps.message}`);
  if (reviews?.error) warnings.push(`Review states: ${reviews.error}`);
  if (report?.loadError) warnings.push(`First-party analytics: ${report.loadError}`);

  const health = assessPages({ inventory, crawl, inspection, canonicalOrigin: origin, now });
  const checks = siteChecks({ crawl, sitemaps: sitemapList, canonicalOrigin: origin, inventory });
  const content = auditContent({ inventory, crawl, now });

  const gsc: GscInput | null =
    gscReport.status === "ok"
      ? {
          pages: gscReport.report.pages.map((p) => ({ path: p.path, clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position })),
          pageQueries: pageQueries ?? [],
          startDay: gscStart,
          endDay: gscEnd,
        }
      : null;

  const organic =
    report && report.tablesReady
      ? buildOrganicConversions(report.current, buildLifecycles(report.current), inventory)
      : null;

  const opportunities = buildOpportunities({
    inventory,
    health,
    siteChecks: checks,
    content,
    gsc,
    organic: organic?.rows ?? null,
    inspectedAt: inspection?.status === "ok" ? inspection.checkedAt : null,
    now,
  });

  return {
    origin,
    inventory,
    crawl,
    inspection,
    gscConfigured: !!gscCfg,
    gsc,
    gscTotals: gscReport.status === "ok" ? gscReport.report.totals : null,
    health,
    checks,
    content,
    organic,
    organicRange: { startDay: range.startDay, endDay: range.endDay },
    analyticsReady: !!report?.tablesReady,
    opportunities,
    reviews: reviews?.states ?? new Map(),
    history: history ?? [],
    warnings,
  };
}

export type SeoGrowthData = Awaited<ReturnType<typeof loadSeoGrowth>>;
