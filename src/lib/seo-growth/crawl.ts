import { extractPage, parseRobots, parseSitemap, type ExtractedPage, type RobotsGroup } from "@/lib/seo-growth/html-extract";

/**
 * Read-only HTTP crawl of the public marketing site, the same way a search engine fetches it
 * (plain GET, no JavaScript, no cookies). It never runs the first-party analytics script, so
 * crawls do not count as visits. Used by the dashboard (cached) and by scripts/seo-audit.ts.
 *
 * Everything here is "what our server returns", not what Google has indexed.
 */

export const CRAWLER_USER_AGENT = "ShootPortalSEOAudit/1.0 (+https://www.shootportal.app; internal read-only audit)";

export type PageCrawl = {
  path: string;
  url: string;
  status: number | null;
  /** Final URL after redirects, when different from `url`. */
  redirectedTo: string | null;
  xRobotsTag: string | null;
  contentType: string | null;
  ms: number;
  error: string | null;
  page: ExtractedPage | null;
};

export type LinkCheck = {
  url: string;
  status: number | null;
  /** broken = 404/410 or unreachable; blocked = the site refused an automated check (401/403/429/999). */
  result: "ok" | "redirect" | "broken" | "blocked" | "error";
  sources: string[];
};

export type CrawlResult = {
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  robots: { status: number | null; groups: RobotsGroup[]; error: string | null };
  sitemap: { status: number | null; urls: string[]; error: string | null };
  pages: PageCrawl[];
  /** Internal links to paths outside the monitored inventory, with their HTTP result. */
  otherInternal: LinkCheck[];
  external: LinkCheck[];
  /** True when the external check hit its cap and some links were not checked. */
  externalCapped: boolean;
};

type FetchFn = typeof fetch;

async function timed(fetchFn: FetchFn, url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetchFn(url, { ...init, signal: ctrl.signal, cache: "no-store", headers: { "User-Agent": CRAWLER_USER_AGENT, ...(init.headers ?? {}) } });
    return { res, ms: Date.now() - t0, error: null as string | null };
  } catch (err) {
    const msg = err instanceof Error ? (err.name === "AbortError" ? `timed out after ${timeoutMs / 1000}s` : err.message) : String(err);
    return { res: null, ms: Date.now() - t0, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T, R>(items: readonly T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await run(items[i]!);
      }
    })
  );
  return out;
}

function classify(status: number | null): LinkCheck["result"] {
  if (status === null) return "error";
  if (status >= 200 && status < 300) return "ok";
  if (status >= 300 && status < 400) return "redirect";
  if (status === 404 || status === 410) return "broken";
  if ([401, 403, 429, 999].includes(status)) return "blocked";
  return status >= 500 ? "error" : "ok";
}

async function checkUrl(fetchFn: FetchFn, url: string): Promise<number | null> {
  // HEAD first. Many servers answer HEAD differently from GET (support.google.com returns 404
  // to HEAD and 200 to GET), so every HEAD error is confirmed with a GET before it counts.
  const head = await timed(fetchFn, url, { method: "HEAD", redirect: "manual" }, 8000);
  if (head.res && head.res.status < 400) return head.res.status;
  const get = await timed(fetchFn, url, { method: "GET", redirect: "manual" }, 10000);
  try {
    await get.res?.body?.cancel();
  } catch {
    /* ignore */
  }
  return get.res?.status ?? head.res?.status ?? null;
}

export type CrawlOptions = {
  baseUrl: string;
  paths: readonly string[];
  /** Hostnames treated as "this site" for link extraction. */
  hosts: readonly string[];
  fetchFn?: FetchFn;
  concurrency?: number;
  checkExternal?: boolean;
  maxExternal?: number;
  now?: Date;
};

export async function crawlSite(opts: CrawlOptions): Promise<CrawlResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, "");
  const startedAt = new Date().toISOString();

  const [robotsRes, sitemapRes] = await Promise.all([
    timed(fetchFn, `${base}/robots.txt`, {}, 10000),
    timed(fetchFn, `${base}/sitemap.xml`, {}, 15000),
  ]);
  const robots = {
    status: robotsRes.res?.status ?? null,
    groups: robotsRes.res?.ok ? parseRobots(await robotsRes.res.text()) : [],
    error: robotsRes.error,
  };
  const sitemap = {
    status: sitemapRes.res?.status ?? null,
    urls: sitemapRes.res?.ok ? parseSitemap(await sitemapRes.res.text()) : [],
    error: sitemapRes.error,
  };

  const pages = await pool(opts.paths, opts.concurrency ?? 6, async (path): Promise<PageCrawl> => {
    const url = `${base}${path === "/" ? "/" : path}`;
    const r = await timed(fetchFn, url, { redirect: "follow" }, 20000);
    if (!r.res) return { path, url, status: null, redirectedTo: null, xRobotsTag: null, contentType: null, ms: r.ms, error: r.error, page: null };
    const contentType = r.res.headers.get("content-type");
    const finalUrl = r.res.url && r.res.url !== url ? r.res.url : null;
    let page: ExtractedPage | null = null;
    if (r.res.ok && contentType?.includes("text/html")) page = extractPage(await r.res.text(), r.res.url || url, opts.hosts, opts.now);
    else await r.res.body?.cancel().catch(() => undefined);
    return { path, url, status: r.res.status, redirectedTo: finalUrl, xRobotsTag: r.res.headers.get("x-robots-tag"), contentType, ms: r.ms, error: null, page };
  });

  // Internal links that point outside the monitored list (signup, login, unknown paths…).
  const known = new Set(opts.paths);
  const otherSources = new Map<string, Set<string>>();
  const extSources = new Map<string, Set<string>>();
  for (const p of pages) {
    for (const l of p.page?.internalLinks ?? []) {
      if (known.has(l.path)) continue;
      (otherSources.get(l.path) ?? otherSources.set(l.path, new Set()).get(l.path)!).add(p.path);
    }
    for (const u of p.page?.externalLinks ?? []) (extSources.get(u) ?? extSources.set(u, new Set()).get(u)!).add(p.path);
  }
  const otherPaths = [...otherSources.keys()].slice(0, 150);
  const otherInternal = await pool(otherPaths, 6, async (path): Promise<LinkCheck> => {
    const r = await timed(fetchFn, `${base}${path}`, { redirect: "follow" }, 15000);
    await r.res?.body?.cancel().catch(() => undefined);
    const status = r.res?.status ?? null;
    return { url: path, status, result: classify(status), sources: [...otherSources.get(path)!] };
  });

  const maxExternal = opts.maxExternal ?? 200;
  const extUrls = opts.checkExternal === false ? [] : [...extSources.keys()].slice(0, maxExternal);
  const external = await pool(extUrls, 6, async (url): Promise<LinkCheck> => {
    const status = await checkUrl(fetchFn, url);
    return { url, status, result: classify(status), sources: [...extSources.get(url)!] };
  });

  return {
    baseUrl: base,
    startedAt,
    finishedAt: new Date().toISOString(),
    robots,
    sitemap,
    pages,
    otherInternal,
    external,
    externalCapped: opts.checkExternal !== false && extSources.size > maxExternal,
  };
}
