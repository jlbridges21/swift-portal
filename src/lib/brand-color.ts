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

/**
 * Convert a CSS color to `#rrggbb` for `<input type="color">`.
 * Native color inputs have no empty state — callers must pass a display fallback
 * when the stored value is unset, without writing that fallback to storage.
 */
export function toNativeColorInputValue(value: string, fallback: string): string {
  const fromValue = parseRgb(value);
  const rgb = fromValue ?? parseRgb(fallback) ?? [0, 0, 0];
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
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

/**
 * Walk `rgb` until it clears `minRatio` against `against`.
 * Light surfaces mix toward ink. Dark surfaces mix toward white.
 * A light page therefore still darkens, which is what every existing caller does.
 */
function contrastTarget(against: Rgb): Rgb {
  return relativeLuminance(against) > 0.5 ? INK : WHITE;
}

function darkenUntilContrast(rgb: Rgb, against: Rgb, minRatio: number): Rgb {
  const toward = contrastTarget(against);
  let current = rgb;
  for (let i = 0; i < 28; i++) {
    if (contrastRatio(current, against) >= minRatio) return current;
    current = mix(current, toward, 0.14);
  }
  return toward;
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

/**
 * Primary is a fill (buttons, badges, bars), not body text.
 * It only has to read as a shape against the page and the card (3:1).
 * The label on that fill still has to clear body contrast (4.5:1).
 * The fill moves only when the raw brand color fails one of those bars,
 * so a navy that already clears both stays the navy.
 */
function labelOnFill(fill: Rgb): { color: Rgb; css: string; usedDark: boolean } | null {
  const whiteRatio = contrastRatio(fill, WHITE);
  const inkRatio = contrastRatio(fill, INK);
  if (whiteRatio + 1e-6 >= TEXT_CONTRAST) {
    return { color: WHITE, css: "#ffffff", usedDark: false };
  }
  if (inkRatio + 1e-6 >= TEXT_CONTRAST) {
    return { color: INK, css: "#0F172A", usedDark: true };
  }
  return null;
}

/**
 * A dark brand lightened straight toward white turns into grey.
 * Scale the original hue so the walk stays on that color (navy stays blue).
 */
function lightChromaTarget(original: Rgb): Rgb {
  const max = Math.max(original[0], original[1], original[2]);
  if (max < 8) return [176, 196, 230];
  const scale = 220 / max;
  return [
    Math.min(255, Math.round(original[0] * scale)),
    Math.min(255, Math.round(original[1] * scale)),
    Math.min(255, Math.round(original[2] * scale)),
  ];
}

function fitPrimaryFill(
  color: Rgb,
  surfaces: Rgb[]
): { fill: Rgb; fg: { color: Rgb; css: string; usedDark: boolean } } {
  const chroma = lightChromaTarget(color);
  let current = color;
  let best = current;
  let bestLabel = -1;
  for (let i = 0; i < 48; i++) {
    const shapeFail = surfaces.find((surface) => contrastRatio(current, surface) + 1e-6 < UI_CONTRAST);
    const whiteRatio = contrastRatio(current, WHITE);
    const inkRatio = contrastRatio(current, INK);
    const labelRatio = Math.max(whiteRatio, inkRatio);
    if (!shapeFail && labelRatio > bestLabel) {
      best = current;
      bestLabel = labelRatio;
    }
    const fg = labelOnFill(current);
    if (!shapeFail && fg) return { fill: current, fg };
    if (shapeFail) {
      const toward = relativeLuminance(shapeFail) > 0.5 ? INK : chroma;
      current = mix(current, toward, 0.12);
      continue;
    }
    current = mix(current, whiteRatio >= inkRatio ? INK : chroma, 0.12);
  }
  return { fill: best, fg: labelOnFill(best) ?? pickForeground(best) };
}

/**
 * Active nav is accent text on the accent wash. Move the wash, not the accent.
 * A darker accent that cannot clear 4.5:1 against any lighter color (Swift blue
 * tops out near 3.7:1 on white, and about 4.4:1 on black) keeps the existing
 * pale wash. Inverting that chip to near-black would repaint light mode.
 * A lighter accent is pulled onto a darker wash until the pair clears 4.5:1.
 */
function tuneAccentSubtle(accent: Rgb, subtle: Rgb): Rgb {
  if (contrastRatio(accent, subtle) + 1e-6 >= TEXT_CONTRAST) return subtle;
  const accentIsDarker = relativeLuminance(accent) < relativeLuminance(subtle);
  if (accentIsDarker && contrastRatio(accent, WHITE) + 1e-6 < TEXT_CONTRAST) return subtle;
  const toward = accentIsDarker ? WHITE : INK;
  let current = subtle;
  for (let i = 0; i < 28; i++) {
    if (contrastRatio(accent, current) + 1e-6 >= TEXT_CONTRAST) return current;
    current = mix(current, toward, 0.14);
  }
  return current;
}

function ensureContrast(fg: Rgb, bg: Rgb, minRatio: number): Rgb {
  const toward = contrastTarget(bg);
  let current = fg;
  for (let i = 0; i < 32; i++) {
    if (contrastRatio(current, bg) >= minRatio) return current;
    current = mix(current, toward, 0.12);
  }
  return toward;
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
  add("primary shape on page", t.primary, t.background, UI_CONTRAST);
  add("primary shape on card", t.primary, t.card, UI_CONTRAST);
  add("primary fg on primary", t.primaryForeground, t.primary, TEXT_CONTRAST);
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

/** Portal background: light, dark, or the business's primary color ("brand"). */
export type SurfaceMode = "light" | "dark" | "brand";

/** Missing or unexpected values stay light, which is today's portal. */
export function parseSurfaceMode(value: unknown): SurfaceMode {
  return value === "dark" ? "dark" : value === "brand" ? "brand" : "light";
}

/**
 * Whether a surface reads as light or dark (color-scheme, dark-only CSS, status bar). A primary
 * color background is dark when white text suits it better than ink, light otherwise.
 */
export function surfaceTone(mode: SurfaceMode, primaryRaw: string): "light" | "dark" {
  if (mode !== "brand") return mode;
  const rgb = parseRgb(sanitizeCssColor(primaryRaw, "#0F172A")) ?? INK;
  return brandSurfaceIsDark(rgb) ? "dark" : "light";
}

/** Browser/PWA chrome for a business surface: the page background and its color scheme. */
export function surfaceChrome(business: {
  brandPrimaryColor: string;
  brandAccentColor: string;
  surfaceMode?: unknown;
}): { themeColor: string; colorScheme: "light" | "dark" } {
  const mode = parseSurfaceMode(business.surfaceMode);
  const t = deriveBrandTheme(business.brandPrimaryColor, business.brandAccentColor, mode);
  return { themeColor: t.background, colorScheme: surfaceTone(mode, business.brandPrimaryColor) };
}

/**
 * Client-portal dark surfaces. Inks are measured against these fills
 * (heading 14.6–16.9:1, body 11.8–13.6:1, muted 6.2–7.2:1). Do not
 * darken the inks or lighten the fills without re-checking those ratios.
 */
const DARK_SURFACES = {
  background: "#14181F",
  card: "#1C222B",
  subtle: "#10141A",
  border: "#2C333E",
  heading: "#F1F5F9",
  foreground: "#D6DEE8",
  muted: "#94A3B8",
} as const;

const DARK_BACKGROUND: Rgb = [0x14, 0x18, 0x1f];
const DARK_CARD: Rgb = [0x1c, 0x22, 0x2b];
const DARK_SUBTLE: Rgb = [0x10, 0x14, 0x1a];
const DARK_BORDER: Rgb = [0x2c, 0x33, 0x3e];

function deriveDarkBrandTheme(primaryRaw: string, accentRaw: string): BrandThemeVars {
  const primarySafe = sanitizeCssColor(primaryRaw, "#0F172A");
  const accentSafe = sanitizeCssColor(accentRaw, "#3B82F6");
  const primaryChosen = parseRgb(primarySafe) ?? INK;
  const accentChosen = parseRgb(accentSafe) ?? [59, 130, 246];

  const fittedPrimary = fitPrimaryFill(primaryChosen, [DARK_CARD, DARK_BACKGROUND]);
  const primaryRgb = fittedPrimary.fill;

  // Accent is also nav and link text, so it has to clear body contrast, not only the 3:1 UI bar.
  let accentUi = darkenUntilContrast(accentChosen, DARK_BACKGROUND, TEXT_CONTRAST);
  accentUi = darkenUntilContrast(accentUi, DARK_CARD, TEXT_CONTRAST);
  const accentFg = pickForeground(accentUi);

  // A pale wash (light mode's 90% white mix) is a bright block on charcoal.
  // Start from the card and add a little of the accent, then pull back toward
  // the darker subtle fill until both the accent and the accent foreground clear 4.5:1.
  let accentSubtle = mix(DARK_CARD, accentUi, 0.22);
  for (let i = 0; i < 16; i++) {
    const accentOk = contrastRatio(accentUi, accentSubtle) >= TEXT_CONTRAST;
    const fgOk = contrastRatio(accentFg.color, accentSubtle) >= TEXT_CONTRAST;
    if (accentOk && fgOk) break;
    accentSubtle = mix(accentSubtle, DARK_SUBTLE, 0.28);
  }

  const accentBorder = mix(DARK_BORDER, accentUi, 0.4);
  const primaryFg = fittedPrimary.fg;

  const vars: BrandThemeVars = {
    primary: toCss(primaryRgb),
    primaryForeground: primaryFg.css,
    primaryHover: toCss(mix(primaryRgb, WHITE, 0.12)),
    primaryActive: toCss(mix(primaryRgb, DARK_BACKGROUND, 0.16)),
    accent: toCss(accentUi),
    accentForeground: accentFg.css,
    accentHover: toCss(mix(accentUi, WHITE, 0.1)),
    accentActive: toCss(mix(accentUi, DARK_BACKGROUND, 0.16)),
    accentSubtle: toCss(accentSubtle),
    accentBorder: toCss(accentBorder),
    ring: toCss(accentUi),
    background: DARK_SURFACES.background,
    card: DARK_SURFACES.card,
    subtle: DARK_SURFACES.subtle,
    border: DARK_SURFACES.border,
    foreground: DARK_SURFACES.foreground,
    muted: DARK_SURFACES.muted,
    heading: DARK_SURFACES.heading,
    backgroundForeground: DARK_SURFACES.foreground,
    cardForeground: DARK_SURFACES.foreground,
  };

  return sanitizeTheme(vars);
}

export function deriveBrandTheme(
  primaryRaw: string,
  accentRaw: string,
  surfaceMode: SurfaceMode = "light"
): BrandThemeVars {
  if (surfaceMode === "dark") return deriveDarkBrandTheme(primaryRaw, accentRaw);
  if (surfaceMode === "brand") return deriveBrandSurfaceTheme(primaryRaw, accentRaw);
  return deriveLightBrandTheme(primaryRaw, accentRaw);
}

const NEAR_BLACK: Rgb = [6, 8, 14];

/**
 * Mid and dark primaries take white text (deepened if needed); only genuinely light ones
 * (pastels, yellows) take ink. A saturated mid-tone looks better deepened than washed out.
 */
function brandSurfaceIsDark(primary: Rgb): boolean {
  return relativeLuminance(primary) < 0.4;
}

/** White text on a dark primary page reaches this; ink on a light one reaches LIGHT_TARGET. */
const BRAND_DARK_TARGET = 8;
const BRAND_LIGHT_TARGET = 9;

/**
 * The page background for the "Primary color" option: the primary itself, moved only as far as
 * needed for comfortable reading (deepened under white text, lightened under ink).
 */
export function brandSurfaceBackground(primaryRaw: string): string {
  const rgb = parseRgb(sanitizeCssColor(primaryRaw, "#0F172A")) ?? INK;
  return toCss(brandSurfaceFill(rgb));
}

function brandSurfaceFill(primary: Rgb): Rgb {
  const dark = brandSurfaceIsDark(primary);
  const text = dark ? WHITE : INK;
  const toward = dark ? NEAR_BLACK : WHITE;
  const target = dark ? BRAND_DARK_TARGET : BRAND_LIGHT_TARGET;
  let current = primary;
  for (let i = 0; i < 40; i++) {
    if (contrastRatio(text, current) >= target) return current;
    current = mix(current, toward, 0.08);
  }
  return toward;
}

function fitPrimaryOnBrandSurface(
  primary: Rgb,
  surfaces: Rgb[],
  darkPage: boolean
): { fill: Rgb; fg: { color: Rgb; css: string; usedDark: boolean } } {
  const toward = darkPage ? WHITE : INK;
  let current = darkPage ? mix(primary, WHITE, 0.55) : mix(primary, INK, 0.35);
  for (let i = 0; i < 40; i++) {
    const shapeOk = surfaces.every((sfc) => contrastRatio(current, sfc) >= UI_CONTRAST);
    const label = contrastRatio(current, WHITE) >= contrastRatio(current, INK) ? WHITE : INK;
    if (shapeOk && contrastRatio(current, label) >= TEXT_CONTRAST) {
      return {
        fill: current,
        fg: label === WHITE ? { color: WHITE, css: "#ffffff", usedDark: false } : { color: INK, css: "#0F172A", usedDark: true },
      };
    }
    current = mix(current, toward, 0.1);
  }
  return { fill: toward, fg: darkPage ? { color: INK, css: "#0F172A", usedDark: true } : { color: WHITE, css: "#ffffff", usedDark: false } };
}

/** True when the primary had to be deepened or lightened to keep text readable on it. */
export function brandSurfaceAdjusted(primaryRaw: string): boolean {
  const rgb = parseRgb(sanitizeCssColor(primaryRaw, "#0F172A")) ?? INK;
  return !rgbClose(rgb, brandSurfaceFill(rgb), 6);
}

/**
 * "Primary color" portal background. The page is the primary color; cards sit a step lighter
 * (white-ish on light primaries, a soft lift on dark ones). Every ink is measured against the
 * surfaces it sits on: heading and body ≥ 4.5:1 with margin, muted ≥ 4.5:1, accent text ≥ 4.5:1,
 * buttons and borders ≥ 3:1.
 */
function deriveBrandSurfaceTheme(primaryRaw: string, accentRaw: string): BrandThemeVars {
  const primarySafe = sanitizeCssColor(primaryRaw, "#0F172A");
  const accentSafe = sanitizeCssColor(accentRaw, "#3B82F6");
  const rawPrimary = parseRgb(primarySafe) ?? INK;
  const accentChosen = parseRgb(accentSafe) ?? [59, 130, 246];
  const dark = brandSurfaceIsDark(rawPrimary);

  const background = brandSurfaceFill(rawPrimary);
  const card = dark ? mix(background, WHITE, 0.07) : mix(background, WHITE, 0.62);
  const subtle = dark ? mix(background, NEAR_BLACK, 0.22) : mix(background, INK, 0.05);
  const border = dark ? mix(background, WHITE, 0.17) : mix(background, INK, 0.15);
  // Every ink is checked against all three surfaces it can sit on.
  const surfaces = [background, card, subtle];
  const fitAll = (fg: Rgb, min: number) => {
    let c = fg;
    for (let i = 0; i < 40 && !surfaces.every((sfc) => contrastRatio(c, sfc) >= min); i++) {
      c = mix(c, dark ? WHITE : INK, 0.12);
    }
    return c;
  };

  const heading = fitAll(dark ? mix(WHITE, background, 0.03) : mix(INK, background, 0.04), 7);
  const foreground = fitAll(dark ? mix(WHITE, background, 0.14) : mix(INK, background, 0.16), 6);
  let muted = dark ? mix(WHITE, background, 0.4) : mix(INK, background, 0.42);
  muted = fitAll(muted, TEXT_CONTRAST + 0.1);

  // Accent is link and nav text as well as button fill.
  // Walk one way only (lighter on dark pages, deeper on light ones) so mid-luminance pages
  // can't send it back and forth.
  let accentUi = accentChosen;
  for (let i = 0; i < 40 && !surfaces.every((sfc) => contrastRatio(accentUi, sfc) >= TEXT_CONTRAST); i++) {
    accentUi = mix(accentUi, dark ? WHITE : INK, 0.1);
  }
  const accentFg = pickForeground(accentUi);

  let accentSubtle = mix(card, accentUi, dark ? 0.2 : 0.14);
  for (let i = 0; i < 16; i++) {
    if (contrastRatio(accentUi, accentSubtle) >= TEXT_CONTRAST) break;
    accentSubtle = mix(accentSubtle, dark ? NEAR_BLACK : WHITE, 0.25);
  }

  // Primary-filled shapes (buttons, chips) would vanish on a primary page, so they flip to a
  // tint (dark pages) or a deep shade (light pages) of the same hue that stands out from it.
  const fittedPrimary = fitPrimaryOnBrandSurface(rawPrimary, [background, card], dark);
  const primaryRgb = fittedPrimary.fill;

  const vars: BrandThemeVars = {
    primary: toCss(primaryRgb),
    primaryForeground: fittedPrimary.fg.css,
    primaryHover: toCss(mix(primaryRgb, dark ? WHITE : INK, 0.12)),
    primaryActive: toCss(mix(primaryRgb, dark ? NEAR_BLACK : INK, 0.18)),
    accent: toCss(accentUi),
    accentForeground: accentFg.css,
    accentHover: toCss(mix(accentUi, dark ? WHITE : INK, 0.1)),
    accentActive: toCss(mix(accentUi, dark ? NEAR_BLACK : INK, 0.18)),
    accentSubtle: toCss(accentSubtle),
    accentBorder: toCss(mix(border, accentUi, 0.45)),
    ring: toCss(accentUi),
    background: toCss(background),
    card: toCss(card),
    subtle: toCss(subtle),
    border: toCss(border),
    foreground: toCss(foreground),
    muted: toCss(muted),
    heading: toCss(heading),
    backgroundForeground: toCss(ensureContrast(foreground, background, TEXT_CONTRAST)),
    cardForeground: toCss(ensureContrast(foreground, card, TEXT_CONTRAST)),
  };

  return sanitizeTheme(vars);
}

function deriveLightBrandTheme(primaryRaw: string, accentRaw: string): BrandThemeVars {
  const primarySafe = sanitizeCssColor(primaryRaw, "#0F172A");
  const accentSafe = sanitizeCssColor(accentRaw, "#3B82F6");
  const rawPrimary = parseRgb(primarySafe) ?? INK;
  const accentChosen = parseRgb(accentSafe) ?? [59, 130, 246];

  const accentForUi =
    contrastRatio(accentChosen, WHITE) >= UI_CONTRAST && contrastRatio(accentChosen, PAGE) >= UI_CONTRAST
      ? accentChosen
      : darkenUntilContrast(accentChosen, WHITE, UI_CONTRAST);

  const swiftSurfaces = rgbClose(rawPrimary, SWIFT_PRIMARY) && rgbClose(accentChosen, SWIFT_ACCENT);

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
    // Tint from the chosen accent hue, never a raw brand fill.
    const tintSource =
      contrastRatio(accentChosen, WHITE) >= UI_CONTRAST ? accentChosen : accentForUi;
    background = cloudTint(tintSource);
    card = mix(WHITE, tintSource, 0.012);
    if (relativeLuminance(card) < 0.97) card = WHITE;
    subtle = mix(background, tintSource, 0.04);
    if (relativeLuminance(subtle) < 0.93) subtle = mix(CLOUD, tintSource, 0.03);
    border = mix(SLATE_200, tintSource, 0.1);
    heading = ensureContrast(relativeLuminance(rawPrimary) < 0.35 ? rawPrimary : INK, background, TEXT_CONTRAST);
    foreground = ensureContrast(SLATE_600, background, TEXT_CONTRAST);
    muted = ensureContrast(MUTED, background, TEXT_CONTRAST);
  }

  let accentUi = accentForUi;
  if (!swiftSurfaces) {
    if (contrastRatio(accentUi, background) < UI_CONTRAST) {
      accentUi = darkenUntilContrast(accentUi, background, UI_CONTRAST);
    }
    if (contrastRatio(accentUi, WHITE) < UI_CONTRAST) {
      accentUi = darkenUntilContrast(accentUi, WHITE, UI_CONTRAST);
    }
  }
  const accentFg = pickForeground(accentUi);
  const fittedPrimary = fitPrimaryFill(rawPrimary, [background, card]);
  const primaryRgb = fittedPrimary.fill;
  const primaryFg = fittedPrimary.fg;

  const bgFg = ensureContrast(foreground, background, TEXT_CONTRAST);
  const cardFg = ensureContrast(foreground, card, TEXT_CONTRAST);

  const vars: BrandThemeVars = {
    primary: toCss(primaryRgb),
    primaryForeground: primaryFg.css,
    primaryHover: toCss(mix(primaryRgb, WHITE, 0.12)),
    primaryActive: toCss(mix(primaryRgb, INK, 0.12)),
    accent: toCss(accentUi),
    accentForeground: accentFg.css,
    accentHover: toCss(mix(accentUi, INK, 0.12)),
    accentActive: toCss(mix(accentUi, INK, 0.2)),
    accentSubtle: toCss(tuneAccentSubtle(accentUi, mix(accentUi, WHITE, 0.9))),
    accentBorder: toCss(mix(accentUi, WHITE, 0.55)),
    ring: toCss(accentUi),
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

/**
 * Event-chip text. Same WCAG 2.x formula as the hero overlay check, and the
 * same 4.5:1 bar (`HERO_OVERLAY_CONTRAST_MIN` / `TEXT_CONTRAST`).
 *
 * Relative luminance:
 *   s = channel/255
 *   linear = s <= 0.04045 ? s/12.92 : ((s+0.055)/1.055)^2.4
 *   L = 0.2126*R + 0.7152*G + 0.0722*B
 * Contrast ratio = (Llighter + 0.05) / (Ldarker + 0.05)
 *
 * Candidates are #FFFFFF and #0F172A (the same ink the header nav uses).
 * The higher ratio wins. A brightness cutoff is not used.
 *
 * Pure black vs white bottoms out near 4.58:1, but #0F172A is not pure black,
 * so a band of mid-tones loses to both. When the winner is under 4.5, the fill
 * is walked 12% at a time toward black (if the winner was white) or toward
 * white (if the winner was ink) until the winner reaches 4.5, capped at 24
 * steps. The picker says when that shift happens. Text, time, badges, and the
 * Pending pill all use this paint.
 */
export const EVENT_TEXT_CONTRAST_MIN = TEXT_CONTRAST;
export const SHOOTPORTAL_EVENT_COLOR = "#2563EB";

export type EventChipPaint = {
  /** Fill to paint. Differs from `requested` only when neither candidate reached 4.5:1. */
  background: string;
  foreground: string;
  ratio: number;
  adjusted: boolean;
  requested: string;
};

function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function eventChipPaint(requested: string, fallback = SHOOTPORTAL_EVENT_COLOR): EventChipPaint {
  const safe = isSafeCssColor(requested) ? requested.trim() : fallback;
  const parsed = parseRgb(safe) ?? parseRgb(fallback) ?? [37, 99, 235];
  const whiteRatio = contrastRatio(parsed, WHITE);
  const inkRatio = contrastRatio(parsed, INK);
  const useWhite = whiteRatio >= inkRatio;
  const foreground = useWhite ? WHITE : INK;
  const toward = useWhite ? INK : WHITE;
  let fill = parsed;
  let ratio = useWhite ? whiteRatio : inkRatio;
  let adjusted = false;
  if (ratio + 1e-6 < EVENT_TEXT_CONTRAST_MIN) {
    adjusted = true;
    for (let i = 0; i < 24; i++) {
      fill = mix(fill, toward, 0.12);
      ratio = contrastRatio(fill, foreground);
      if (ratio + 1e-6 >= EVENT_TEXT_CONTRAST_MIN) break;
    }
  }
  return {
    background: rgbToHex(fill),
    foreground: useWhite ? "#FFFFFF" : "#0F172A",
    ratio,
    adjusted,
    requested: rgbToHex(parsed),
  };
}

/** Pending fill is the chosen color mixed 62% toward white, then run through the same contrast paint. */
export function pendingEventChipPaint(requested: string, fallback = SHOOTPORTAL_EVENT_COLOR): EventChipPaint {
  const safe = isSafeCssColor(requested) ? requested.trim() : fallback;
  const parsed = parseRgb(safe) ?? parseRgb(fallback) ?? [37, 99, 235];
  return eventChipPaint(rgbToHex(mix(parsed, WHITE, 0.62)), fallback);
}

/** Dashed pending border. Pushed until it clears 3:1 against the pending fill. */
export function pendingEventBorder(requested: string, pendingFill: string): string {
  const safe = isSafeCssColor(requested) ? requested.trim() : SHOOTPORTAL_EVENT_COLOR;
  const color = parseRgb(safe) ?? [37, 99, 235];
  const against = parseRgb(pendingFill) ?? WHITE;
  if (contrastRatio(color, against) >= UI_CONTRAST) return rgbToHex(color);
  const toward = relativeLuminance(against) > 0.5 ? INK : WHITE;
  let current = color;
  for (let i = 0; i < 20; i++) {
    if (contrastRatio(current, against) >= UI_CONTRAST) break;
    current = mix(current, toward, 0.18);
  }
  return rgbToHex(current);
}

export function brandThemeCss(
  primary: string,
  accent: string,
  surfaceMode: SurfaceMode = "light"
): string {
  const t = deriveBrandTheme(primary, accent, surfaceMode);
  const scheme = surfaceTone(surfaceMode, primary);
  return `:root {
  color-scheme: ${scheme};
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
