/**
 * In-process rate limit for admin global search.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60;

export function allowAdminSearch(businessId: string, userId: string): boolean {
  const key = `${businessId}:${userId}`;
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= MAX_PER_WINDOW) return false;
  cur.count += 1;
  return true;
}

export function resetAdminSearchRateLimitsForTests() {
  buckets.clear();
}
