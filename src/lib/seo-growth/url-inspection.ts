import { accessToken, searchConsoleConfig, type GscConfig } from "@/lib/analytics/search-console";

/**
 * Google Search Console URL Inspection API (read-only, same service account and
 * webmasters.readonly scope as the Search Analytics report). This is Google's own
 * view of a URL: whether it is indexed, when it was last crawled, and which canonical
 * Google chose. Quota: 2,000 inspections/day and 600/minute per property, so callers
 * cache each URL's result for 24 hours and inspect at most MAX_INSPECTIONS URLs per run.
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

export function failedInspection(url: string, err: unknown): UrlInspection {
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

async function inspectOne(cfg: GscConfig | null, token: string, url: string): Promise<UrlInspection> {
  if (!cfg) return failedInspection(url, new Error("Search Console is not configured"));
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
    return failedInspection(url, err);
  }
}

export type InspectionRun =
  | { status: "not_configured" }
  | {
      status: "ok";
      siteUrl: string;
      /** Oldest check time among the results (results may come from different cache fills). */
      checkedAt: string;
      results: UrlInspection[];
      /** URLs beyond MAX_INSPECTIONS, never inspected. */
      skipped: number;
      /** URLs still being inspected when the time budget ran out; they finish in the background. */
      pending: number;
    };

/** Inspect one absolute URL (token minted and cached per service account). Never throws. */
export async function inspectUrl(url: string): Promise<UrlInspection & { checkedAt: string }> {
  const cfg = searchConsoleConfig();
  const checkedAt = new Date().toISOString();
  if (!cfg) return { ...(await inspectOne(null, "", url)), checkedAt };
  try {
    return { ...(await inspectOne(cfg, await accessToken(cfg), url)), checkedAt };
  } catch (err) {
    return { ...failedInspection(url, err), checkedAt };
  }
}

/**
 * Inspect up to MAX_INSPECTIONS URLs, `concurrency` at a time. Google answers each request
 * in roughly 5–7 seconds, so ~55 URLs take ~30s at 12 parallel (well under 600/minute).
 * With `budgetMs`, returns whatever finished in time; unfinished calls keep running and are
 * exposed through `inflight` so a caller can keep the function alive for them (next/server `after`).
 */
export async function inspectUrls(
  urls: readonly string[],
  opts: { concurrency?: number; budgetMs?: number; run?: (url: string) => Promise<UrlInspection & { checkedAt?: string }> } = {}
): Promise<InspectionRun & { inflight?: Promise<unknown> }> {
  const cfg = searchConsoleConfig();
  if (!cfg) return { status: "not_configured" };
  const list = urls.slice(0, MAX_INSPECTIONS);
  const run = opts.run ?? inspectUrl;
  const results: (UrlInspection & { checkedAt?: string })[] = [];
  let next = 0;
  const workers = Promise.all(
    Array.from({ length: Math.min(opts.concurrency ?? 12, list.length) }, async () => {
      while (next < list.length) {
        const url = list[next++]!;
        results.push(await run(url));
      }
    })
  );
  if (opts.budgetMs) await Promise.race([workers, new Promise((r) => setTimeout(r, opts.budgetMs))]);
  else await workers;
  const done = [...results];
  const order = new Map(list.map((u, i) => [u, i]));
  done.sort((a, b) => (order.get(a.url) ?? 0) - (order.get(b.url) ?? 0));
  const times = done.map((r) => r.checkedAt).filter((t): t is string => !!t).sort();
  return {
    status: "ok",
    siteUrl: cfg.siteUrl,
    checkedAt: times[0] ?? new Date().toISOString(),
    results: done,
    skipped: urls.length - list.length,
    pending: list.length - done.length,
    inflight: done.length < list.length ? workers : undefined,
  };
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
