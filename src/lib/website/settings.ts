/**
 * Business Website settings (client-safe — no server imports).
 *
 * Stored in business_settings.settings under two keys:
 *   website    — appearance + homepage + contact copy. Edited in Settings → Business Website and
 *                saved with the normal Save button (unsaved edits only exist in the editor preview).
 *   portfolio  — approved public portfolio projects. Server-owned: only the portfolio API writes it
 *                (generic settings PATCHes never overwrite it — see saveAppSettings).
 *
 * Everything is optional. An untouched business renders a complete website from its name, logo,
 * colors, contact details and services. Empty strings mean "use the automatic default".
 */

import {
  mergeLandingSettings,
  parseStrictHttpsUrl,
  sanitizePlainText,
  type LandingSettings,
} from "@/lib/landing-content";
import { isSafeBrandAssetUrl, isSafeCssColor } from "@/lib/brand-color";
import { extractYouTubeId } from "@/lib/youtube";

export const WEBSITE_TEMPLATES = ["modern", "luxury", "minimal"] as const;
export type WebsiteTemplateId = (typeof WEBSITE_TEMPLATES)[number];

export const WEBSITE_TEMPLATE_INFO: Record<WebsiteTemplateId, { name: string; blurb: string }> = {
  modern: { name: "Modern", blurb: "Bold full-bleed photography, clean type, contemporary layout." },
  luxury: { name: "Luxury", blurb: "Cinematic dark canvas, elegant serif type, refined galleries." },
  minimal: { name: "Minimal", blurb: "Photography first, generous whitespace, quiet typography." },
};

/** Hero media: auto = cover of the first featured portfolio project, else the designed fallback. */
export const WEBSITE_HERO_SOURCES = ["auto", "image", "video", "design"] as const;
export type WebsiteHeroSource = (typeof WEBSITE_HERO_SOURCES)[number];

export const WEBSITE_LIMITS = {
  headline: 90,
  intro: 260,
  ctaLabel: 32,
  ctaHeading: 80,
  ctaText: 220,
  contactIntro: 280,
  seoTitle: 70,
  seoDescription: 170,
  url: 500,
  redirectsMax: 30,
  redirectPath: 120,
  portfolioTitle: 80,
  portfolioCategory: 40,
  portfolioDescription: 300,
  portfolioMediaMax: 60,
  featuredServicesMax: 9,
} as const;

export type WebsiteSocialKey = "instagram" | "facebook" | "youtube" | "linkedin" | "tiktok" | "vimeo";
export const WEBSITE_SOCIAL_KEYS: WebsiteSocialKey[] = ["instagram", "facebook", "youtube", "linkedin", "tiktok", "vimeo"];
export const WEBSITE_SOCIAL_LABELS: Record<WebsiteSocialKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  vimeo: "Vimeo",
};
const SOCIAL_HOSTS: Record<WebsiteSocialKey, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "m.facebook.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  vimeo: ["vimeo.com", "www.vimeo.com"],
};

export type WebsiteRedirect = { from: string; to: string };

/** A photo or video chosen from the business's ShootPortal media for the homepage hero. */
export type WebsiteHeroMedia = {
  id: string;
  /** "youtube" videos play as a muted background embed; "upload" videos stream the file. */
  source: "upload" | "youtube";
  youtubeId: string;
};

export interface WebsiteSettings {
  /**
   * true  → the public homepage is the Business Website.
   * false → the classic Client Landing Page stays live until the business publishes the new site.
   * Businesses that never customized the classic page start on true (see mergeWebsiteSettings).
   */
  launched: boolean;
  template: WebsiteTemplateId;
  /** Empty → brand accent color. */
  accentColor: string;
  headline: string;
  intro: string;
  heroSource: WebsiteHeroSource;
  /** Uploaded/pasted image URL (onboarding upload, classic landing page carry-over). */
  heroImageUrl: string;
  /** Legacy YouTube URL (classic landing showreel carry-over). */
  heroVideoUrl: string;
  /** Photo picked from ShootPortal media — preferred over heroImageUrl. */
  heroImageMedia: WebsiteHeroMedia | null;
  /** Video picked from ShootPortal media — preferred over heroVideoUrl. */
  heroVideoMedia: WebsiteHeroMedia | null;
  /** null → every active service (in catalog order). Otherwise the chosen service ids, in order. */
  featuredServiceIds: string[] | null;
  showServicePricing: boolean;
  /** Primary button label. Empty → "Book a Shoot". */
  ctaLabel: string;
  ctaHeading: string;
  ctaText: string;
  contactIntro: string;
  showAddress: boolean;
  showClientLogin: boolean;
  social: Record<WebsiteSocialKey, string>;
  seoTitle: string;
  seoDescription: string;
  /** Old-website paths → new paths, used after moving a domain to ShootPortal. */
  redirects: WebsiteRedirect[];
}

