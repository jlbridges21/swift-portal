/**
 * Client landing page content model.
 *
 * CONFIGURABLE TEMPLATE — tenants fill defined slots only. They cannot change:
 * section order, layout, fonts, spacing, component structure, the request-form
 * flow, or ShootPortal platform chrome outside these fields. Plain text only;
 * max lengths are hard limits so the design cannot break.
 */

import { extractYouTubeId } from "@/lib/youtube";
import {
  DEFAULT_LANDING_ASSETS,
  mergeLandingAssets,
  type LandingAssets,
  type LandingScreenshots,
} from "@/lib/landing-assets";

export type { LandingAssets, LandingScreenshots };

export const LANDING_LIMITS = {
  headline: 80,
  subheadline: 280,
  ctaLabel: 40,
  showreelUrl: 300,
  businessDescription: 500,
  industryItem: 40,
  industriesMax: 8,
  howItWorksLabel: 60,
  howItWorksDescription: 200,
  footerTagline: 120,
  socialUrl: 300,
} as const;

export const HOW_IT_WORKS_STEP_COUNT = 4;

export type LandingHeroContent = {
  headline: string;
  subheadline: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  /** YouTube URL or bare 11-char id. Empty → fall back to assets.heroVideoId. */
  showreelUrl: string;
};

export type LandingHowItWorksStep = {
  label: string;
  description: string;
};

export type LandingSocialLinks = {
  instagram: string;
  facebook: string;
  youtube: string;
  website: string;
  linkedin: string;
};

export type LandingSectionVisibility = {
  showreel: boolean;
  industries: boolean;
  social: boolean;
  /** Services catalog from business_services. Default true; Swift seeded false for visual parity. */
  services: boolean;
};

export type LandingContent = {
  hero: LandingHeroContent;
  intro: { businessDescription: string };
  industries: string[];
  howItWorks: LandingHowItWorksStep[];
  footer: { tagline: string };
  social: LandingSocialLinks;
  sections: LandingSectionVisibility;
};

/** Stored shape: content slots + marketing assets. */
export type LandingSettings = LandingContent & LandingAssets;

export const DEFAULT_HERO_HEADLINE = "Request. Estimate. Track. Download.";
export const DEFAULT_HERO_ACCENT = "All in one premium portal.";
export const DEFAULT_HERO_SUBHEADLINE =
  "Start a drone photo, video, or virtual tour project in minutes. Get a preliminary estimate, manage project progress, download final media, and pay securely without digging through emails.";

export const DEFAULT_CTA_PRIMARY = "Get Instant Estimate";
export const DEFAULT_CTA_SECONDARY = "Client Login";

export const DEFAULT_INDUSTRIES = [
  "real estate",
  "golf courses",
  "construction",
  "land",
  "commercial properties",
] as const;

export const DEFAULT_HOW_IT_WORKS: LandingHowItWorksStep[] = [
  {
    label: "Request your shoot",
    description: "Submit your property details, service type, and preferred timing in minutes.",
  },
  {
    label: "See a preliminary estimate",
    description: "Get a fast ballpark estimate before final details are confirmed.",
  },
  {
    label: "Track your project",
    description: "Follow scheduling, shoot progress, and deliverables in one organized dashboard.",
  },
  {
    label: "Pay and download",
    description: "Preview deliverables, complete secure payment, and access final media.",
  },
];

const EMPTY_SOCIAL: LandingSocialLinks = {
  instagram: "",
  facebook: "",
  youtube: "",
  website: "",
  linkedin: "",
};

const DEFAULT_SECTIONS: LandingSectionVisibility = {
  showreel: true,
  industries: true,
  social: true,
  services: true,
};

/** Empty stored content — render-time defaults fill gaps (never persisted). */
export const EMPTY_LANDING_CONTENT: LandingContent = {
  hero: {
    headline: "",
    subheadline: "",
    ctaPrimaryLabel: "",
    ctaSecondaryLabel: "",
    showreelUrl: "",
  },
  intro: { businessDescription: "" },
  industries: [],
  howItWorks: [
    { label: "", description: "" },
    { label: "", description: "" },
    { label: "", description: "" },
    { label: "", description: "" },
  ],
  footer: { tagline: "" },
  social: { ...EMPTY_SOCIAL },
  sections: { ...DEFAULT_SECTIONS },
};

