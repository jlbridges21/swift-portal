import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { embedSrcFromCode, getTourEmbedUrl, headersAllowFraming, normalizeTourUrl } from "@/lib/tour-url";

/**
 * One place that decides how a 360 tour is shown — client portal, published property
 * websites (and their editor preview), and portfolio sites all call this.
 *
 *   1. Embed code saved on the tour → its iframe src (the provider's own embed URL).
 *   2. A known provider share link → that provider's embed URL (Kuula viewer params, …).
 *   3. Any other https link → embedded when the tour page's own headers allow framing
 *      (no X-Frame-Options / frame-ancestors restriction), checked server-side and cached.
 *   Otherwise null → callers show the "Open 360 Tour" link (the fallback, not the default).
 *
 * Read-only: saved tours, URLs and embed codes are never changed.
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAIL_TTL_MS = 10 * 60 * 1000;
const PROBE_TIMEOUT_MS = 3500;
const cache = new Map<string, { allowed: boolean; expires: number }>();

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

/** Public https hosts only — business-entered URLs must never reach internal addresses. */
async function isPublicHttpsUrl(raw: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  if (isIP(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  try {
    const records = await lookup(host, { all: true });
    return records.length > 0 && records.every((r) => !isPrivateAddress(r.address));
  } catch {
    return false;
  }
}

/** Does this page let other sites frame it? Follows up to 3 redirects, each re-checked. */
async function probeFramingAllowed(start: string): Promise<boolean> {
  const hit = cache.get(start);
  if (hit && hit.expires > Date.now()) return hit.allowed;
  let allowed = false;
  let ok = false;
  try {
    let current = start;
    for (let hop = 0; hop < 4; hop++) {
      if (!(await isPublicHttpsUrl(current))) break;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": "ShootPortal-TourEmbedCheck/1.0", Accept: "text/html" },
          cache: "no-store",
        });
      } finally {
        clearTimeout(timer);
      }
      void res.body?.cancel().catch(() => {});
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        if (!headersAllowFraming(res.headers)) break;
        current = new URL(location, current).toString();
        continue;
      }
      ok = true;
      allowed = res.ok && headersAllowFraming(res.headers);
      break;
    }
  } catch {
    // Network error / timeout: treated as "not known to be embeddable" (link fallback), retried soon.
  }
  cache.set(start, { allowed, expires: Date.now() + (ok ? CACHE_TTL_MS : FAIL_TTL_MS) });
  return allowed;
}

export async function resolveTourEmbedUrl(tour: { url: string | null | undefined; embedCode?: string | null }): Promise<string | null> {
  const fromCode = embedSrcFromCode(tour.embedCode);
  if (fromCode) return fromCode;
  const known = getTourEmbedUrl(tour.url);
  if (known) return known;
  const url = normalizeTourUrl(tour.url);
  if (!url) return null;
  return (await probeFramingAllowed(url)) ? url : null;
}

/** tour id → embed URL (null = show the link fallback), resolved in parallel. */
export async function resolveTourEmbedMap(
  tours: { id: string; kuula_url?: string | null; url?: string | null; embed_code?: string | null }[]
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    tours.map(async (t) => [t.id, await resolveTourEmbedUrl({ url: t.kuula_url ?? t.url, embedCode: t.embed_code })] as const)
  );
  return Object.fromEntries(entries);
}
