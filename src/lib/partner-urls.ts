import { getPlatformApexOrigin } from "@/lib/portal-url";

/** Absolute apex referral link — safe on tenant custom domains. */
export function partnerReferralLink(referralCode: string): string {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  return `${apex}/?ref=${encodeURIComponent(referralCode)}`;
}

/** Absolute apex landing page URL — safe on tenant custom domains. */
export function partnerLandingPublicUrl(slug: string): string {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  return `${apex}/${encodeURIComponent(slug)}`;
}

/** Partner dashboard entry on the platform host. */
export function partnerDashboardUrl(): string {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  return `${apex}/partner/dashboard`;
}
