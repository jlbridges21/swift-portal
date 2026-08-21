import type { EmailOtpType } from "@supabase/supabase-js";

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
 * We pass RedirectTo = `{tenantOrigin}/auth/confirm` so templates can build:
 *   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=…
 * and users land on their own portal, not only Site URL.
 *
 * generateLink (auth-js GenerateLinkProperties, verified 2026-08 against
 * @supabase/auth-js types + https://supabase.github.io/auth-js/v2/types/GenerateLinkProperties.html):
 * - `properties.hashed_token` — use with verifyOtp / our /auth/confirm interstitial
 * - `properties.action_link` — GET /auth/v1/verify?token=… — NEVER put in emails (prefetch-consumable)
 */
export function authConfirmUrl(portalOrigin: string): string {
  return `${portalOrigin.replace(/\/$/, "")}/auth/confirm`;
}

/**
 * Prefetch-safe invite/recovery CTA for custom (branded) emails.
 * Uses hashed_token from generateLink — never action_link.
 */
export function buildAuthConfirmLink(options: {
  portalOrigin: string;
  tokenHash: string;
  type: EmailOtpType | "invite" | "recovery" | "email" | "magiclink" | "signup";
  nextPath?: string | null;
}): string {
  const base = authConfirmUrl(options.portalOrigin);
  const params = new URLSearchParams({
    token_hash: options.tokenHash,
    type: options.type,
  });
  const next = safeAuthNext(options.nextPath ?? null);
  if (next) params.set("next", next);
  return `${base}?${params.toString()}`;
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