const SOCIAL_HOSTS: Record<keyof LandingSocialLinks, readonly string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com", "m.facebook.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
  website: [], // any https host except dangerous schemes
};

/** Strip tags / control chars; plain text only. */
export function sanitizePlainText(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  const stripped = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen);
}

function sanitizeMultiline(raw: unknown, maxLen: number): string {
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

/**
 * Validate social / website URLs. Rejects javascript:, data:, non-http(s),
 * and hosts outside the allowlist (except website → any https host).
 */
export function sanitizeSocialUrl(
  kind: keyof LandingSocialLinks,
  raw: unknown
): string {
  const text = sanitizePlainText(raw, LANDING_LIMITS.socialUrl);
  if (!text) return "";
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return "";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
  if (parsed.username || parsed.password) return "";
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return "";
  const allowed = SOCIAL_HOSTS[kind];
  if (allowed.length > 0 && !allowed.includes(host)) return "";
  // Prefer https
  parsed.protocol = "https:";
  return parsed.toString();
}

function normalizeHowItWorks(raw: unknown): LandingHowItWorksStep[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: LandingHowItWorksStep[] = [];
  for (let i = 0; i < HOW_IT_WORKS_STEP_COUNT; i += 1) {
    const row = rows[i] as { label?: unknown; description?: unknown } | undefined;
    out.push({
      label: sanitizePlainText(row?.label, LANDING_LIMITS.howItWorksLabel),
      description: sanitizePlainText(row?.description, LANDING_LIMITS.howItWorksDescription),
    });
  }
  return out;
}

function normalizeIndustries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = sanitizePlainText(item, LANDING_LIMITS.industryItem);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= LANDING_LIMITS.industriesMax) break;
  }
  return out;
}

function normalizeSections(raw: unknown): LandingSectionVisibility {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    showreel: r.showreel !== false,
    industries: r.industries !== false,
    social: r.social !== false,
    services: r.services !== false,
  };
}

export function mergeLandingContent(stored?: Partial<LandingContent> | null): LandingContent {
  const s = stored ?? {};
  const hero = (s.hero && typeof s.hero === "object" ? s.hero : {}) as Partial<LandingHeroContent>;
  const intro = (s.intro && typeof s.intro === "object" ? s.intro : {}) as {
    businessDescription?: unknown;
  };
  const footer = (s.footer && typeof s.footer === "object" ? s.footer : {}) as {
    tagline?: unknown;
  };
  const social = (s.social && typeof s.social === "object" ? s.social : {}) as Partial<LandingSocialLinks>;

  return {
    hero: {
      headline: sanitizePlainText(hero.headline, LANDING_LIMITS.headline),
      subheadline: sanitizeMultiline(hero.subheadline, LANDING_LIMITS.subheadline),
      ctaPrimaryLabel: sanitizePlainText(hero.ctaPrimaryLabel, LANDING_LIMITS.ctaLabel),
      ctaSecondaryLabel: sanitizePlainText(hero.ctaSecondaryLabel, LANDING_LIMITS.ctaLabel),
      showreelUrl: sanitizePlainText(hero.showreelUrl, LANDING_LIMITS.showreelUrl),
    },
    intro: {
      businessDescription: sanitizeMultiline(
        intro.businessDescription,
        LANDING_LIMITS.businessDescription
      ),
    },
    industries: normalizeIndustries(s.industries),
    howItWorks: normalizeHowItWorks(s.howItWorks),
    footer: {
      tagline: sanitizePlainText(footer.tagline, LANDING_LIMITS.footerTagline),
    },
    social: {
      instagram: sanitizeSocialUrl("instagram", social.instagram),
      facebook: sanitizeSocialUrl("facebook", social.facebook),
      youtube: sanitizeSocialUrl("youtube", social.youtube),
      website: sanitizeSocialUrl("website", social.website),
      linkedin: sanitizeSocialUrl("linkedin", social.linkedin),
    },
    sections: normalizeSections(s.sections),
  };
}

