/** Strict allowlist for CSS colors injected into a <style> block or stored as brand settings. */

export class InvalidBrandColorError extends Error {
  constructor(field: string) {
    super(
      `Invalid ${field}: use a hex color (#RGB or #RRGGBB) or rgb()/rgba() with 0–255 channels.`
    );
    this.name = "InvalidBrandColorError";
  }
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_RE =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/;

export function isSafeCssColor(value: string): boolean {
  const v = value.trim();
  if (HEX_RE.test(v)) return true;
  const match = v.match(RGB_RE);
  if (!match) return false;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  return r <= 255 && g <= 255 && b <= 255;
}

export function sanitizeCssColor(value: string, fallback: string): string {
  return isSafeCssColor(value) ? value.trim() : fallback;
}

export function assertSafeBrandColors(business: {
  brandPrimaryColor?: string;
  brandAccentColor?: string;
}): void {
  if (business.brandPrimaryColor !== undefined && !isSafeCssColor(business.brandPrimaryColor)) {
    throw new InvalidBrandColorError("brandPrimaryColor");
  }
  if (business.brandAccentColor !== undefined && !isSafeCssColor(business.brandAccentColor)) {
    throw new InvalidBrandColorError("brandAccentColor");
  }
}
