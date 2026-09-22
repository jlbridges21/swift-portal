/**
 * Portal / landing logo height bounds.
 * Portal nav is h-14 (56px) / sm:h-16 (64px) — keep logos inside that row.
 * Landing header is more flexible (min-h-16, grows with logo).
 */

export const PORTAL_LOGO_SIZE = {
  /** Desktop `md` baseline when unset. Matches prior hardcoded md box. */
  default: 40,
  min: 24,
  max: 48,
} as const;

export const LANDING_LOGO_SIZE = {
  /** Prior hardcoded `h-8` (32px). */
  default: 32,
  min: 28,
  max: 72,
} as const;

export function clampPortalLogoSizePx(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return PORTAL_LOGO_SIZE.default;
  return Math.max(PORTAL_LOGO_SIZE.min, Math.min(PORTAL_LOGO_SIZE.max, Math.round(n)));
}

/**
 * Normalize stored portal logo size. Missing / null / invalid → default (unchanged look).
 */
export function normalizePortalLogoSizePx(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return PORTAL_LOGO_SIZE.default;
  return clampPortalLogoSizePx(raw);
}

export function clampLandingLogoSizePx(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return LANDING_LOGO_SIZE.default;
  return Math.max(LANDING_LOGO_SIZE.min, Math.min(LANDING_LOGO_SIZE.max, Math.round(n)));
}

/**
 * Landing size: null means “use default” (byte-identical for businesses that never set it).
 */
export function normalizeLandingLogoSizePx(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  return clampLandingLogoSizePx(raw);
}

export type LogoSizeVariant = "sm" | "md" | "lg";

/**
 * User-chosen size is the desktop `md` height in CSS pixels.
 * Responsive variants scale from that base so existing breakpoint switches still work:
 * - compact / sm → 80% of md (min 20)
 * - md → 100%
 * - lg → 115% of md, capped at PORTAL_LOGO_SIZE.max
 */
export function resolvePortalLogoHeightPx(
  baseMdPx: number,
  size: LogoSizeVariant = "md",
  compact = false
): number {
  const base = clampPortalLogoSizePx(baseMdPx);
  const variant: LogoSizeVariant = compact ? "sm" : size;
  const scale = variant === "sm" ? 0.8 : variant === "lg" ? 1.15 : 1;
  const scaled = Math.round(base * scale);
  return Math.max(20, Math.min(PORTAL_LOGO_SIZE.max, scaled));
}

export function resolveLandingLogoHeightPx(stored: number | null | undefined): number {
  if (stored == null) return LANDING_LOGO_SIZE.default;
  return clampLandingLogoSizePx(stored);
}
