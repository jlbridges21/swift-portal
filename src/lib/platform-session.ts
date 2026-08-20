import { createHmac, timingSafeEqual } from "node:crypto";

export const SA_BUSINESS_CONTEXT_COOKIE = "sa_business_context";
export const IMPERSONATION_TTL_SECONDS = 30 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ImpersonationClaims = {
  businessId: string;
  allowWrites: boolean;
  exp: number;
};

function signingSecret(): string {
  const secret =
    process.env.PLATFORM_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new Error("PLATFORM_SESSION_SECRET (or CRON_SECRET) is required to sign impersonation cookies.");
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function hmacHex(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signImpersonationCookie(claims: ImpersonationClaims): string {
  if (!UUID_RE.test(claims.businessId)) {
    throw new Error("Invalid business id");
  }
  const body = b64url(
    JSON.stringify({
      bid: claims.businessId,
      w: claims.allowWrites ? 1 : 0,
      exp: claims.exp,
    })
  );
  const payload = `v1.${body}`;
  return `${payload}.${hmacHex(payload)}`;
}

export function verifyImpersonationCookie(raw: string | undefined | null): ImpersonationClaims | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  // Unsigned UUID (legacy / forged) is never accepted.
  if (UUID_RE.test(value)) return null;

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const sig = parts[2];
  if (!sig || !safeEqualHex(hmacHex(payload), sig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      bid?: unknown;
      w?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.bid !== "string" || !UUID_RE.test(parsed.bid)) return null;
    if (typeof parsed.exp !== "number" || parsed.exp * 1000 < Date.now()) return null;
    return {
      businessId: parsed.bid,
      allowWrites: parsed.w === 1,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function impersonationCookieOptions(maxAge = IMPERSONATION_TTL_SECONDS) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export const PROTECTED_PRODUCTION_BUSINESS_IDS = new Set([
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-0000000000aa",
]);