export interface PortfolioEntry {
  projectId: string;
  slug: string;
  /** Earlier slugs keep redirecting after a title change. */
  previousSlugs: string[];
  title: string;
  category: string;
  description: string;
  /** Approved media, in display order. Only these can ever be public. */
  mediaIds: string[];
  coverId: string | null;
  /** Approved virtual tours. */
  tourIds: string[];
  featured: boolean;
  publishedAt: string;
}

export interface PortfolioSettings {
  entries: PortfolioEntry[];
  /** Delivered projects the business chose not to suggest again. */
  dismissedProjectIds: string[];
}

export const DEFAULT_WEBSITE_CTA_LABEL = "Book a Shoot";

const EMPTY_SOCIAL: Record<WebsiteSocialKey, string> = {
  instagram: "",
  facebook: "",
  youtube: "",
  linkedin: "",
  tiktok: "",
  vimeo: "",
};

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  launched: true,
  template: "modern",
  accentColor: "",
  headline: "",
  intro: "",
  heroSource: "auto",
  heroImageUrl: "",
  heroVideoUrl: "",
  heroImageMedia: null,
  heroVideoMedia: null,
  featuredServiceIds: null,
  showServicePricing: true,
  ctaLabel: "",
  ctaHeading: "",
  ctaText: "",
  contactIntro: "",
  showAddress: false,
  showClientLogin: true,
  social: { ...EMPTY_SOCIAL },
  seoTitle: "",
  seoDescription: "",
  redirects: [],
};

export const DEFAULT_PORTFOLIO_SETTINGS: PortfolioSettings = { entries: [], dismissedProjectIds: [] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isUuidLike(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function sanitizeWebsiteSocial(key: WebsiteSocialKey, raw: unknown): string {
  const r = parseStrictHttpsUrl(raw, { allowedHosts: SOCIAL_HOSTS[key] });
  return r.ok ? r.href : "";
}

function safeAssetUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim().slice(0, WEBSITE_LIMITS.url);
  return v && isSafeBrandAssetUrl(v) ? v : "";
}

function safeVideoUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim().slice(0, WEBSITE_LIMITS.url);
  return v && extractYouTubeId(v) ? v : "";
}

function multiline(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Plain text with line breaks kept (portfolio descriptions, CTA copy). */
export function sanitizeWebsiteText(raw: unknown, max: number): string {
  return multiline(raw, max);
}

/** Normalize a site path for redirects: "/old-page" style, no query, no scheme. */
export function normalizeRedirectPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let v = raw.trim();
  if (!v) return null;
  try {
    if (/^https?:\/\//i.test(v)) v = new URL(v).pathname;
  } catch {
    return null;
  }
  v = v.split("?")[0]!.split("#")[0]!;
  if (!v.startsWith("/")) v = `/${v}`;
  v = v.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  if (v.length > WEBSITE_LIMITS.redirectPath) return null;
  if (!/^\/[A-Za-z0-9\-._~/%]*$/.test(v)) return null;
  return v.toLowerCase();
}

function normalizeRedirects(raw: unknown): WebsiteRedirect[] {
  if (!Array.isArray(raw)) return [];
  const out: WebsiteRedirect[] = [];
  for (const row of raw) {
    const r = row as { from?: unknown; to?: unknown } | null;
    const from = normalizeRedirectPath(r?.from);
    const to = normalizeRedirectPath(r?.to);
    if (!from || !to || from === "/" || from === to) continue;
    if (out.some((x) => x.from === from)) continue;
    out.push({ from, to });
    if (out.length >= WEBSITE_LIMITS.redirectsMax) break;
  }
  return out;
}

function normalizeHeroMedia(raw: unknown): WebsiteHeroMedia | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isUuidLike(r.id)) return null;
  const source = r.source === "youtube" ? "youtube" : "upload";
  const youtubeId = typeof r.youtubeId === "string" && /^[A-Za-z0-9_-]{11}$/.test(r.youtubeId) ? r.youtubeId : "";
  if (source === "youtube" && !youtubeId) return null;
  return { id: r.id, source, youtubeId };
}

function isTemplate(v: unknown): v is WebsiteTemplateId {
  return typeof v === "string" && (WEBSITE_TEMPLATES as readonly string[]).includes(v);
}

function isHeroSource(v: unknown): v is WebsiteHeroSource {
  return typeof v === "string" && (WEBSITE_HERO_SOURCES as readonly string[]).includes(v);
}

/** Auto-filled "… Client Portal" headlines and portal how-to copy are not business marketing copy. */
function isPortalBoilerplate(text: string): boolean {
  return /client portal\s*$/i.test(text.trim()) || /\b(portal|estimate|download)\b/i.test(text);
}

