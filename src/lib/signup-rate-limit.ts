/**
 * In-process rate limits for public signup.
 * Best-effort on multi-instance deploys — still blocks noisy single-IP abuse.
 */

type Bucket = { count: number; resetAt: number };

const attemptBuckets = new Map<string, Bucket>();
const successBuckets = new Map<string, Bucket>();

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_MAX = 10;
const SUCCESS_WINDOW_MS = 60 * 60 * 1000;
const SUCCESS_MAX = 3;

function take(
  map: Map<string, Bucket>,
  key: string,
  max: number,
  windowMs: number,
  opts?: { peek?: boolean }
): boolean {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || now >= cur.resetAt) {
    if (opts?.peek) return true;
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= max) return false;
  if (opts?.peek) return true;
  cur.count += 1;
  return true;
}

export function allowSignupAttempt(ip: string): boolean {
  return take(attemptBuckets, ip || "unknown", ATTEMPT_MAX, ATTEMPT_WINDOW_MS);
}

export function allowSignupSuccess(ip: string, opts?: { peek?: boolean }): boolean {
  return take(successBuckets, ip || "unknown", SUCCESS_MAX, SUCCESS_WINDOW_MS, opts);
}

/** Test helper — clear buckets between verification runs. */
export function resetSignupRateLimitsForTests() {
  attemptBuckets.clear();
  successBuckets.clear();
}
