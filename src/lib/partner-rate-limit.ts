/**
 * In-process rate limits for public partner applications.
 * Best-effort on multi-instance deploys.
 */

type Bucket = { count: number; resetAt: number };

const attemptBuckets = new Map<string, Bucket>();

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_MAX = 8;

function take(map: Map<string, Bucket>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || now >= cur.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}

export function allowPartnerApplicationAttempt(ip: string): boolean {
  return take(attemptBuckets, ip || "unknown", ATTEMPT_MAX, ATTEMPT_WINDOW_MS);
}

/** Test helper — clear buckets between verification runs. */
export function resetPartnerApplicationRateLimitsForTests() {
  attemptBuckets.clear();
}
