/**
 * Client-safe partner landing content resolution (no supabase / sharp / headers).
 * Used by the public view and the live editor preview.
 */

import { sanitizePlainText } from "@/lib/landing-content";
import {
  deriveBrandTheme,
  isSafeBrandAssetUrl,
  sanitizeCssColor,
} from "@/lib/brand-color";
import {
  DEFAULT_PARTNER_LANDING_BENEFITS,
  PARTNER_LANDING_LIMITS,
  SHOOTPORTAL_LANDING_ACCENT,
  SHOOTPORTAL_LANDING_PRIMARY,
  buildPartnerLandingDefaultsFromConstants,
  resolvePartnerLandingPhotoLayout,
  type PartnerLandingDefaults,
} from "@/lib/partner-landing.constants";

export type ResolvedPartnerLandingContent = {
  brandName: string;
  slug: string;
  headline: string;
  subheadline: string;
  description: string;
  benefits: string[];
  ctaLabel: string;
  offerText: string | null;
  showOffer: boolean;
  logoUrl: string | null;
  photoUrl: string;
  photoWidth: number | null;
  photoHeight: number | null;
  testimonialQuote: string | null;
  testimonialAttribution: string | null;
  accentColor: string;
  accentForeground: string;
  accentHover: string;
  primaryColor: string;
};

function sanitizeMultilinePlain(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  const stripped = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen);
}

function rowBenefits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function resolveStoredBenefits(stored: string[]): string[] {
  if (!stored.length) return [...DEFAULT_PARTNER_LANDING_BENEFITS];
  return stored.map((b) => sanitizePlainText(b, PARTNER_LANDING_LIMITS.benefitItem)).filter(Boolean);
}

/**
 * Sync resolver used by the public page and the live editor preview.
 * Pass an already-resolved offerText (null when the offer should be hidden).
 */
export function resolvePartnerLandingContentSync(args: {
  brandName: string;
  slug: string;
  headline?: string | null;
  subheadline?: string | null;
  description?: string | null;
  benefits?: string[] | null;
  ctaLabel?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
  photoWidth?: number | null;
  photoHeight?: number | null;
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
  testimonialQuote?: string | null;
  testimonialAttribution?: string | null;
  showOffer: boolean;
  offerText: string | null;
  defaults?: PartnerLandingDefaults;
}): ResolvedPartnerLandingContent {
  const brandName = args.brandName.trim() || "Our studio";
  const defaults = args.defaults ?? buildPartnerLandingDefaultsFromConstants(brandName);

  const headline =
    sanitizePlainText(args.headline ?? "", PARTNER_LANDING_LIMITS.headline) || defaults.headline;
  const subheadline =
    sanitizePlainText(args.subheadline ?? "", PARTNER_LANDING_LIMITS.subheadline) ||
    defaults.subheadline;
  const description =
    sanitizeMultilinePlain(args.description ?? "", PARTNER_LANDING_LIMITS.description) ||
    defaults.description;
  const benefits = resolveStoredBenefits(rowBenefits(args.benefits ?? []));
  const ctaLabel =
    sanitizePlainText(args.ctaLabel ?? "", PARTNER_LANDING_LIMITS.ctaLabel) || defaults.ctaLabel;

  const primaryRaw = args.brandPrimaryColor?.trim() || defaults.brandPrimaryColor;
  const accentRaw = args.brandAccentColor?.trim() || defaults.brandAccentColor;
  const theme = deriveBrandTheme(
    sanitizeCssColor(primaryRaw, SHOOTPORTAL_LANDING_PRIMARY),
    sanitizeCssColor(accentRaw, SHOOTPORTAL_LANDING_ACCENT)
  );

  const offerText = args.showOffer && args.offerText ? args.offerText : null;
  const showOffer = Boolean(offerText);

  const logoUrl =
    args.logoUrl && isSafeBrandAssetUrl(args.logoUrl) ? args.logoUrl.trim() : null;
  const photoLayout = resolvePartnerLandingPhotoLayout(
    args.photoUrl,
    args.photoWidth,
    args.photoHeight
  );

  const testimonialQuote = args.testimonialQuote
    ? sanitizeMultilinePlain(args.testimonialQuote, PARTNER_LANDING_LIMITS.testimonialQuote)
    : null;
  const testimonialAttribution = args.testimonialAttribution
    ? sanitizePlainText(args.testimonialAttribution, PARTNER_LANDING_LIMITS.testimonialAttribution)
    : null;

  return {
    brandName,
    slug: args.slug,
    headline,
    subheadline,
    description,
    benefits,
    ctaLabel,
    offerText,
    showOffer,
    logoUrl,
    photoUrl: photoLayout.src,
    photoWidth: photoLayout.width,
    photoHeight: photoLayout.height,
    testimonialQuote: testimonialQuote || null,
    testimonialAttribution: testimonialAttribution || null,
    accentColor: theme.accent,
    accentForeground: theme.accentForeground,
    accentHover: theme.accentHover,
    primaryColor: theme.primary,
  };
}
