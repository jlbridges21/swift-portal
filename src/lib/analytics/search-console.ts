import { createSign } from "node:crypto";
import { unstable_cache } from "next/cache";

/**
 * Read-only Google Search Console client (service account, scope webmasters.readonly).
 * Credentials stay server-side. Results are cached for 6 hours; Google's data lags
 * 2–3 days and is reported by Pacific Time day. Nothing here is ever sampled or faked:
 * without credentials the dashboard shows "Not connected".
 *
 * Env: GSC_SITE_URL (e.g. "sc-domain:shootportal.app"), GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY.
 */

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type GscConfig = { siteUrl: string; clientEmail: string; privateKey: string };

export function searchConsoleConfig(): GscConfig | null {
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  const clientEmail = process.env.GSC_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!siteUrl || !clientEmail || !privateKey) return null;
  return { siteUrl, clientEmail, privateKey };
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

const tokenCache = new Map<string, { token: string; exp: number }>();

async function accessToken(cfg: GscConfig): Promise<string> {
  const cached = tokenCache.get(cfg.clientEmail);
  if (cached && cached.exp - 60_000 > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: cfg.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64url(signer.sign(cfg.privateKey))}`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(json.error_description || `token request failed (${res.status})`);
  tokenCache.set(cfg.clientEmail, { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

async function query(cfg: GscConfig, body: Record<string, unknown>): Promise<GscRow[]> {
  const token = await accessToken(cfg);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  const json = (await res.json()) as { rows?: GscRow[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Search Console query failed (${res.status})`);
  return json.rows ?? [];
}

export type SeoMetrics = { clicks: number; impressions: number; ctr: number | null; position: number | null };

export type SeoReport = {
  totals: SeoMetrics;
  daily: ({ date: string } & SeoMetrics)[];
  pages: ({ page: string; path: string; articleSlug: string | null } & SeoMetrics)[];
  queries: ({ query: string } & SeoMetrics)[];
  articleQueries: Record<string, ({ query: string } & SeoMetrics)[]>;
  fetchedAt: string;
};

export type SeoResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; siteUrl: string; report: SeoReport };

function metrics(r: GscRow): SeoMetrics {
  return { clicks: r.clicks, impressions: r.impressions, ctr: r.impressions ? r.ctr : null, position: r.impressions ? r.position : null };
}

function pathOf(page: string): string {
  try {
    return new URL(page).pathname.replace(/\/$/, "") || "/";
  } catch {
    return page;
  }
}

async function fetchReport(siteUrl: string, startDate: string, endDate: string): Promise<SeoReport> {
  const cfg = searchConsoleConfig();
  if (!cfg || cfg.siteUrl !== siteUrl) throw new Error("Search Console is not configured");
  const base = { startDate, endDate, dataState: "final" };
  const [totalsRows, dailyRows, pageRows, queryRows, pageQueryRows] = await Promise.all([
    query(cfg, { ...base }),
    query(cfg, { ...base, dimensions: ["date"], rowLimit: 500 }),
    query(cfg, { ...base, dimensions: ["page"], rowLimit: 500 }),
    query(cfg, { ...base, dimensions: ["query"], rowLimit: 100 }),
    query(cfg, { ...base, dimensions: ["page", "query"], rowLimit: 5000, dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: "/blog/" }] }] }),
  ]);
  const articleQueries: SeoReport["articleQueries"] = {};
  for (const r of pageQueryRows) {
    const m = /^\/blog\/([a-z0-9-]+)$/.exec(pathOf(r.keys?.[0] ?? ""));
    if (!m) continue;
    (articleQueries[m[1]!] ??= []).push({ query: r.keys?.[1] ?? "", ...metrics(r) });
  }
  for (const k of Object.keys(articleQueries)) articleQueries[k]!.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).splice(25);
  return {
    totals: totalsRows[0] ? metrics(totalsRows[0]) : { clicks: 0, impressions: 0, ctr: null, position: null },
    daily: dailyRows.map((r) => ({ date: r.keys?.[0] ?? "", ...metrics(r) })),
    pages: pageRows.map((r) => {
      const page = r.keys?.[0] ?? "";
      const path = pathOf(page);
      const m = /^\/blog\/([a-z0-9-]+)$/.exec(path);
      return { page, path, articleSlug: m ? m[1]! : null, ...metrics(r) };
    }),
    queries: queryRows.map((r) => ({ query: r.keys?.[0] ?? "", ...metrics(r) })),
    articleQueries,
    fetchedAt: new Date().toISOString(),
  };
}

const cachedReport = unstable_cache(fetchReport, ["gsc-report-v1"], { revalidate: 6 * 60 * 60 });

export async function loadSearchConsole(startDay: string, endDay: string): Promise<SeoResult> {
  const cfg = searchConsoleConfig();
  if (!cfg) return { status: "not_configured" };
  try {
    return { status: "ok", siteUrl: cfg.siteUrl, report: await cachedReport(cfg.siteUrl, startDay, endDay) };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
