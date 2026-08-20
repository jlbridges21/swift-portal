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
 */
export function authConfirmUrl(portalOrigin: string): string {
  return `${portalOrigin.replace(/\/$/, "")}/auth/confirm`;
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
