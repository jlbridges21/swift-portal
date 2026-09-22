import type { EmailOtpType } from "@supabase/supabase-js";
import { getPlatformRootDomain } from "@/lib/site-metadata";

/**
 * Auth email confirm interstitial URL (token_hash + type).
 *
 * Verified against current Supabase docs (auth-email-templates + passwords):
 * - Template vars: TokenHash, SiteURL, RedirectTo, Token, ConfirmationURL, Data, Email
 * - There is NO documented `EmailActionType` variable — each template hardcodes its type
 *   (`email` for signup confirmation, `invite`, `recovery`) per docs examples.
 * - verifyOtp({ token_hash, type }) where type is EmailOtpType.
 * - Docs warn ConfirmationURL GETs are consumed by email scanners; Option 2 / custom
 *   TokenHash links + server verifyOtp (POST) is the recommended guard.
 *
 * RedirectTo / email links ALWAYS use the canonical platform host
 * (`https://www.{PLATFORM_ROOT_DOMAIN}/auth/confirm`), which is permanently
 * allowlisted. After verifyOtp we mint an auth_session_handoffs token and send
 * the user to their tenant origin (custom domain or `{slug}.…`). Custom domains
 * never need a per-tenant Supabase redirect allow-list entry.
 *
 * generateLink (auth-js GenerateLinkProperties):
 * - `properties.hashed_token` — use with verifyOtp / our /auth/confirm interstitial
 * - `properties.action_link` — GET /auth/v1/verify?token=… — NEVER put in emails (prefetch-consumable)
 */

/** Permanent allowlisted confirm base (no query string — templates append ?token_hash=). */
export function getCanonicalAuthConfirmUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (fromEnv) return `${fromEnv}/auth/confirm`;
  }
  return `https://www.${getPlatformRootDomain()}/auth/confirm`;
}

/**
 * @param _portalOrigin Ignored — kept for call-site compatibility. Confirm always
 *   lands on the canonical host; pass portalOrigin to buildAuthConfirmLink instead.
 */
export function authConfirmUrl(_portalOrigin?: string): string {
  return getCanonicalAuthConfirmUrl();
}

/**
 * Prefetch-safe invite/recovery CTA for custom (branded) emails.
 * Uses hashed_token from generateLink — never action_link.
 * Links open on the canonical host; `return_to` carries the tenant origin for handoff.
 */
export function buildAuthConfirmLink(options: {
  /** Destination portal after session is established (tenant origin). */
  portalOrigin: string;
  tokenHash: string;
  type: EmailOtpType | "invite" | "recovery" | "email" | "magiclink" | "signup";
  nextPath?: string | null;
}): string {
  const base = getCanonicalAuthConfirmUrl();
  const params = new URLSearchParams({
    token_hash: options.tokenHash,
    type: options.type,
  });
  const next = safeAuthNext(options.nextPath ?? null);
  if (next) params.set("next", next);

  const returnTo = safeAuthReturnToParam(options.portalOrigin);
  if (returnTo) {
    const canonicalHost = hostOf(base);
    const returnHost = hostOf(returnTo);
    if (canonicalHost && returnHost && canonicalHost !== returnHost) {
      params.set("return_to", returnTo);
    }
  }

  return `${base}?${params.toString()}`;
}

function hostOf(originOrUrl: string): string | null {
  try {
    return new URL(originOrUrl.includes("://") ? originOrUrl : `https://${originOrUrl}`)
      .hostname.toLowerCase()
      .split(":")[0];
  } catch {
    return null;
  }
}

/**
 * Client-safe parse of return_to for hidden form fields (full validation is server-side).
 * Origin only (https://host), no path.
 */
export function safeAuthReturnToParam(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//") || /[\s\\]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if ((url.pathname && url.pathname !== "/") || url.search || url.hash) return null;
    const host = url.hostname.toLowerCase().split(":")[0]?.trim() ?? "";
    if (!host) return null;
    return `${url.protocol}//${host}`;
  } catch {
    return null;
  }
}

/** Relative in-app path only; rejects protocol-relative and absolute URLs. */
export function safeAuthNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  return trimmed;
}

export const EMAIL_OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "recovery",
  "email_change",
  "email",
  "magiclink",
]);

export function isEmailOtpType(value: string | null | undefined): value is EmailOtpType {
  return typeof value === "string" && EMAIL_OTP_TYPES.has(value);
}

export function needsPasswordForOtpType(type: string | null | undefined): boolean {
  return type === "invite" || type === "recovery";
}

export function passwordSetupReason(
  type: string | null | undefined
): "invite" | "recovery" | "setup" {
  if (type === "invite") return "invite";
  if (type === "recovery") return "recovery";
  return "setup";
}
