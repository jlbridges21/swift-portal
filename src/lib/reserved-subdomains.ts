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

export type ReservedPlatformSubdomain = (typeof RESERVED_PLATFORM_SUBDOMAINS)[number];

export const BUSINESS_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_BUSINESS_SLUG_ERROR =
  "This slug is reserved for the ShootPortal platform and cannot be used as a business subdomain.";

const RESERVED_SET = new Set<string>(RESERVED_PLATFORM_SUBDOMAINS);

export function normalizeBusinessSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isReservedPlatformSubdomain(label: string): boolean {
  return RESERVED_SET.has(normalizeBusinessSlug(label));
}

export type BusinessSlugResult =
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

export function parseBusinessSlugOrThrow(raw: unknown): string {
  const result = validateBusinessSlug(raw);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.slug;
}