/**
 * True when a business meaningfully edited its classic landing page — its own copy, media, logos,
 * industries, steps, features or social links. Color tweaks, section toggles and the auto-filled
 * "{Name} Client Portal" headline don't count. Customized businesses keep the classic page live
 * until they publish the new Business Website themselves.
 */
export function legacyLandingCustomized(landing: Partial<LandingSettings> | null | undefined): boolean {
  if (!landing) return false;
  const m = mergeLandingSettings(landing);
  const d = mergeLandingSettings(null);
  const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  const h = m.hero;
  if (h.headline.trim() && !/client portal\s*$/i.test(h.headline.trim())) return true;
  if (h.subheadline.trim() || h.showreelUrl.trim() || h.heroImageUrl.trim()) return true;
  if (m.intro.businessDescription.trim() || m.footer.tagline.trim()) return true;
  if (m.industries.length || m.features.length) return true;
  if (m.howItWorks.some((step) => step.label.trim() || step.description.trim() || step.imageUrl?.trim())) return true;
  if (Object.values(m.social).some((v) => v.trim())) return true;
  const assetKeys = ["heroVideoId", "logoNavy", "logoWhite", "logoStackedWhite", "logoHeader", "logoFooter", "ownerHeadshot"] as const;
  for (const k of assetKeys) {
    if (changed((m as unknown as Record<string, unknown>)[k], (d as unknown as Record<string, unknown>)[k])) return true;
  }
  return false;
}

/** First-time defaults carried over from the classic landing page so nothing is lost. */
function seedFromLegacy(landing: LandingSettings): Partial<WebsiteSettings> {
  const hero = landing.hero;
  const seed: Partial<WebsiteSettings> = {};
  if (hero.headline.trim() && !isPortalBoilerplate(hero.headline)) seed.headline = hero.headline.trim();
  const intro = [hero.subheadline.trim(), landing.intro.businessDescription.trim()].find((t) => t && !isPortalBoilerplate(t));
  if (intro) seed.intro = intro;
  const videoUrl = hero.showreelUrl && extractYouTubeId(hero.showreelUrl) ? hero.showreelUrl : landing.heroVideoId && extractYouTubeId(landing.heroVideoId) ? `https://www.youtube.com/watch?v=${landing.heroVideoId}` : "";
  if (hero.mediaType === "image" && hero.heroImageUrl) {
    seed.heroSource = "image";
    seed.heroImageUrl = hero.heroImageUrl;
  } else if (hero.mediaType !== "none" && videoUrl && (hero.showreelUrl || landing.heroVideoId !== mergeLandingSettings(null).heroVideoId)) {
    seed.heroSource = "video";
    seed.heroVideoUrl = videoUrl;
  } else if (hero.mediaType === "" && hero.heroImageUrl) {
    seed.heroSource = "image";
    seed.heroImageUrl = hero.heroImageUrl;
  }
  if (hero.ctaPrimaryLabel.trim() && !isPortalBoilerplate(hero.ctaPrimaryLabel)) seed.ctaLabel = hero.ctaPrimaryLabel.trim();
  seed.social = {
    ...EMPTY_SOCIAL,
    instagram: landing.social.instagram,
    facebook: landing.social.facebook,
    youtube: landing.social.youtube,
    linkedin: landing.social.linkedin,
  };
  return seed;
}

export function mergeWebsiteSettings(
  stored: Partial<WebsiteSettings> | null | undefined,
  legacyLanding?: Partial<LandingSettings> | null
): WebsiteSettings {
  const landing = mergeLandingSettings(legacyLanding ?? null);
  const base: Partial<WebsiteSettings> = stored && typeof stored === "object" ? stored : seedFromLegacy(landing);
  const launched =
    typeof stored?.launched === "boolean" ? stored.launched : !legacyLandingCustomized(legacyLanding ?? null);
  const social = { ...EMPTY_SOCIAL };
  const rawSocial = (base.social ?? {}) as Partial<Record<WebsiteSocialKey, unknown>>;
  for (const key of WEBSITE_SOCIAL_KEYS) social[key] = sanitizeWebsiteSocial(key, rawSocial[key]);

  let featuredServiceIds: string[] | null = null;
  if (Array.isArray(base.featuredServiceIds)) {
    featuredServiceIds = base.featuredServiceIds.filter(isUuidLike).slice(0, 40);
  }
  const accent = typeof base.accentColor === "string" ? base.accentColor.trim() : "";

  return {
    launched,
    template: isTemplate(base.template) ? base.template : DEFAULT_WEBSITE_SETTINGS.template,
    accentColor: accent && isSafeCssColor(accent) ? accent : "",
    headline: sanitizePlainText(base.headline, WEBSITE_LIMITS.headline),
    intro: multiline(base.intro, WEBSITE_LIMITS.intro),
    heroSource: isHeroSource(base.heroSource) ? base.heroSource : "auto",
    heroImageUrl: safeAssetUrl(base.heroImageUrl),
    heroVideoUrl: safeVideoUrl(base.heroVideoUrl),
    heroImageMedia: normalizeHeroMedia(base.heroImageMedia),
    heroVideoMedia: normalizeHeroMedia(base.heroVideoMedia),
    featuredServiceIds,
    showServicePricing: base.showServicePricing !== false,
    ctaLabel: sanitizePlainText(base.ctaLabel, WEBSITE_LIMITS.ctaLabel),
    ctaHeading: sanitizePlainText(base.ctaHeading, WEBSITE_LIMITS.ctaHeading),
    ctaText: multiline(base.ctaText, WEBSITE_LIMITS.ctaText),
    contactIntro: multiline(base.contactIntro, WEBSITE_LIMITS.contactIntro),
    showAddress: base.showAddress === true,
    showClientLogin: base.showClientLogin !== false,
    social,
    seoTitle: sanitizePlainText(base.seoTitle, WEBSITE_LIMITS.seoTitle),
    seoDescription: sanitizePlainText(base.seoDescription, WEBSITE_LIMITS.seoDescription),
    redirects: normalizeRedirects(base.redirects),
  };
}

