/**
 * Subdomain labels that always belong to the ShootPortal platform.
 * Keep in sync with supabase/migration-v41-reserved-subdomains.sql.
 */
export const RESERVED_PLATFORM_SUBDOMAINS = [
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "smtp",
  "ftp",
  "cdn",
  "static",
  "assets",
  "status",
  "help",
  "support",
  "docs",
  "blog",
  "platform",
  "dashboard",
] as const;

/**
 * Top-level path segments that must never be partner landing slugs or referral codes.
 *
 * Re-derived from src/app filesystem (phase 6) plus Next/meta reserves and known
 * path prefixes. A partner claiming /pricing would take down a real page.
 *
 * Verify with: npx tsx scripts/verify-reserved-app-routes.ts
 */
export const RESERVED_APP_ROUTE_SLUGS = [
  // Top-level app route segments (src/app/*/page.tsx or route groups)
  "admin",
  "api",
  "auth",
  "billing",
  "contact",
  "dashboard",
  "how-it-works",
  "login",
  "onboarding",
  "partner",
  "partners",
  "platform",
  "pricing",
  "privacy",
  "request",
  "signup",
  "terms",
  // Next.js / metadata / asset path segments that must not be shadowed
  "robots",
  "sitemap",
  "manifest",
  "apple-icon",
  "icon",
  "opengraph-image",
  "twitter-image",
  "favicon",
  "favicon.ico",
  "_next",
  // Other reserved path prefixes used by the app
  "b",
] as const;

export type ReservedPlatformSubdomain = (typeof RESERVED_PLATFORM_SUBDOMAINS)[number];

/** Same pattern as business slugs — lowercase alphanumeric with hyphens. */
export const BUSINESS_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Alias for referral codes / landing slugs (identical grammar). */
export const REFERRAL_CODE_RE = BUSINESS_SLUG_RE;
export const LANDING_SLUG_RE = BUSINESS_SLUG_RE;

export const RESERVED_BUSINESS_SLUG_ERROR =
  "This slug is reserved for the ShootPortal platform and cannot be used as a business subdomain.";

export const RESERVED_REFERRAL_CODE_ERROR =
  "This referral code is reserved and cannot be used.";

export const RESERVED_LANDING_SLUG_ERROR =
  "This slug is reserved for a ShootPortal route and cannot be used as a partner landing page.";

const RESERVED_SUBDOMAIN_SET = new Set<string>(RESERVED_PLATFORM_SUBDOMAINS);
const RESERVED_APP_ROUTE_SET = new Set<string>(RESERVED_APP_ROUTE_SLUGS);

/** Union of platform subdomain labels and top-level app routes. */
export function isReservedReferralCode(label: string): boolean {
  const normalized = normalizeBusinessSlug(label);
  return RESERVED_SUBDOMAIN_SET.has(normalized) || RESERVED_APP_ROUTE_SET.has(normalized);
}

export function isReservedAppRouteSlug(label: string): boolean {
  return RESERVED_APP_ROUTE_SET.has(normalizeBusinessSlug(label));
}

export function normalizeBusinessSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isReservedPlatformSubdomain(label: string): boolean {
  return RESERVED_SUBDOMAIN_SET.has(normalizeBusinessSlug(label));
}

export type BusinessSlugResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export type ReferralCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export type LandingSlugResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

/** Validate a business slug for create/edit. Rejects reserved platform labels. */
export function validateBusinessSlug(raw: unknown): BusinessSlugResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "A business slug is required." };
  }
  const slug = normalizeBusinessSlug(raw);
  if (!BUSINESS_SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: "Slug must be lowercase letters, numbers, and hyphens (e.g. acme-media).",
    };
  }
  if (isReservedPlatformSubdomain(slug)) {
    return { ok: false, error: RESERVED_BUSINESS_SLUG_ERROR };
  }
  return { ok: true, slug };
}

/**
 * Validate a partner referral code.
 * Same grammar as business slugs, plus reserved app routes (pricing, partners, …).
 */
export function validateReferralCode(raw: unknown): ReferralCodeResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "A referral code is required." };
  }
  const code = normalizeBusinessSlug(raw);
  if (!REFERRAL_CODE_RE.test(code)) {
    return {
      ok: false,
      error: "Referral code must be lowercase letters, numbers, and hyphens (e.g. acme-media).",
    };
  }
  if (isReservedReferralCode(code)) {
    return { ok: false, error: RESERVED_REFERRAL_CODE_ERROR };
  }
  return { ok: true, code };
}

/**
 * Validate a partner landing page slug (apex /{slug}).
 * Rejects reserved app routes and platform subdomain labels.
 */
export function validateLandingSlug(raw: unknown): LandingSlugResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "A landing page slug is required." };
  }
  const slug = normalizeBusinessSlug(raw);
  if (!LANDING_SLUG_RE.test(slug) || slug.length < 2 || slug.length > 48) {
    return {
      ok: false,
      error: "Slug must be 2–48 characters: lowercase letters, numbers, and hyphens.",
    };
  }
  if (isReservedReferralCode(slug)) {
    return { ok: false, error: RESERVED_LANDING_SLUG_ERROR };
  }
  return { ok: true, slug };
}

export function parseBusinessSlugOrThrow(raw: unknown): string {
  const result = validateBusinessSlug(raw);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.slug;
}

/** Suggest a referral code from a brand name (not yet uniqueness-checked). */
export function suggestReferralCodeFromBrand(brandName: string): string {
  let base = normalizeBusinessSlug(brandName)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!base) base = "media";
  if (!REFERRAL_CODE_RE.test(base) || isReservedReferralCode(base)) {
    base = `${base}-media`.replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  }
  if (!REFERRAL_CODE_RE.test(base) || isReservedReferralCode(base)) {
    base = `ref-${Date.now().toString(36)}`;
  }
  return base;
}
