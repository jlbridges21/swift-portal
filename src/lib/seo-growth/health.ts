import { isNoindex, robotsAllows } from "@/lib/seo-growth/html-extract";
import type { CrawlResult, PageCrawl } from "@/lib/seo-growth/crawl";
import type { InventoryPage } from "@/lib/seo-growth/inventory";
import type { InspectionRun, SitemapStatus, UrlInspection } from "@/lib/seo-growth/url-inspection";

/**
 * Turns crawl results and Google URL Inspection into a per-page status with plain-English
 * issues. Pure. Every issue names its source: "google" (Google's own report) or "site"
 * (what our server returned to an automated fetch). A site check passing never implies
 * that Google indexed the page.
 */

export type Severity = "critical" | "warning" | "info";
export type HealthStatus = "healthy" | "attention" | "critical" | "unknown";

export type HealthIssue = {
  id: string;
  severity: Severity;
  source: "google" | "site";
  title: string;
  /** Technical detail shown when expanded. */
  detail: string;
  /** What to do, in plain English. */
  fix?: string;
};

export type GoogleIndexState = "indexed" | "waiting" | "unknown_to_google" | "crawled_not_indexed" | "excluded" | "error" | "not_checked";

export type PageHealth = {
  path: string;
  url: string;
  page: InventoryPage;
  status: HealthStatus;
  google: {
    state: GoogleIndexState;
    label: string;
    coverageState: string | null;
    lastCrawlTime: string | null;
    googleCanonical: string | null;
    userCanonical: string | null;
    inspectionLink: string | null;
    inSitemapPerGoogle: boolean | null;
  };
  site: {
    httpStatus: number | null;
    inSitemap: boolean;
    robotsAllowed: boolean | null;
    indexable: boolean | null;
    canonical: string | null;
    title: string | null;
    description: string | null;
    wordCount: number | null;
    /** Distinct monitored pages that link here from their content (not nav/footer). */
    contextualInbound: number;
    contextualInboundFrom: string[];
    responseMs: number | null;
  };
  issues: HealthIssue[];
};

export const GOOGLE_STATE_LABELS: Record<GoogleIndexState, string> = {
  indexed: "Indexed",
  waiting: "Discovered, not crawled yet",
  unknown_to_google: "Not yet known to Google",
  crawled_not_indexed: "Crawled, not indexed",
  excluded: "Excluded from index",
  error: "Inspection failed",
  not_checked: "Not checked",
};

export function googleState(i: UrlInspection | undefined): GoogleIndexState {
  if (!i) return "not_checked";
  if (!i.ok) return "error";
  const c = (i.coverageState ?? "").toLowerCase();
  if (i.verdict === "PASS") return "indexed";
  if (c.includes("unknown to google")) return "unknown_to_google";
  if (c.includes("discovered")) return "waiting";
  if (c.includes("crawled")) return "crawled_not_indexed";
  if (i.verdict === "FAIL" || c.includes("excluded") || c.includes("blocked") || c.includes("not found") || c.includes("redirect") || c.includes("duplicate") || c.includes("alternate"))
    return "excluded";
  return i.verdict === "NEUTRAL" ? "crawled_not_indexed" : "error";
}

function normalizeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.hostname.toLowerCase()}${x.pathname.replace(/\/+$/, "") || "/"}`;
  } catch {
    return u;
  }
}

/** Distinct monitored source pages linking to each path from page content. */
export function contextualInbound(pages: readonly PageCrawl[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const p of pages) {
    for (const l of new Set((p.page?.contextualLinks ?? []).map((x) => x.path))) {
      if (l === p.path) continue;
      (map.get(l) ?? map.set(l, new Set()).get(l)!).add(p.path);
    }
  }
  return new Map([...map].map(([k, v]) => [k, [...v].sort()]));
}

export function assessPages(input: {
  inventory: readonly InventoryPage[];
  crawl: CrawlResult | null;
  inspection: InspectionRun | null;
  canonicalOrigin: string;
  now?: Date;
}): PageHealth[] {
  const { inventory, crawl, inspection } = input;
  const origin = input.canonicalOrigin.replace(/\/$/, "");
  const now = input.now ?? new Date();
  const crawlBy = new Map((crawl?.pages ?? []).map((p) => [p.path, p]));
  const inspectBy = new Map(inspection?.status === "ok" ? inspection.results.map((r) => [r.path, r]) : []);
  const sitemapPaths = new Set((crawl?.sitemap.urls ?? []).map((u) => normalizeUrl(u)));
  const inbound = contextualInbound(crawl?.pages ?? []);

  return inventory.map((page): PageHealth => {
    const url = `${origin}${page.path === "/" ? "/" : page.path}`;
    const c = crawlBy.get(page.path);
    const x = c?.page ?? null;
    const g = inspectBy.get(page.path);
    const gState = googleState(g);
    const issues: HealthIssue[] = [];
    const add = (i: HealthIssue) => issues.push(i);

    // ---- Google (measured by Google)
    if (g && !g.ok) {
      add({ id: "google-error", severity: "info", source: "google", title: "Google's inspection could not be loaded", detail: g.error ?? "Unknown error" });
    } else if (g) {
      const published = page.article?.publishedAt ? Date.parse(`${page.article.publishedAt}T00:00:00Z`) : null;
      const ageDays = published ? Math.floor((now.getTime() - published) / 86_400_000) : null;
      const old = ageDays !== null && ageDays > 45;
      if (gState === "waiting" || gState === "unknown_to_google") {
        add({
          id: "google-not-indexed",
          severity: page.commercialValue >= 2 || old ? "warning" : "info",
          source: "google",
          title: gState === "waiting" ? "Google knows about this page but hasn't crawled it yet" : "Google hasn't discovered this page yet",
          detail: `Coverage: "${g.coverageState ?? "—"}". Last crawl: ${g.lastCrawlTime ?? "never"}.`,
          fix:
            "Nothing on the page blocks indexing. New sites are crawled slowly. Use \"Request indexing\" in Search Console for the most important URLs (about 10 per day), keep linking to it from indexed pages, and earn links from other sites.",
        });
      } else if (gState === "crawled_not_indexed") {
        add({
          id: "google-crawled-not-indexed",
          severity: "warning",
          source: "google",
          title: "Google crawled this page but chose not to index it",
          detail: `Coverage: "${g.coverageState ?? "—"}". Last crawl: ${g.lastCrawlTime ?? "unknown"}.`,
          fix: "Usually a quality or duplication signal. Make the page more distinct and useful than similar pages, add internal links from strong pages, then request indexing again.",
        });
      } else if (gState === "excluded") {
        add({
          id: "google-excluded",
          severity: "critical",
          source: "google",
          title: "Google excluded this page from its index",
          detail: `Coverage: "${g.coverageState ?? "—"}". Robots: ${g.robotsTxtState ?? "—"}. Fetch: ${g.pageFetchState ?? "—"}. Indexing: ${g.indexingState ?? "—"}.`,
          fix: "Open the inspection in Search Console to see the exact reason, fix it on the site, then use \"Validate fix\" or \"Request indexing\".",
        });
      }
      const gc = normalizeUrl(g.googleCanonical);
      const uc = normalizeUrl(g.userCanonical);
      if (gc && uc && gc !== uc) {
        add({
          id: "google-canonical",
          severity: "critical",
          source: "google",
          title: "Google picked a different version of this page as the main URL",
          detail: `Your canonical: ${g.userCanonical}. Google's choice: ${g.googleCanonical}.`,
          fix: "Make the page clearly distinct from the URL Google chose, or point internal links and the sitemap at one version consistently.",
        });
      }
      for (const ri of g.richResults?.issues ?? []) {
        if (ri.severity.toUpperCase() !== "ERROR") continue;
        add({ id: `google-rich-${ri.type}`, severity: "warning", source: "google", title: "Structured data has an error Google reported", detail: `${ri.type}: ${ri.message}` });
      }
    }

    // ---- Site (what our server returns)
    let indexable: boolean | null = null;
    let robotsAllowed: boolean | null = null;
    if (c) {
      if (c.status === null || c.status >= 400) {
        add({ id: "site-status", severity: "critical", source: "site", title: "The page didn't load for an automated visitor", detail: c.error ?? `HTTP ${c.status}` });
      }
      if (c.redirectedTo) {
        add({ id: "site-redirect", severity: "warning", source: "site", title: "This URL redirects somewhere else", detail: `${c.url} → ${c.redirectedTo}`, fix: "Link to and list the final URL in the sitemap instead." });
      }
      robotsAllowed = crawl?.robots.groups.length ? robotsAllows(crawl.robots.groups, page.path) : null;
      if (robotsAllowed === false) {
        add({ id: "site-robots", severity: "critical", source: "site", title: "robots.txt blocks Google from this page", detail: `A Disallow rule in /robots.txt matches ${page.path}.`, fix: "Remove or narrow the Disallow rule in src/app/robots.ts." });
      }
      const noindex = isNoindex(x?.metaRobots) || isNoindex(c.xRobotsTag);
      indexable = c.status === 200 ? !noindex : null;
      if (noindex && page.monitor) {
        add({
          id: "site-noindex",
          severity: "critical",
          source: "site",
          title: "The page tells search engines not to index it",
          detail: `meta robots: ${x?.metaRobots ?? "—"}; X-Robots-Tag: ${c.xRobotsTag ?? "—"}`,
          fix: "Remove the noindex directive from the page's metadata.",
        });
      }
      if (x) {
        const canonical = normalizeUrl(x.canonical);
        if (!x.canonical) add({ id: "site-canonical-missing", severity: "warning", source: "site", title: "No canonical URL declared", detail: "No <link rel=\"canonical\"> found." });
        else if (canonical !== normalizeUrl(url))
          add({
            id: "site-canonical-other",
            severity: "critical",
            source: "site",
            title: "The page names a different URL as its main version",
            detail: `Canonical is ${x.canonical}; expected ${url}.`,
            fix: "Set alternates.canonical to the page's own URL.",
          });
        if (!x.title) add({ id: "site-title", severity: "warning", source: "site", title: "Missing page title", detail: "No <title> element." });
        else if (x.title.length > 70) add({ id: "site-title-long", severity: "info", source: "site", title: "Title may be cut off in search results", detail: `${x.title.length} characters: "${x.title}"` });
        if (!x.metaDescription) add({ id: "site-description", severity: "warning", source: "site", title: "Missing meta description", detail: "No <meta name=\"description\">." });
        else if (x.metaDescription.length > 170) add({ id: "site-description-long", severity: "info", source: "site", title: "Description may be cut off in search results", detail: `${x.metaDescription.length} characters.` });
        if (x.h1.length !== 1 && page.kind !== "legal") add({ id: "site-h1", severity: "info", source: "site", title: x.h1.length ? "More than one main heading (H1)" : "No main heading (H1)", detail: `${x.h1.length} H1 elements.` });
        if (x.imagesMissingAlt > 0) add({ id: "site-alt", severity: "info", source: "site", title: "Images without alt text", detail: `${x.imagesMissingAlt} of ${x.images} <img> tags have no alt attribute.` });
        if (x.jsonLdErrors > 0) add({ id: "site-jsonld", severity: "warning", source: "site", title: "Structured data couldn't be parsed", detail: `${x.jsonLdErrors} JSON-LD block(s) are invalid JSON.` });
        if (page.kind === "article" && x.wordCount < 600) add({ id: "site-thin", severity: "info", source: "site", title: "Very short article", detail: `About ${x.wordCount} words of visible text.` });
      }
    }
    if (crawl && crawl.sitemap.urls.length && !sitemapPaths.has(normalizeUrl(url)) && page.monitor) {
      add({ id: "site-sitemap", severity: "warning", source: "site", title: "Missing from the sitemap", detail: `${url} is not listed in /sitemap.xml.`, fix: "Add it to src/app/sitemap.ts (or its registry)." });
    }
    const from = inbound.get(page.path) ?? [];
    if (crawl && page.monitor && !["home", "legal", "company"].includes(page.kind)) {
      if (from.length === 0)
        add({
          id: "site-orphan",
          severity: page.commercialValue >= 2 ? "warning" : "info",
          source: "site",
          title: "No other page links here from its content",
          detail: "Only header/footer navigation links to this page.",
          fix: "Add a contextual link from a closely related article or landing page.",
        });
      else if (from.length <= 3 && page.commercialValue === 3)
        add({
          id: "site-few-links",
          severity: "info",
          source: "site",
          title: "Few in-content links point to this landing page",
          detail: `Linked from ${from.length} page(s): ${from.join(", ")}.`,
          fix: "Link to it from the most relevant articles with descriptive anchor text.",
        });
    }

    const status: HealthStatus = issues.some((i) => i.severity === "critical")
      ? "critical"
      : issues.some((i) => i.severity === "warning")
        ? "attention"
        : gState === "indexed"
          ? "healthy"
          : gState === "not_checked" || gState === "error"
            ? "unknown"
            : "attention";

    return {
      path: page.path,
      url,
      page,
      status,
      google: {
        state: gState,
        label: GOOGLE_STATE_LABELS[gState],
        coverageState: g?.coverageState ?? null,
        lastCrawlTime: g?.lastCrawlTime ?? null,
        googleCanonical: g?.googleCanonical ?? null,
        userCanonical: g?.userCanonical ?? null,
        inspectionLink: g?.inspectionLink ?? null,
        inSitemapPerGoogle: g?.ok ? g.sitemaps.length > 0 : null,
      },
      site: {
        httpStatus: c?.status ?? null,
        inSitemap: sitemapPaths.has(normalizeUrl(url)),
        robotsAllowed,
        indexable,
        canonical: x?.canonical ?? null,
        title: x?.title ?? null,
        description: x?.metaDescription ?? null,
        wordCount: x?.wordCount ?? null,
        contextualInbound: from.length,
        contextualInboundFrom: from,
        responseMs: c?.ms ?? null,
      },
      issues: issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
    };
  });
}

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export type SiteCheck = { id: string; ok: boolean | null; severity: Severity; title: string; detail: string };

