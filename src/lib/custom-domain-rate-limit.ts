/**
 * In-process rate limit for custom-domain verification checks (external Vercel API).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_CHECKS = 12;

export function allowCustomDomainVerify(businessId: string): boolean {
  const key = businessId || "unknown";
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= MAX_CHECKS) return false;
  cur.count += 1;
  return true;
}

export function resetCustomDomainRateLimitsForTests() {
  buckets.clear();
}
