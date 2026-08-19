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
  background: string;
  card: string;
  subtle: string;
  border: string;
  foreground: string;
  muted: string;
  heading: string;
  backgroundForeground: string;
  cardForeground: string;
};

export type BrandContrastWarning = {
  field: "brandPrimaryColor" | "brandAccentColor";
  message: string;
};

/** Brand-guide Cloud, Midnight, Slate — used as derivation anchors, not raw page fills. */
const CLOUD: Rgb = [248, 250, 252];
const SLATE_200: Rgb = [226, 232, 240];
const SLATE_600: Rgb = [71, 85, 105];
const BODY: Rgb = [51, 65, 85]; // existing Swift body #334155
const MUTED: Rgb = [100, 116, 139]; // existing Swift muted #64748b
const SWIFT_PRIMARY: Rgb = [15, 23, 42];
const SWIFT_ACCENT: Rgb = [59, 130, 246];

function rgbClose(a: Rgb, b: Rgb, tol = 4): boolean {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function ensureContrast(fg: Rgb, bg: Rgb, minRatio: number): Rgb {
  let current = fg;
  for (let i = 0; i < 32; i++) {
    if (contrastRatio(current, bg) >= minRatio) return current;
    current = mix(current, INK, 0.12);
  }
  return INK;
}

/**
 * Near-white page fill in the spirit of Cloud #F8FAFC.
 * Never returns the raw brand color. Mix amount collapses for very dark hues
 * so #000000 / #0F172A do not produce a dark page.
 */
function cloudTint(hue: Rgb): Rgb {
  const lum = relativeLuminance(hue);
  let t = lum < 0.08 ? 0.016 : lum > 0.9 ? 0.045 : 0.028 + (1 - lum) * 0.012;
  t = Math.min(0.05, Math.max(0.012, t));
  let bg = mix(CLOUD, hue, t);
  let guard = 0;
  while (relativeLuminance(bg) < 0.94 && guard < 12) {
    t *= 0.65;
    bg = mix(CLOUD, hue, t);
    guard += 1;
  }
  if (relativeLuminance(bg) < 0.92) return CLOUD;
  return bg;
}

function sanitizeTheme(vars: BrandThemeVars): BrandThemeVars {
  const fallbacks: BrandThemeVars = {
    primary: "#0F172A",
    primaryForeground: "#ffffff",
    primaryHover: "#1e293b",
    primaryActive: "#020617",
    accent: "#3B82F6",
    accentForeground: "#ffffff",
    accentHover: "#2563eb",
    accentActive: "#1d4ed8",
    accentSubtle: "#eff6ff",
    accentBorder: "#93c5fd",
    ring: "#3B82F6",
    background: "#F8FAFC",
    card: "#ffffff",
    subtle: "#F8FAFC",
    border: "#E2E8F0",
    foreground: "#334155",
    muted: "#64748b",
    heading: "#0F172A",
    backgroundForeground: "#334155",
    cardForeground: "#334155",
  };
  const out = { ...vars };
  (Object.keys(fallbacks) as (keyof BrandThemeVars)[]).forEach((key) => {
    out[key] = sanitizeCssColor(vars[key], fallbacks[key]);
  });
  return out;
}

export function cssContrast(a: string, b: string): number | null {
  const ar = parseRgb(a);
  const br = parseRgb(b);
  if (!ar || !br) return null;
  return contrastRatio(ar, br);
}

export function themeContrastPairs(t: BrandThemeVars): { pair: string; ratio: number; min: number; ok: boolean }[] {
  const pairs: { pair: string; ratio: number; min: number }[] = [];
  const add = (pair: string, a: string, b: string, min: number) => {
    const ratio = cssContrast(a, b);
    if (ratio == null) return;
    pairs.push({ pair, ratio, min });
  };
  add("body on page", t.foreground, t.background, TEXT_CONTRAST);
  add("heading on page", t.heading, t.background, TEXT_CONTRAST);
  add("muted on page", t.muted, t.background, TEXT_CONTRAST);
  add("body on card", t.cardForeground, t.card, TEXT_CONTRAST);
  add("accent on page (UI)", t.accent, t.background, UI_CONTRAST);
  add("accent fg on accent", t.accentForeground, t.accent, UI_CONTRAST);
  add("primary fg on primary", t.primaryForeground, t.primary, UI_CONTRAST);
  return pairs.map((p) => ({ ...p, ok: p.ratio + 1e-6 >= p.min }));
}

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

  const swiftSurfaces = rgbClose(primaryRgb, SWIFT_PRIMARY) && rgbClose(accentChosen, SWIFT_ACCENT);

  let background: Rgb;
  let card: Rgb;
  let subtle: Rgb;
  let border: Rgb;
  let foreground: Rgb;
  let muted: Rgb;
  let heading: Rgb;

  if (swiftSurfaces) {
    // Keep the live Swift portal on the exact tokens in globals.css.
    background = CLOUD;
    card = WHITE;
    subtle = CLOUD;
    border = SLATE_200;
    foreground = BODY;
    muted = MUTED;
    heading = SWIFT_PRIMARY;
  } else {
    // Tint from accent (the color admins think of as "brand"), never raw fill.
    background = cloudTint(accentForUi);
    card = mix(WHITE, accentForUi, 0.012);
    if (relativeLuminance(card) < 0.97) card = WHITE;
    subtle = mix(background, accentForUi, 0.04);
    if (relativeLuminance(subtle) < 0.93) subtle = mix(CLOUD, accentForUi, 0.03);
    border = mix(SLATE_200, accentForUi, 0.1);
    heading = ensureContrast(relativeLuminance(primaryRgb) < 0.35 ? primaryRgb : INK, background, TEXT_CONTRAST);
    foreground = ensureContrast(SLATE_600, background, TEXT_CONTRAST);
    muted = ensureContrast(MUTED, background, TEXT_CONTRAST);
  }

  const bgFg = ensureContrast(foreground, background, TEXT_CONTRAST);
  const cardFg = ensureContrast(foreground, card, TEXT_CONTRAST);

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
    background: swiftSurfaces ? "#F8FAFC" : toCss(background),
    card: swiftSurfaces ? "#ffffff" : toCss(card),
    subtle: swiftSurfaces ? "#F8FAFC" : toCss(subtle),
    border: swiftSurfaces ? "#E2E8F0" : toCss(border),
    foreground: swiftSurfaces ? "#334155" : toCss(bgFg),
    muted: swiftSurfaces ? "#64748b" : toCss(muted),
    heading: swiftSurfaces ? "#0F172A" : toCss(heading),
    backgroundForeground: swiftSurfaces ? "#334155" : toCss(bgFg),
    cardForeground: swiftSurfaces ? "#334155" : toCss(cardFg),
  };

  return sanitizeTheme(vars);
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
  --color-background: ${t.background};
  --color-foreground: ${t.foreground};
  --color-muted: ${t.muted};
  --color-border: ${t.border};
  --color-card: ${t.card};
  --color-heading: ${t.heading};
  --color-subtle: ${t.subtle};
  --color-card-foreground: ${t.cardForeground};
  --brand-primary: ${t.primary};
  --brand-accent: ${t.accent};
}`;
}