export function mergeLandingSettings(stored?: Partial<LandingSettings> | null): LandingSettings {
  const assets = mergeLandingAssets(stored);
  const content = mergeLandingContent(stored);
  // Prefer persisted showreel URL; keep heroVideoId in sync for legacy readers.
  const videoId =
    extractYouTubeId(content.hero.showreelUrl) ||
    (assets.heroVideoId ? extractYouTubeId(assets.heroVideoId) : null);
  if (content.hero.showreelUrl && !extractYouTubeId(content.hero.showreelUrl)) {
    // Reject non-YouTube showreel URLs (open-redirect / junk).
    content.hero.showreelUrl = "";
  }
  if (videoId && content.hero.showreelUrl) {
    assets.heroVideoId = videoId;
  } else if (videoId && !content.hero.showreelUrl) {
    assets.heroVideoId = videoId;
    content.hero.showreelUrl = `https://www.youtube.com/watch?v=${videoId}`;
  } else {
    assets.heroVideoId = "";
  }

  return { ...assets, ...content };
}

/** Fields that require custom_branding to change (content + landing assets). */
export function landingFieldsChanged(
  before: LandingSettings | null | undefined,
  after: LandingSettings | null | undefined
): boolean {
  const a = mergeLandingSettings(before);
  const b = mergeLandingSettings(after);
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function defaultHeadlineForBusiness(businessName: string): string {
  const name = businessName.trim() || "Your";
  return sanitizePlainText(`${name} Client Portal`, LANDING_LIMITS.headline);
}

export function defaultBusinessDescription(
  businessName: string,
  serviceNames: string[]
): string {
  const name = businessName.trim() || "Our team";
  const services =
    serviceNames.length > 0
      ? serviceNames.slice(0, 4).join(", ")
      : "aerial photography, videography, and virtual tours";
  return sanitizeMultiline(
    `${name} delivers ${services} through a secure client portal — request a shoot, review estimates, track progress, and download final media in one place.`,
    LANDING_LIMITS.businessDescription
  );
}

const INDUSTRY_HINTS: { match: RegExp; label: string }[] = [
  { match: /real\s*estate|listing|mls|property/i, label: "real estate" },
  { match: /golf/i, label: "golf courses" },
  { match: /construction|progress|builder|develop/i, label: "construction" },
  { match: /\bland\b|acreage|parcel/i, label: "land" },
  { match: /commercial|industrial|warehouse/i, label: "commercial properties" },
  { match: /360|tour|virtual/i, label: "virtual tours" },
  { match: /video|cinema|film/i, label: "video marketing" },
  { match: /photo|image|still/i, label: "aerial photography" },
];

export function deriveIndustries(input: {
  serviceNames: string[];
  propertyTypes: string[];
}): string[] {
  const haystack = [...input.serviceNames, ...input.propertyTypes].join(" | ");
  const found: string[] = [];
  for (const hint of INDUSTRY_HINTS) {
    if (hint.match.test(haystack) && !found.includes(hint.label)) {
      found.push(hint.label);
    }
    if (found.length >= LANDING_LIMITS.industriesMax) break;
  }
  if (found.length === 0) return [...DEFAULT_INDUSTRIES];
  return found;
}

export function resolveShowreelVideoId(landing: LandingSettings): string | null {
  const fromUrl = landing.hero.showreelUrl
    ? extractYouTubeId(landing.hero.showreelUrl)
    : null;
  if (fromUrl) return fromUrl;
  const legacy = landing.heroVideoId?.trim();
  if (legacy && extractYouTubeId(legacy)) return extractYouTubeId(legacy);
  return null;
}

export type LandingServiceCard = {
  name: string;
  startingLabel: string;
  description: string;
};

export type ResolvedLandingPage = {
  businessName: string;
  portalName: string;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  subheadline: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  businessDescription: string;
  /** Non-null only when the tenant saved a custom intro paragraph. */
  customBusinessDescription: string | null;
  industries: string[];
  howItWorks: LandingHowItWorksStep[];
  footerTagline: string;
  social: LandingSocialLinks;
  showShowreel: boolean;
  showIndustries: boolean;
  showSocial: boolean;
  showServices: boolean;
  showreelVideoId: string | null;
  services: LandingServiceCard[];
  assets: LandingAssets;
};

export function resolveLandingPage(input: {
  landing: LandingSettings;
  businessName: string;
  portalName: string;
  serviceNames: string[];
  services: LandingServiceCard[];
  propertyTypes?: string[];
}): ResolvedLandingPage {
  const { landing, businessName, portalName } = input;
  const name = businessName.trim() || portalName.trim() || "Studio";

  const headline =
    landing.hero.headline ||
    defaultHeadlineForBusiness(name);
  // Keep the locked accent line for the classic Swift headline; otherwise omit
  // so "{Name} Client Portal" is not paired with a redundant second title.
  const headlineAccent =
    headline === DEFAULT_HERO_HEADLINE ? DEFAULT_HERO_ACCENT : "";
  const defaultHeadline = defaultHeadlineForBusiness(name);
  // Avoid repeating "X Client Portal" as both eyebrow and H1.
  const showEyebrow = headline !== defaultHeadline;

  const subheadline = landing.hero.subheadline || DEFAULT_HERO_SUBHEADLINE;
  const ctaPrimaryLabel = landing.hero.ctaPrimaryLabel || DEFAULT_CTA_PRIMARY;
  const ctaSecondaryLabel = landing.hero.ctaSecondaryLabel || DEFAULT_CTA_SECONDARY;

  const customBusinessDescription = landing.intro.businessDescription || null;
  const businessDescription =
    customBusinessDescription || defaultBusinessDescription(name, input.serviceNames);

  const industries =
    landing.industries.length > 0
      ? landing.industries
      : deriveIndustries({
          serviceNames: input.serviceNames,
          propertyTypes: input.propertyTypes ?? [],
        });

  const howItWorks = landing.howItWorks.map((step, i) => ({
    label: step.label || DEFAULT_HOW_IT_WORKS[i]?.label || `Step ${i + 1}`,
    description: step.description || DEFAULT_HOW_IT_WORKS[i]?.description || "",
  }));

  const showreelVideoId = resolveShowreelVideoId(landing);
  const social = landing.social;
  const hasSocial = Object.values(social).some((v) => Boolean(v));

  return {
    businessName: name,
    portalName: portalName.trim() || name,
    eyebrow: showEyebrow ? `${name} Client Portal` : "",
    headline,
    headlineAccent,
    subheadline,
    ctaPrimaryLabel,
    ctaSecondaryLabel,
    businessDescription,
    customBusinessDescription,
    industries,
    howItWorks,
    footerTagline: landing.footer.tagline,
    social,
    showShowreel: landing.sections.showreel && Boolean(showreelVideoId),
    showIndustries: landing.sections.industries && industries.length > 0,
    showSocial: landing.sections.social && hasSocial,
    showServices: landing.sections.services && input.services.length > 0,
    showreelVideoId,
    services: input.services,
    assets: {
      heroVideoId: landing.heroVideoId,
      logoNavy: landing.logoNavy,
      logoWhite: landing.logoWhite,
      logoStackedWhite: landing.logoStackedWhite,
      logoHeader: landing.logoHeader,
      logoFooter: landing.logoFooter,
      favicon: landing.favicon,
      ownerHeadshot: landing.ownerHeadshot,
      luxuryHome: landing.luxuryHome,
      golfCourse: landing.golfCourse,
      construction: landing.construction,
      screenshots: { ...landing.screenshots },
    },
  };
}

/** Derived defaults for editor placeholders (not written until user saves). */
export function landingContentPlaceholders(businessName: string, serviceNames: string[]) {
  return {
    headline: defaultHeadlineForBusiness(businessName),
    subheadline: DEFAULT_HERO_SUBHEADLINE,
    ctaPrimaryLabel: DEFAULT_CTA_PRIMARY,
    ctaSecondaryLabel: DEFAULT_CTA_SECONDARY,
    businessDescription: defaultBusinessDescription(businessName, serviceNames),
    industries: [...DEFAULT_INDUSTRIES],
    howItWorks: DEFAULT_HOW_IT_WORKS.map((s) => ({ ...s })),
    footerTagline: "",
  };
}
