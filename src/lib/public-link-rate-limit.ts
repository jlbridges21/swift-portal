/**
 * Rate limits for anonymous public-link routes (page views + signed URL minting).
 * Best-effort in-process — same pattern as signup-rate-limit.ts.
 */

type Bucket = { count: number; resetAt: number };

const pageBuckets = new Map<string, Bucket>();
const apiBuckets = new Map<string, Bucket>();

const PAGE_WINDOW_MS = 60 * 1000;
const PAGE_MAX = 60;
const API_WINDOW_MS = 60 * 1000;
const API_MAX = 120;

function take(
  map: Map<string, Bucket>,
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || now >= cur.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (cur.count >= max) {
    return { allowed: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  }
  cur.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function allowPublicLinkPageView(ip: string, token: string): { allowed: boolean; retryAfterSec: number } {
  const key = `${ip || "unknown"}:${token.slice(0, 12)}`;
  return take(pageBuckets, key, PAGE_MAX, PAGE_WINDOW_MS);
}

export function allowPublicLinkApi(ip: string, token: string): { allowed: boolean; retryAfterSec: number } {
  const key = `${ip || "unknown"}:${token.slice(0, 12)}:api`;
  return take(apiBuckets, key, API_MAX, API_WINDOW_MS);
}

/** Test helper */
export function resetPublicLinkRateLimitsForTests() {
  pageBuckets.clear();
  apiBuckets.clear();
}

export const PUBLIC_LINK_RATE_LIMITS = {
  pagePerMinute: PAGE_MAX,
  apiPerMinute: API_MAX,
} as const;
