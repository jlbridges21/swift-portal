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

const photoRequestBuckets = new Map<string, Bucket>();
const photoAssetBuckets = new Map<string, Bucket>();
const photoMissBuckets = new Map<string, Bucket>();

const PHOTO_REQUEST_WINDOW_MS = 60 * 1000;
const PHOTO_REQUEST_MAX = 120;
/** A shared folder's gallery loads one thumbnail per photo, so image bytes get a larger budget. */
const PHOTO_ASSET_MAX = 600;
const PHOTO_MISS_WINDOW_MS = 10 * 60 * 1000;
const PHOTO_MISS_MAX = 20;
const MAX_TRACKED_KEYS = 10_000;

function sweep(map: Map<string, Bucket>) {
  if (map.size < MAX_TRACKED_KEYS) return;
  const now = Date.now();
  for (const [key, bucket] of map) {
    if (now >= bucket.resetAt) map.delete(key);
  }
}

/**
 * Photo share requests are limited per IP across all tokens, so rotating the
 * token on each guess doesn't reset the budget.
 */
export function allowPhotoShareRequest(ip: string): { allowed: boolean; retryAfterSec: number } {
  sweep(photoRequestBuckets);
  return take(photoRequestBuckets, ip || "unknown", PHOTO_REQUEST_MAX, PHOTO_REQUEST_WINDOW_MS);
}

/** Per-IP budget for share image/download requests (thumbnails, previews, originals). */
export function allowPhotoShareAssetRequest(ip: string): { allowed: boolean; retryAfterSec: number } {
  sweep(photoAssetBuckets);
  return take(photoAssetBuckets, ip || "unknown", PHOTO_ASSET_MAX, PHOTO_REQUEST_WINDOW_MS);
}

/** True once an IP has failed too many photo-share token lookups recently. */
export function isPhotoShareLookupBlocked(ip: string): { blocked: boolean; retryAfterSec: number } {
  const cur = photoMissBuckets.get(ip || "unknown");
  const now = Date.now();
  if (!cur || now >= cur.resetAt || cur.count < PHOTO_MISS_MAX) {
    return { blocked: false, retryAfterSec: 0 };
  }
  return { blocked: true, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
}

export function recordPhotoShareMiss(ip: string): void {
  sweep(photoMissBuckets);
  take(photoMissBuckets, ip || "unknown", Number.MAX_SAFE_INTEGER, PHOTO_MISS_WINDOW_MS);
}

/** Test helper */
export function resetPublicLinkRateLimitsForTests() {
  pageBuckets.clear();
  apiBuckets.clear();
  photoRequestBuckets.clear();
  photoAssetBuckets.clear();
  photoMissBuckets.clear();
}

export const PUBLIC_LINK_RATE_LIMITS = {
  pagePerMinute: PAGE_MAX,
  apiPerMinute: API_MAX,
  photoRequestsPerMinute: PHOTO_REQUEST_MAX,
  photoAssetRequestsPerMinute: PHOTO_ASSET_MAX,
  photoMissesPer10Min: PHOTO_MISS_MAX,
} as const;
