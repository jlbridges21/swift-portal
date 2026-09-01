/**
 * Partner referral attribution — cookie + write helpers (phase 2).
 * Attribution is written once at business creation; never retroactively.
 *
 * Edge-safe: do not import next/headers here (middleware uses this module).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { validateLandingSlug, validateReferralCode } from "@/lib/reserved-subdomains";

export const PARTNER_REF_COOKIE = "sp_partner_ref";
export const PARTNER_REF_TTL_SECONDS = 90 * 24 * 60 * 60;

export type PartnerReferralSource = "link" | "landing_page" | "manual" | "promo_code";

export type PartnerRefClaims = {
  code: string;
  /** Unix seconds when the cookie was set (last-touch). */
  ts: number;
  exp: number;
  /** How the visitor got the cookie. Missing on legacy cookies → treated as link. */
  source?: PartnerReferralSource;
};

export type ActivePartnerRef = {
  id: string;
  email: string;
  user_id: string | null;
  referral_code: string;
  status: string;
};

function trySigningSecret(): string | null {
  const secret =
    process.env.PLATFORM_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  return secret || null;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function signPartnerRefCookie(claims: PartnerRefClaims): string | null {
  const secret = trySigningSecret();
  if (!secret) return null;
  const validated = validateReferralCode(claims.code);
  if (!validated.ok) return null;
  const source: PartnerReferralSource =
    claims.source === "landing_page" ? "landing_page" : "link";
  const body = b64url(
    JSON.stringify({
      code: validated.code,
      ts: claims.ts,
      exp: claims.exp,
      source,
    })
  );
  const payload = `v1.${body}`;
  return `${payload}.${hmacHex(secret, payload)}`;
}

/** Tampered / expired / unsigned values return null — caller ignores silently. */
export function verifyPartnerRefCookie(raw: string | undefined | null): PartnerRefClaims | null {
  const secret = trySigningSecret();
  if (!secret) return null;
  const value = raw?.trim() ?? "";
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const sig = parts[2];
  if (!sig || !safeEqualHex(hmacHex(secret, payload), sig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      code?: unknown;
      ts?: unknown;
      exp?: unknown;
      source?: unknown;
    };
    if (typeof parsed.code !== "string") return null;
    const validated = validateReferralCode(parsed.code);
    if (!validated.ok) return null;
    if (typeof parsed.ts !== "number" || typeof parsed.exp !== "number") return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    const source: PartnerReferralSource =
      parsed.source === "landing_page" ? "landing_page" : "link";
    return { code: validated.code, ts: parsed.ts, exp: parsed.exp, source };
  } catch {
    return null;
  }
}

export function partnerRefCookieOptions(maxAge = PARTNER_REF_TTL_SECONDS) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

/** Middleware / edge-safe lookup. Unknown or suspended → null (no cookie). */
export async function lookupActivePartnerByReferralCode(
  rawCode: string
): Promise<ActivePartnerRef | null> {
  const validated = validateReferralCode(rawCode);
  if (!validated.ok) return null;
  const supabase = serviceClient();
  const { data } = await supabase
    .from("partners")
    .select("id, email, user_id, referral_code, status")
    .eq("referral_code", validated.code)
    .eq("status", "active")
    .maybeSingle();
  return (data as ActivePartnerRef | null) ?? null;
}

/**
 * If `rawCode` resolves to an active partner, returns a signed cookie value.
 * Unknown / suspended / malformed / missing secret → null (silent).
 */
export async function buildPartnerRefCookieValue(
  rawCode: string,
  source: PartnerReferralSource = "link"
): Promise<string | null> {
  const partner = await lookupActivePartnerByReferralCode(rawCode);
  if (!partner) return null;
  const now = Math.floor(Date.now() / 1000);
  const cookieSource: PartnerReferralSource =
    source === "landing_page" ? "landing_page" : "link";
  return signPartnerRefCookie({
    code: partner.referral_code,
    ts: now,
    exp: now + PARTNER_REF_TTL_SECONDS,
    source: cookieSource,
  });
}

export function isSelfReferral(args: {
  partner: ActivePartnerRef;
  signupEmail: string;
  signupUserId?: string | null;
}): boolean {
  const email = args.signupEmail.trim().toLowerCase();
  if (email && email === args.partner.email.trim().toLowerCase()) return true;
  if (args.signupUserId && args.partner.user_id && args.signupUserId === args.partner.user_id) {
    return true;
  }
  return false;
}

/**
 * Atomically write partner_referrals + businesses.referred_by_partner_id.
 * Returns whether attribution was written. Never throws for expected races.
 */
export async function attributeBusinessToPartner(args: {
  businessId: string;
  partnerId: string;
  referralCodeUsed: string;
  source: PartnerReferralSource;
}): Promise<boolean> {
  if (process.env.PARTNER_ATTRIBUTION_FORCE_FAIL === "1") {
    throw new Error("Forced partner attribution failure (verification).");
  }
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("attribute_partner_referral", {
    p_business_id: args.businessId,
    p_partner_id: args.partnerId,
    p_referral_code_used: args.referralCodeUsed,
    p_source: args.source,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data === true;
}

/**
 * Resolve a verified cookie value → active partner for attribution.
 * Suspended / unknown / tampered → null.
 */
export async function resolveActivePartnerFromRefClaims(
  claims: PartnerRefClaims | null
): Promise<ActivePartnerRef | null> {
  if (!claims) return null;
  return lookupActivePartnerByReferralCode(claims.code);
}

/**
 * Middleware/edge: active partner landing at /{slug} → referral code.
 * Unknown / inactive / reserved → null (no cookie).
 */
export async function lookupActiveLandingReferralCode(
  rawSlug: string
): Promise<string | null> {
  const validated = validateLandingSlug(rawSlug);
  if (!validated.ok) return null;
  const supabase = serviceClient();

  const { data: landing } = await supabase
    .from("partner_landing_pages")
    .select("partner_id")
    .eq("slug", validated.slug)
    .eq("is_active", true)
    .maybeSingle();

  let partnerId = landing?.partner_id as string | undefined;
  if (!partnerId) {
    const { data: alias } = await supabase
      .from("partner_landing_slug_aliases")
      .select("landing_id")
      .eq("slug", validated.slug)
      .maybeSingle();
    if (!alias?.landing_id) return null;
    const { data: aliasLanding } = await supabase
      .from("partner_landing_pages")
      .select("partner_id")
      .eq("id", alias.landing_id as string)
      .eq("is_active", true)
      .maybeSingle();
    partnerId = aliasLanding?.partner_id as string | undefined;
  }
  if (!partnerId) return null;

  const { data: partner } = await supabase
    .from("partners")
    .select("referral_code, status")
    .eq("id", partnerId)
    .eq("status", "active")
    .maybeSingle();
  return (partner?.referral_code as string | undefined) ?? null;
}