/** Site-wide checks: robots.txt, sitemap, Google's sitemap report, broken links. */
export function siteChecks(input: { crawl: CrawlResult | null; sitemaps: SitemapStatus[] | null; canonicalOrigin: string; inventory: readonly InventoryPage[] }): SiteCheck[] {
  const out: SiteCheck[] = [];
  const { crawl } = input;
  if (crawl) {
    out.push({
      id: "robots",
      ok: crawl.robots.status === 200,
      severity: "critical",
      title: crawl.robots.status === 200 ? "robots.txt is reachable" : "robots.txt could not be fetched",
      detail: crawl.robots.error ?? `HTTP ${crawl.robots.status}`,
    });
    out.push({
      id: "sitemap",
      ok: crawl.sitemap.status === 200 && crawl.sitemap.urls.length > 0,
      severity: "critical",
      title: crawl.sitemap.status === 200 ? `sitemap.xml lists ${crawl.sitemap.urls.length} URLs` : "sitemap.xml could not be fetched",
      detail: crawl.sitemap.error ?? `HTTP ${crawl.sitemap.status}`,
    });
    const monitored = new Set(input.inventory.map((p) => normalizeUrl(`${input.canonicalOrigin}${p.path === "/" ? "/" : p.path}`)));
    const extra = crawl.sitemap.urls.filter((u) => !monitored.has(normalizeUrl(u)));
    if (extra.length)
      out.push({ id: "sitemap-extra", ok: null, severity: "info", title: `${extra.length} sitemap URL(s) aren't in the monitored page list`, detail: extra.slice(0, 10).join(", ") });
    const brokenInternal = crawl.otherInternal.filter((l) => l.result === "broken" || l.result === "error");
    out.push({
      id: "internal-links",
      ok: brokenInternal.length === 0,
      severity: "critical",
      title: brokenInternal.length ? `${brokenInternal.length} broken internal link target(s)` : "No broken internal links found",
      detail: brokenInternal.map((l) => `${l.url} (${l.status ?? "no response"}) from ${l.sources.slice(0, 3).join(", ")}`).join("; ") || "All internal link targets returned a success status.",
    });
    const brokenExternal = crawl.external.filter((l) => l.result === "broken");
    out.push({
      id: "external-links",
      ok: brokenExternal.length === 0,
      severity: "warning",
      title: brokenExternal.length ? `${brokenExternal.length} broken external link(s)` : `No broken external links (${crawl.external.length} checked)`,
      detail:
        brokenExternal.map((l) => `${l.url} (${l.status ?? "unreachable"}) on ${l.sources.join(", ")}`).join("; ") ||
        `${crawl.external.filter((l) => l.result === "blocked").length} site(s) refused automated checks and were not counted as broken.`,
    });
  }
  if (input.sitemaps) {
    const main = input.sitemaps.find((s) => normalizeUrl(s.path) === normalizeUrl(`${input.canonicalOrigin}/sitemap.xml`));
    out.push(
      main
        ? {
            id: "gsc-sitemap",
            ok: main.errors === 0,
            severity: main.errors ? "warning" : "info",
            title: main.errors ? `Google reports ${main.errors} sitemap error(s)` : "Google has the sitemap with no errors",
            detail: `Submitted ${main.lastSubmitted?.slice(0, 10) ?? "—"}, last read by Google ${main.lastDownloaded?.slice(0, 10) ?? "—"}${main.submitted !== null ? `, ${main.submitted} URLs` : ""}.`,
          }
        : { id: "gsc-sitemap", ok: false, severity: "warning", title: "The sitemap hasn't been submitted in Search Console", detail: "Search Console → Sitemaps → add sitemap.xml." }
    );
  }
  return out;
}
