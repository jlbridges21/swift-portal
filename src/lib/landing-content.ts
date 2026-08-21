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
  /** Horizontal step carousel holds 3–6 without breaking layout. */
  howItWorksMin: 3,
  howItWorksMax: 6,
  featureTitle: 40,
  featureDescription: 120,
  /** Fixed range so the feature grid cannot break (3–8). */
  featuresMin: 3,
  featuresMax: 8,
  footerTagline: 120,
  socialUrl: 300,
} as const;

/** @deprecated Use LANDING_LIMITS.howItWorksMin/Max — defaults remain 4 steps. */
export const HOW_IT_WORKS_STEP_COUNT = 4;
export const HOW_IT_WORKS_DEFAULT_COUNT = 4;

/**
 * Curated lucide-react icons for photography / media businesses.
 * API rejects anything outside this set — no arbitrary icon strings/URLs.
 */
export const LANDING_FEATURE_ICON_IDS = [
  // Core portal / workflow (defaults)
  "MessageSquare",
  "FileDown",
  "Calendar",
  "Camera",
  "Video",
  "Globe",
  "CreditCard",
  "CheckCircle2",
  // Place & people
  "Home",
  "Map",
  "Users",
  "Building2",
  // Time & delivery
  "Clock",
  "Send",
  // Media / production
  "Image",
  "ImagePlus",
  "Aperture",
  "Film",
  "Clapperboard",
  "Sun",
] as const;

export type LandingFeatureIconId = (typeof LANDING_FEATURE_ICON_IDS)[number];

export function isLandingFeatureIconId(value: unknown): value is LandingFeatureIconId {
  return (
    typeof value === "string" &&
    (LANDING_FEATURE_ICON_IDS as readonly string[]).includes(value)
  );
}

export class InvalidLandingHowItWorksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLandingHowItWorksError";
  }
}

/** Strict count check for API saves — rejects 2 or 7 etc. */
export function assertHowItWorksCount(raw: unknown): void {
  if (!Array.isArray(raw)) {
    throw new InvalidLandingHowItWorksError("howItWorks must be an array");
  }
  const n = raw.length;
  if (n < LANDING_LIMITS.howItWorksMin || n > LANDING_LIMITS.howItWorksMax) {
    throw new InvalidLandingHowItWorksError(
      `howItWorks must have ${LANDING_LIMITS.howItWorksMin}–${LANDING_LIMITS.howItWorksMax} steps (got ${n})`
    );
  }
}

export type LandingFeatureCard = {
  icon: LandingFeatureIconId;
  title: string;
  description: string;
};

/** Current hardcoded cards — defaults so untouched tenants (incl. Swift) stay identical. */
export const DEFAULT_FEATURE_CARDS: LandingFeatureCard[] = [
  {
    icon: "MessageSquare",
    title: "Project requests",
    description: "Submit new shoots without email back-and-forth.",
  },
  {
    icon: "FileDown",
    title: "Instant estimates",
    description: "See preliminary pricing before the project is confirmed.",
  },
  {
    icon: "Calendar",
    title: "Scheduling",
    description: "Coordinate shoot dates with a clear workflow.",
  },
  {
    icon: "Camera",
    title: "Photo delivery",
    description: "Access polished photo galleries after delivery.",
  },
  {
    icon: "Video",
    title: "Video previews",
    description: "Review aerial videos directly inside your project.",
  },
  {
    icon: "Globe",
    title: "360° tours",
    description: "Access virtual tours and links in one place.",
  },
  {
    icon: "CreditCard",
    title: "Secure payments",
    description: "Pay invoices through Stripe with instant confirmation.",
  },
  {
    icon: "CheckCircle2",
    title: "Project history",
    description: "Keep every project, update, and deliverable organized.",
  },
];

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
  /** Empty → render DEFAULT_FEATURE_CARDS. Non-empty must be 3–8 cards. */
  features: LandingFeatureCard[];
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
  features: [],
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
  // Missing / empty → four blank steps (resolve fills DEFAULT_HOW_IT_WORKS).
  if (!Array.isArray(raw) || raw.length === 0) {
    return Array.from({ length: HOW_IT_WORKS_DEFAULT_COUNT }, () => ({
      label: "",
      description: "",
    }));
  }

  const out: LandingHowItWorksStep[] = [];
  for (const row of raw) {
    const r = row as { label?: unknown; description?: unknown } | null;
    out.push({
      label: sanitizePlainText(r?.label, LANDING_LIMITS.howItWorksLabel),
      description: sanitizePlainText(r?.description, LANDING_LIMITS.howItWorksDescription),
    });
    if (out.length >= LANDING_LIMITS.howItWorksMax) break;
  }

  // Corrupt stored data: pad to min so the public page never breaks.
  while (out.length < LANDING_LIMITS.howItWorksMin) {
    out.push({ label: "", description: "" });
  }

  return out;
}

function normalizeFeatureCard(raw: unknown): LandingFeatureCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const iconRaw = row.icon;
  const icon: LandingFeatureIconId = isLandingFeatureIconId(iconRaw)
    ? iconRaw
    : "CheckCircle2";
  const title = sanitizePlainText(row.title, LANDING_LIMITS.featureTitle);
  const description = sanitizePlainText(row.description, LANDING_LIMITS.featureDescription);
  if (!title && !description) return null;
  return {
    icon,
    title: title || "Feature",
    description: description || "",
  };
}

/**
 * Empty / missing → [] (resolve uses DEFAULT_FEATURE_CARDS).
 * Non-empty → clamp to 3–8; invalid icons coerced to CheckCircle2.
 */
function normalizeFeatures(raw: unknown): LandingFeatureCard[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: LandingFeatureCard[] = [];
  for (const item of raw) {
    const card = normalizeFeatureCard(item);
    if (card) out.push(card);
    if (out.length >= LANDING_LIMITS.featuresMax) break;
  }
  if (out.length === 0) return [];
  if (out.length < LANDING_LIMITS.featuresMin) {
    // Pad with defaults so a partial save cannot break the grid.
    for (const d of DEFAULT_FEATURE_CARDS) {
      if (out.length >= LANDING_LIMITS.featuresMin) break;
      if (!out.some((c) => c.title === d.title)) out.push({ ...d });
    }
  }
  return out.slice(0, LANDING_LIMITS.featuresMax);
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
    features: normalizeFeatures(s.features),
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
  features: LandingFeatureCard[];
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

  const features =
    landing.features.length >= LANDING_LIMITS.featuresMin
      ? landing.features
      : DEFAULT_FEATURE_CARDS.map((c) => ({ ...c }));

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
    features,
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
    features: DEFAULT_FEATURE_CARDS.map((c) => ({ ...c })),
    footerTagline: "",
  };
}
