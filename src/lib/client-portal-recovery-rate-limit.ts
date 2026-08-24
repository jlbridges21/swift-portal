/**
 * In-process rate limits for client portal recovery (reset / temp password).
 * Best-effort on multi-instance deploys.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function take(key: string): boolean {
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

export function allowClientPortalRecovery(args: {
  businessId: string;
  clientId: string;
  action: "send_reset" | "set_temp_password";
  actorId: string;
}): boolean {
  const key = `${args.businessId}:${args.clientId}:${args.action}:${args.actorId}`;
  return take(key);
}

/** Test helper */
export function resetClientPortalRecoveryRateLimitsForTests() {
  buckets.clear();
}