export function slugifyTitle(raw: string): string {
  const s = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "project";
}

function normalizeEntry(raw: unknown): PortfolioEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isUuidLike(r.projectId)) return null;
  const slug = typeof r.slug === "string" && SLUG_RE.test(r.slug) && r.slug.length <= 80 ? r.slug : null;
  if (!slug) return null;
  const ids = (v: unknown, max: number) =>
    Array.isArray(v) ? Array.from(new Set(v.filter(isUuidLike))).slice(0, max) : [];
  const mediaIds = ids(r.mediaIds, WEBSITE_LIMITS.portfolioMediaMax);
  const coverId = isUuidLike(r.coverId) && mediaIds.includes(r.coverId) ? r.coverId : mediaIds[0] ?? null;
  return {
    projectId: r.projectId,
    slug,
    previousSlugs: Array.isArray(r.previousSlugs)
      ? r.previousSlugs.filter((s): s is string => typeof s === "string" && SLUG_RE.test(s)).slice(0, 10)
      : [],
    title: sanitizePlainText(r.title, WEBSITE_LIMITS.portfolioTitle) || "Featured Project",
    category: sanitizePlainText(r.category, WEBSITE_LIMITS.portfolioCategory),
    description: multiline(r.description, WEBSITE_LIMITS.portfolioDescription),
    mediaIds,
    coverId,
    tourIds: ids(r.tourIds, 10),
    featured: r.featured === true,
    publishedAt: typeof r.publishedAt === "string" ? r.publishedAt : new Date(0).toISOString(),
  };
}

export function mergePortfolioSettings(stored: unknown): PortfolioSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<PortfolioSettings>;
  const entries: PortfolioEntry[] = [];
  for (const raw of Array.isArray(s.entries) ? s.entries : []) {
    const e = normalizeEntry(raw);
    if (e && !entries.some((x) => x.projectId === e.projectId || x.slug === e.slug)) entries.push(e);
  }
  return {
    entries,
    dismissedProjectIds: Array.isArray(s.dismissedProjectIds)
      ? Array.from(new Set(s.dismissedProjectIds.filter(isUuidLike))).slice(0, 500)
      : [],
  };
}

export function uniquePortfolioSlug(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugifyTitle(title);
  if (!used.has(base)) return base;
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Built-in aliases for paths common on Squarespace / WordPress / Wix sites. */
export const WEBSITE_PATH_ALIASES: Record<string, string> = {
  "/home": "/",
  "/index": "/",
  "/about": "/",
  "/about-us": "/",
  "/work": "/portfolio",
  "/gallery": "/portfolio",
  "/galleries": "/portfolio",
  "/projects": "/portfolio",
  "/our-work": "/portfolio",
  "/pricing": "/services",
  "/packages": "/services",
  "/our-services": "/services",
  "/contact-us": "/contact",
  "/book": "/request",
  "/booking": "/request",
  "/book-now": "/request",
  "/schedule": "/request",
  "/quote": "/request",
  "/get-a-quote": "/request",
};

/** Where an old-site path should go: business redirects first, then built-in aliases. */
export function resolveWebsiteRedirect(website: Pick<WebsiteSettings, "redirects">, path: string): string | null {
  const p = normalizeRedirectPath(path);
  if (!p) return null;
  const custom = website.redirects.find((r) => r.from === p);
  if (custom) return custom.to;
  return WEBSITE_PATH_ALIASES[p] ?? null;
}
