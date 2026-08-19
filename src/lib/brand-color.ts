/** Strict allowlist for CSS colors injected into a <style> block or stored as brand settings. */

export class InvalidBrandColorError extends Error {
  constructor(field: string) {
    super(
      `Invalid ${field}: use a hex color (#RGB or #RRGGBB) or rgb()/rgba() with 0–255 channels.`
    );
    this.name = "InvalidBrandColorError";
  }
}

export class InvalidBrandAssetUrlError extends Error {
  constructor(field: string) {
    super(
      `Invalid ${field}: use a same-origin path (/…) or an https:// URL with no quotes, scripts, or CSS.`
    );
    this.name = "InvalidBrandAssetUrlError";
  }
}

/** Logo / favicon / email-logo values stored in settings and interpolated into HTML. */
export function isSafeBrandAssetUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (/[\s"'<>\\]/.test(v)) return false;
  if (v.startsWith("/") && !v.startsWith("//")) return true;
  try {
    const url = new URL(v);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function assertSafeBrandAssetUrls(business: {
  logoUrl?: string;
  faviconUrl?: string;
  emailLogoUrl?: string;
}): void {
  const fields = [
    ["logoUrl", business.logoUrl],
    ["faviconUrl", business.faviconUrl],
    ["emailLogoUrl", business.emailLogoUrl],
  ] as const;
  for (const [field, value] of fields) {
    if (value !== undefined && !isSafeBrandAssetUrl(value)) {
      throw new InvalidBrandAssetUrlError(field);
    }
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

/** Only the color fields whose stored value is changing. */
export function changedBrandColors(
  current: { brandPrimaryColor?: string; brandAccentColor?: string },
  next: { brandPrimaryColor?: string; brandAccentColor?: string }
): { brandPrimaryColor?: string; brandAccentColor?: string } {
  const out: { brandPrimaryColor?: string; brandAccentColor?: string } = {};
  if (
    next.brandPrimaryColor !== undefined &&
    (current.brandPrimaryColor ?? "").trim() !== next.brandPrimaryColor.trim()
  ) {
    out.brandPrimaryColor = next.brandPrimaryColor;
  }
  if (
    next.brandAccentColor !== undefined &&
    (current.brandAccentColor ?? "").trim() !== next.brandAccentColor.trim()
  ) {
    out.brandAccentColor = next.brandAccentColor;
  }
  return out;
}

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [15, 23, 42]; // #0F172A — Swift primary, high-contrast dark text
const PAGE: Rgb = [248, 250, 252]; // #F8FAFC
const UI_CONTRAST = 3;
const TEXT_CONTRAST = 4.5;

function parseRgb(value: string): Rgb | null {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = v.match(RGB_RE);
  if (!rgb) return null;
  const r = Number(rgb[1]);
  const g = Number(rgb[2]);
  const b = Number(rgb[3]);
  if (r > 255 || g > 255 || b > 255) return null;
  return [r, g, b];
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channelToLinear(rgb[0]) + 0.7152 * channelToLinear(rgb[1]) + 0.0722 * channelToLinear(rgb[2]);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function toCss(rgb: Rgb): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function pickForeground(bg: Rgb): { color: Rgb; css: string; usedDark: boolean } {
  const whiteRatio = contrastRatio(bg, WHITE);
  const darkRatio = contrastRatio(bg, INK);
  // Prefer white when it meets UI contrast so Swift's #3B82F6 buttons stay white-on-blue.
  if (whiteRatio >= UI_CONTRAST) {
    return { color: WHITE, css: "#ffffff", usedDark: false };
  }
  if (darkRatio >= UI_CONTRAST) {
    return { color: INK, css: "#0F172A", usedDark: true };
  }
  if (darkRatio >= whiteRatio) {
    return { color: INK, css: "#0F172A", usedDark: true };
  }
  return { color: WHITE, css: "#ffffff", usedDark: false };
}

function darkenUntilContrast(rgb: Rgb, against: Rgb, minRatio: number): Rgb {
  let current = rgb;
  for (let i = 0; i < 28; i++) {
    if (contrastRatio(current, against) >= minRatio) return current;
    current = mix(current, INK, 0.14);
  }
  return INK;
}

export type BrandThemeVars = {
  primary: string;
  primaryForeground: string;
  primaryHover: string;
  primaryActive: string;
  accent: string;
  accentForeground: string;
  accentHover: string;
  accentActive: string;
  accentSubtle: string;
  accentBorder: string;
  ring: string;
};

export type BrandContrastWarning = {
  field: "brandPrimaryColor" | "brandAccentColor";
  message: string;
};

export function brandContrastWarnings(primary: string, accent: string): BrandContrastWarning[] {
  const warnings: BrandContrastWarning[] = [];

  const primaryRgb = parseRgb(sanitizeCssColor(primary, "#0F172A"));
  if (primaryRgb) {
    const fg = pickForeground(primaryRgb);
    const ratio = contrastRatio(primaryRgb, fg.color);
    if (ratio < TEXT_CONTRAST) {
      warnings.push({
        field: "brandPrimaryColor",
        message: `Primary is below WCAG AA body contrast (${ratio.toFixed(1)}:1). Text on primary surfaces will use a high-contrast foreground.`,
      });
    }
  }

  const accentRgb = parseRgb(sanitizeCssColor(accent, "#3B82F6"));
  if (accentRgb) {
    const vsWhite = contrastRatio(accentRgb, WHITE);
    const vsPage = contrastRatio(accentRgb, PAGE);
    const fg = pickForeground(accentRgb);
    if (vsWhite < UI_CONTRAST || vsPage < UI_CONTRAST) {
      warnings.push({
        field: "brandAccentColor",
        message:
          "This accent is too light to use as link or button color on a white page. The portal darkens it for text, rings, and fills so everything stays readable.",
      });
    } else if (fg.usedDark) {
      warnings.push({
        field: "brandAccentColor",
        message: "This accent is light, so buttons and badges use dark text instead of white.",
      });
    }
  }

  return warnings;
}

export function deriveBrandTheme(primaryRaw: string, accentRaw: string): BrandThemeVars {
  const primarySafe = sanitizeCssColor(primaryRaw, "#0F172A");
  const accentSafe = sanitizeCssColor(accentRaw, "#3B82F6");
  const primaryRgb = parseRgb(primarySafe) ?? INK;
  const accentChosen = parseRgb(accentSafe) ?? [59, 130, 246];

  const accentForUi =
    contrastRatio(accentChosen, WHITE) >= UI_CONTRAST && contrastRatio(accentChosen, PAGE) >= UI_CONTRAST
      ? accentChosen
      : darkenUntilContrast(accentChosen, WHITE, UI_CONTRAST);

  const primaryFg = pickForeground(primaryRgb);
  const accentFg = pickForeground(accentForUi);

  const vars: BrandThemeVars = {
    primary: toCss(primaryRgb),
    primaryForeground: primaryFg.css,
    primaryHover: toCss(mix(primaryRgb, WHITE, 0.12)),
    primaryActive: toCss(mix(primaryRgb, INK, 0.12)),
    accent: toCss(accentForUi),
    accentForeground: accentFg.css,
    accentHover: toCss(mix(accentForUi, INK, 0.12)),
    accentActive: toCss(mix(accentForUi, INK, 0.2)),
    accentSubtle: toCss(mix(accentForUi, WHITE, 0.9)),
    accentBorder: toCss(mix(accentForUi, WHITE, 0.55)),
    ring: toCss(accentForUi),
  };

  return {
    primary: sanitizeCssColor(vars.primary, "#0F172A"),
    primaryForeground: sanitizeCssColor(vars.primaryForeground, "#ffffff"),
    primaryHover: sanitizeCssColor(vars.primaryHover, vars.primary),
    primaryActive: sanitizeCssColor(vars.primaryActive, vars.primary),
    accent: sanitizeCssColor(vars.accent, "#3B82F6"),
    accentForeground: sanitizeCssColor(vars.accentForeground, "#ffffff"),
    accentHover: sanitizeCssColor(vars.accentHover, vars.accent),
    accentActive: sanitizeCssColor(vars.accentActive, vars.accent),
    accentSubtle: sanitizeCssColor(vars.accentSubtle, "#eff6ff"),
    accentBorder: sanitizeCssColor(vars.accentBorder, "#93c5fd"),
    ring: sanitizeCssColor(vars.ring, vars.accent),
  };
}

export function brandThemeCss(primary: string, accent: string): string {
  const t = deriveBrandTheme(primary, accent);
  return `:root {
  --color-primary: ${t.primary};
  --color-primary-foreground: ${t.primaryForeground};
  --color-primary-hover: ${t.primaryHover};
  --color-primary-active: ${t.primaryActive};
  --color-accent: ${t.accent};
  --color-accent-foreground: ${t.accentForeground};
  --color-accent-hover: ${t.accentHover};
  --color-accent-active: ${t.accentActive};
  --color-accent-subtle: ${t.accentSubtle};
  --color-accent-border: ${t.accentBorder};
  --color-ring: ${t.ring};
  --brand-primary: ${t.primary};
  --brand-accent: ${t.accent};
}`;
}
