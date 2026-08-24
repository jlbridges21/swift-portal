/** Limits and render-time defaults for partner co-branded landing pages. */

export const PARTNER_LANDING_LIMITS = {
  headline: 120,
  subheadline: 280,
  description: 2000,
  ctaLabel: 80,
  benefitItem: 120,
  benefitsMin: 3,
  benefitsMax: 5,
  testimonialQuote: 500,
  testimonialAttribution: 120,
} as const;

export const DEFAULT_PARTNER_CTA_LABEL = "Start your free trial";

export const DEFAULT_PARTNER_SUBHEADLINE =
  "ShootPortal is the client portal built for photographers and drone professionals — run requests, estimates, scheduling, delivery, and payments in one branded workspace.";

export const DEFAULT_PARTNER_LANDING_BENEFITS = [
  "Request → estimate → schedule → deliver on one project timeline",
  "Branded client portal your customers actually use",
  "Secure Stripe payments and organized media delivery",
  "Less email back-and-forth — everything stays on the job",
] as const;

export const SHOOTPORTAL_LANDING_PRIMARY = "#0F172A";
export const SHOOTPORTAL_LANDING_ACCENT = "#4F46E5";

export function defaultPartnerLandingHeadline(brandName: string): string {
  const name = brandName.trim() || "Our studio";
  return `${name} recommends ShootPortal`;
}

export type PartnerLandingDefaults = {
  headline: string;
  subheadline: string;
  description: string;
  benefits: string[];
  ctaLabel: string;
  offerText: string | null;
  brandPrimaryColor: string;
  brandAccentColor: string;
};
