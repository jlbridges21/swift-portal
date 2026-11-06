/**
 * In-process limits for public portal activation endpoints. Best-effort on
 * multi-instance deploys (same approach as client-portal-recovery-rate-limit).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000;

const LIMITS = {
  activate: 10,
  resend: 3,
} as const;

export function allowPortalActivationAttempt(action: keyof typeof LIMITS, key: string): boolean {
  const now = Date.now();
  const id = `${action}:${key}`;
  const cur = buckets.get(id);
  if (!cur || now >= cur.resetAt) {
    buckets.set(id, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= LIMITS[action]) return false;
  cur.count += 1;
  return true;
}

export function requestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Test helper */
export function resetPortalActivationRateLimitsForTests() {
  buckets.clear();
}
