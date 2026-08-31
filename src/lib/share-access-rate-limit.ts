/**
 * Rate limits for project share token exchange (session minting).
 * Best-effort in-process — same pattern as signup-rate-limit.
 */

type Bucket = { count: number; resetAt: number };

const exchangeBuckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_TOKEN = 10;

function take(map: Map<string, Bucket>, key: string, max: number): boolean {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || now >= cur.resetAt) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}

export function allowShareAccessExchange(ip: string, tokenFingerprint: string): boolean {
  const ipOk = take(exchangeBuckets, `ip:${ip || "unknown"}`, MAX_PER_IP);
  const tokenOk = take(exchangeBuckets, `tok:${tokenFingerprint}`, MAX_PER_TOKEN);
  return ipOk && tokenOk;
}

export function resetShareAccessRateLimitsForTests(): void {
  exchangeBuckets.clear();
}

export const SHARE_EXCHANGE_RATE_LIMIT = {
  windowMinutes: WINDOW_MS / 60_000,
  maxPerIp: MAX_PER_IP,
  maxPerToken: MAX_PER_TOKEN,
};
