/**
 * Per-instance token bucket for the public analytics collector. Best-effort on
 * multi-instance deploys; the unique client_event_id and payload caps bound the
 * rest.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 90;
const MAX_KEYS = 5000;

export function allowAnalyticsEvent(key: string, now = Date.now()): boolean {
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    if (buckets.size > MAX_KEYS) buckets.clear();
  }
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= MAX_PER_WINDOW) return false;
  cur.count += 1;
  return true;
}

export function resetAnalyticsRateLimitForTests() {
  buckets.clear();
}
