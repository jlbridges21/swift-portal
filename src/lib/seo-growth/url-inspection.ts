import { accessToken, searchConsoleConfig, type GscConfig } from "@/lib/analytics/search-console";

/**
 * Google Search Console URL Inspection API (read-only, same service account and
 * webmasters.readonly scope as the Search Analytics report). This is Google's own
 * view of a URL: whether it is indexed, when it was last crawled, and which canonical
 * Google chose. Quota: 2,000 inspections/day and 600/minute per property, so callers
 * cache results for 24 hours and inspect at most MAX_INSPECTIONS URLs per run.
 *
 * It does NOT request indexing. Google offers no supported bulk "index this" API for
 * normal pages; use "Request indexing" in Search Console for individual URLs.
 */

export const MAX_INSPECTIONS = 80;

export type IndexVerdict = "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL" | "VERDICT_UNSPECIFIED";

export type UrlInspection = {
  url: string;
  path: string;
  ok: boolean;
  error: string | null;
  verdict: IndexVerdict | null;
  /** Google's wording, e.g. "Submitted and indexed", "Discovered - currently not indexed". */
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  sitemaps: string[];
  referringUrls: string[];
  richResults: { verdict: string | null; types: string[]; issues: { type: string; message: string; severity: string }[] } | null;
  inspectionLink: string | null;
};

type ApiResponse = {
  inspectionResult?: {
    inspectionResultLink?: string;
    indexStatusResult?: {
      verdict?: IndexVerdict;
      coverageState?: string;
      indexingState?: string;
      robotsTxtState?: string;
      pageFetchState?: string;
      lastCrawlTime?: string;
      googleCanonical?: string;
      userCanonical?: string;
      sitemap?: string[];
      referringUrls?: string[];
    };
    richResultsResult?: {
      verdict?: string;
      detectedItems?: { richResultType?: string; items?: { name?: string; issues?: { issueMessage?: string; severity?: string }[] }[] }[];
    };
  };
  error?: { message?: string; status?: string };
};

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

export function parseInspection(url: string, json: ApiResponse): UrlInspection {
  const r = json.inspectionResult ?? {};
  const s = r.indexStatusResult ?? {};
  const rich = r.richResultsResult;
  return {
    url,
    path: pathOf(url),
    ok: true,
    error: null,
    verdict: s.verdict ?? null,
    coverageState: s.coverageState ?? null,
    indexingState: s.indexingState ?? null,
    robotsTxtState: s.robotsTxtState ?? null,
    pageFetchState: s.pageFetchState ?? null,
    lastCrawlTime: s.lastCrawlTime ?? null,
    googleCanonical: s.googleCanonical ?? null,
    userCanonical: s.userCanonical ?? null,
    sitemaps: s.sitemap ?? [],
    referringUrls: s.referringUrls ?? [],
    richResults: rich
      ? {
          verdict: rich.verdict ?? null,
          types: (rich.detectedItems ?? []).map((d) => d.richResultType ?? "").filter(Boolean),
          issues: (rich.detectedItems ?? []).flatMap((d) =>
            (d.items ?? []).flatMap((i) =>
              (i.issues ?? []).map((x) => ({ type: d.richResultType ?? "", message: x.issueMessage ?? "", severity: x.severity ?? "" }))
            )
          ),
        }
      : null,
    inspectionLink: r.inspectionResultLink ?? null,
  };
}

async function inspectOne(cfg: GscConfig, token: string, url: string): Promise<UrlInspection> {
  try {
    const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: cfg.siteUrl, languageCode: "en-US" }),
      cache: "no-store",
    });
    const json = (await res.json()) as ApiResponse;
    if (!res.ok) throw new Error(json.error?.message || `URL inspection failed (${res.status})`);
    return parseInspection(url, json);
  } catch (err) {
    return {
      url,
      path: pathOf(url),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      verdict: null,
      coverageState: null,
      indexingState: null,
      robotsTxtState: null,
      pageFetchState: null,
      lastCrawlTime: null,
      googleCanonical: null,
      userCanonical: null,
      sitemaps: [],
      referringUrls: [],
      richResults: null,
      inspectionLink: null,
    };
  }
}

export type InspectionRun =
  | { status: "not_configured" }
  | { status: "ok"; siteUrl: string; checkedAt: string; results: UrlInspection[]; skipped: number };

/** Inspect up to MAX_INSPECTIONS absolute URLs, 4 at a time (well under 600/minute). */
export async function inspectUrls(urls: readonly string[]): Promise<InspectionRun> {
  const cfg = searchConsoleConfig();
  if (!cfg) return { status: "not_configured" };
  const list = urls.slice(0, MAX_INSPECTIONS);
  const token = await accessToken(cfg);
  const results: UrlInspection[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < list.length) {
        const i = next++;
        results[i] = await inspectOne(cfg, token, list[i]!);
      }
    })
  );
  return { status: "ok", siteUrl: cfg.siteUrl, checkedAt: new Date().toISOString(), results, skipped: urls.length - list.length };
}

export type SitemapStatus = {
  path: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  isPending: boolean;
  errors: number;
  warnings: number;
  submitted: number | null;
  /** Google stopped reporting this for most properties; often 0 or absent. Not used as an index count. */
  indexedReported: number | null;
};

/** Sitemaps Google has on file for the property (Search Console API, read-only). */
export async function loadSitemapStatus(): Promise<{ status: "not_configured" } | { status: "ok"; sitemaps: SitemapStatus[] } | { status: "error"; message: string }> {
  const cfg = searchConsoleConfig();
  if (!cfg) return { status: "not_configured" };
  try {
    const token = await accessToken(cfg);
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.siteUrl)}/sitemaps`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = (await res.json()) as {
      sitemap?: { path?: string; lastSubmitted?: string; lastDownloaded?: string; isPending?: boolean; errors?: string; warnings?: string; contents?: { submitted?: string; indexed?: string }[] }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message || `Sitemaps request failed (${res.status})`);
    return {
      status: "ok",
      sitemaps: (json.sitemap ?? []).map((s) => ({
        path: s.path ?? "",
        lastSubmitted: s.lastSubmitted ?? null,
        lastDownloaded: s.lastDownloaded ?? null,
        isPending: !!s.isPending,
        errors: Number(s.errors ?? 0),
        warnings: Number(s.warnings ?? 0),
        submitted: s.contents?.length ? s.contents.reduce((n, c) => n + Number(c.submitted ?? 0), 0) : null,
        indexedReported: s.contents?.length ? s.contents.reduce((n, c) => n + Number(c.indexed ?? 0), 0) : null,
      })),
    };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
