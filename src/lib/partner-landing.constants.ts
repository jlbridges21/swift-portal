/** Limits and render-time defaults for partner co-branded landing pages. */

import { isSafeBrandAssetUrl } from "@/lib/brand-color";

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
  "ShootPortal gives photographers and drone professionals one place to manage clients, schedule shoots, deliver media, send invoices, and get paid.";

export const DEFAULT_PARTNER_LANDING_BENEFITS = [
  "Request → estimate → schedule → deliver on one project timeline",
  "Branded client portal your customers actually use",
  "Secure Stripe payments and organized media delivery",
  "Less email back-and-forth — everything stays on the job",
] as const;

export const SHOOTPORTAL_LANDING_PRIMARY = "#0F172A";
export const SHOOTPORTAL_LANDING_ACCENT = "#4F46E5";

/**
 * Render-time-only personal photo when a partner has not uploaded one.
 * Never write this path into `partner_landing_pages.photo_url` — NULL means unset.
 * Purpose-built centered ShootPortal mark on brand navy — nothing cropped at edges.
 */
export const PARTNER_DEFAULT_PHOTO_PATH = "/icons/partner-default-photo.jpg";
/** Intrinsic size of PARTNER_DEFAULT_PHOTO_PATH. */
export const PARTNER_DEFAULT_PHOTO_WIDTH = 1400;
export const PARTNER_DEFAULT_PHOTO_HEIGHT = 1050;

/**
 * Resolve the personal photo shown on partner landings.
 * Unset / unsafe URLs fall back to the shared default asset at render time only —
 * callers must not write PARTNER_DEFAULT_PHOTO_PATH into the database.
 */
export function resolvePartnerLandingPhotoUrl(photoUrl: string | null | undefined): string {
  const trimmed = photoUrl?.trim() ?? "";
  if (trimmed && isSafeBrandAssetUrl(trimmed)) return trimmed;
  return PARTNER_DEFAULT_PHOTO_PATH;
}

export type PartnerLandingPhotoLayout = {
  src: string;
  /** Null when legacy upload has no stored dims — use object-contain letterbox. */
  width: number | null;
  height: number | null;
  /** True when showing the shared default (not a partner upload). */
  isDefault: boolean;
};

/**
 * Resolve photo URL + layout dims for settings preview and the public page.
 * Custom uploads without stored dims → null width/height (contain fallback).
 * Default asset always uses known intrinsic size.
 */
export function resolvePartnerLandingPhotoLayout(
  photoUrl: string | null | undefined,
  photoWidth?: number | null,
  photoHeight?: number | null
): PartnerLandingPhotoLayout {
  const trimmed = photoUrl?.trim() ?? "";
  const hasCustom = Boolean(trimmed && isSafeBrandAssetUrl(trimmed));
  if (!hasCustom) {
    return {
      src: PARTNER_DEFAULT_PHOTO_PATH,
      width: PARTNER_DEFAULT_PHOTO_WIDTH,
      height: PARTNER_DEFAULT_PHOTO_HEIGHT,
      isDefault: true,
    };
  }
  const w =
    typeof photoWidth === "number" && photoWidth > 0 ? Math.round(photoWidth) : null;
  const h =
    typeof photoHeight === "number" && photoHeight > 0 ? Math.round(photoHeight) : null;
  const hasDims = w != null && h != null;
  return {
    src: trimmed,
    width: hasDims ? w : null,
    height: hasDims ? h : null,
    isDefault: false,
  };
}

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

/** Pure defaults — safe for client bundles (no DB). */
export function buildPartnerLandingDefaultsFromConstants(brandName: string): PartnerLandingDefaults {
  return {
    headline: defaultPartnerLandingHeadline(brandName),
    subheadline: DEFAULT_PARTNER_SUBHEADLINE,
    description: "",
    benefits: [...DEFAULT_PARTNER_LANDING_BENEFITS],
    ctaLabel: DEFAULT_PARTNER_CTA_LABEL,
    offerText: null,
    brandPrimaryColor: SHOOTPORTAL_LANDING_PRIMARY,
    brandAccentColor: SHOOTPORTAL_LANDING_ACCENT,
  };
}
