/**
 * Business Website view model (client-safe).
 *
 * One pure function turns settings + business info + services + the (already public-safe)
 * portfolio into everything the templates render. The public pages and the live preview in
 * Settings → Business Website both call it, so the preview is exactly what visitors see.
 */

import { contrastRatio, sanitizeCssColor } from "@/lib/brand-color";
import { extractYouTubeId } from "@/lib/youtube";
import {
  DEFAULT_WEBSITE_CTA_LABEL,
  WEBSITE_LIMITS,
  WEBSITE_SOCIAL_KEYS,
  WEBSITE_SOCIAL_LABELS,
  type WebsiteSettings,
  type WebsiteSocialKey,
  type WebsiteTemplateId,
} from "@/lib/website/settings";

export type SiteImage = {
  id: string;
  /** ~2400px — hero / lightbox. */
  url: string;
  /** ~1600px — cards and galleries. */
  mediumUrl: string;
  /** ~480px — thumbnails. */
  thumbUrl: string;
  width: number | null;
  height: number | null;
  alt: string;
};

export type SiteVideo = {
  id: string;
  title: string;
  kind: "file" | "youtube";
  /** file: playback route. youtube: embed URL. */
  src: string;
  posterUrl: string | null;
};

export type SiteTour = { id: string; title: string; embedUrl: string };

/** One approved portfolio project with public-safe media (built server-side). */
export type SitePortfolioProject = {
  projectId: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  featured: boolean;
  publishedAt: string;
  cover: SiteImage | null;
  photos: SiteImage[];
  videos: SiteVideo[];
  tours: SiteTour[];
};

export type SiteService = {
  id: string;
  name: string;
  description: string;
  priceLabel: string | null;
  includes: string[];
};

export type SiteServiceInput = {
  id: string;
  name: string;
  description: string | null;
  startingLabel: string | null;
  priceCents: number | null;
  hidePricing: boolean;
  includes: string[];
};

export type SiteBusinessInput = {
  name: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  email: string;
  phone: string;
  websiteUrl: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  legalName: string;
  termsUrl: string;
  privacyUrl: string;
};

export type SiteLinks = {
  /** Client portal sign-in (absolute on a Business Website domain, else "/login"). */
  clientLogin: string;
  /** Project request workflow ("/request"). */
  request: string;
};

export type SiteHeroMedia =
  | { kind: "image"; url: string; alt: string }
  | { kind: "video"; youtubeId: string; posterUrl: string }
  | { kind: "design" };

export type SiteView = {
  template: WebsiteTemplateId;
  colors: { primary: string; accent: string; onAccent: string };
  business: {
    name: string;
    tagline: string;
    logoUrl: string;
    email: string;
    phone: string;
    phoneHref: string;
    websiteUrl: string;
    websiteLabel: string;
    addressLines: string[];
    legalName: string;
    termsUrl: string;
    privacyUrl: string;
    social: { key: WebsiteSocialKey; label: string; url: string }[];
  };
  hero: { eyebrow: string; headline: string; intro: string; media: SiteHeroMedia };
  services: SiteService[];
  allServices: SiteService[];
  portfolio: SitePortfolioProject[];
  featured: SitePortfolioProject[];
  cta: { label: string; heading: string; text: string };
  contactIntro: string;
  links: SiteLinks & { showClientLogin: boolean };
  nav: { key: SitePageKey; label: string; href: string }[];
};

export type SitePageKey = "home" | "portfolio" | "services" | "contact";

type Niche = "realestate" | "aerial" | "wedding" | "portrait" | "commercial" | "video" | "general";

function detectNiche(serviceNames: string[], tagline: string): Niche {
  const hay = `${serviceNames.join(" ")} ${tagline}`.toLowerCase();
  if (/real\s*estate|listing|property|floor\s*plan|mls|matterport|twilight/.test(hay)) return "realestate";
  if (/wedding|elopement|bridal|engagement/.test(hay)) return "wedding";
  if (/drone|aerial|fpv|uav/.test(hay)) return "aerial";
  if (/portrait|headshot|family|senior|newborn|maternity/.test(hay)) return "portrait";
  if (/commercial|product|brand|corporate|architect|interior|construction/.test(hay)) return "commercial";
  if (/video|film|cinema|reel/.test(hay)) return "video";
  return "general";
}

const NICHE_COPY: Record<Niche, { headline: string; ctaHeading: string }> = {
  realestate: {
    headline: "Real estate photography & video that make every listing stand out",
    ctaHeading: "Ready to showcase your next property?",
  },
  aerial: {
    headline: "Aerial photography & video from a whole new perspective",
    ctaHeading: "Let’s plan your next flight.",
  },
  wedding: { headline: "Your day, beautifully told", ctaHeading: "Let’s talk about your day." },
  portrait: { headline: "Portraits with personality", ctaHeading: "Book your session." },
  commercial: {
    headline: "Commercial photography for brands that care how they look",
    ctaHeading: "Let’s create something great.",
  },
  video: { headline: "Video that moves people", ctaHeading: "Let’s make your next video." },
  general: { headline: "", ctaHeading: "Let’s create something great." },
};

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function defaultWebsiteHeadline(businessName: string, serviceNames: string[], tagline = ""): string {
  const niche = detectNiche(serviceNames, tagline);
  const copy = NICHE_COPY[niche].headline;
  if (copy) return copy;
  const name = businessName.trim();
  return name ? `Photography & video by ${name}` : "Professional photography & video";
}

export function defaultWebsiteIntro(businessName: string, serviceNames: string[]): string {
  const name = businessName.trim() || "We";
  const svc = serviceNames.slice(0, 3).map((s) => s.trim()).filter(Boolean);
  const offer = svc.length ? `${name} offers ${listJoin(svc).toLowerCase()}.` : `${name} creates professional photography and video.`;
  return `${offer} Tell us about your project and we’ll take it from there.`.slice(0, WEBSITE_LIMITS.intro);
}

export function defaultCtaHeading(serviceNames: string[], tagline = ""): string {
  return NICHE_COPY[detectNiche(serviceNames, tagline)].ctaHeading;
}

function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toLocaleString("en-US")}` : `$${dollars.toFixed(2)}`;
}

function serviceView(s: SiteServiceInput, showPricing: boolean): SiteService {
  let priceLabel: string | null = null;
  if (showPricing && !s.hidePricing) {
    const label = (s.startingLabel ?? "").trim();
    if (label) priceLabel = label;
    else if (s.priceCents && s.priceCents > 0) priceLabel = `Starting at ${formatPrice(s.priceCents)}`;
  }
  return {
    id: s.id,
    name: s.name.trim(),
    description: (s.description ?? "").trim(),
    priceLabel,
    includes: (s.includes ?? []).map((i) => i.trim()).filter(Boolean).slice(0, 4),
  };
}

function hexToRgb(color: string): [number, number, number] | null {
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function readableOn(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return "#ffffff";
  return contrastRatio(rgb, [255, 255, 255]) >= contrastRatio(rgb, [17, 17, 17]) ? "#ffffff" : "#111111";
}

function phoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : "";
}

function websiteLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function buildSiteView(input: {
  website: WebsiteSettings;
  business: SiteBusinessInput;
  services: SiteServiceInput[];
  portfolio: SitePortfolioProject[];
  links: SiteLinks;
}): SiteView {
  const { website, business } = input;
  const name = business.name.trim() || "Studio";
  const serviceNames = input.services.map((s) => s.name);

  const allServices = input.services.filter((s) => s.name.trim()).map((s) => serviceView(s, website.showServicePricing));
  let services = allServices;
  if (website.featuredServiceIds) {
    const byId = new Map(allServices.map((s) => [s.id, s]));
    services = website.featuredServiceIds.map((id) => byId.get(id)).filter((s): s is SiteService => Boolean(s));
  }
  services = services.slice(0, WEBSITE_LIMITS.featuredServicesMax);

  const portfolio = [...input.portfolio].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug);
  });
  const featuredOnly = portfolio.filter((p) => p.featured);
  const featured = (featuredOnly.length ? featuredOnly : portfolio).slice(0, 6);

  let media: SiteHeroMedia = { kind: "design" };
  const autoCover = featured.find((p) => p.cover)?.cover ?? null;
  const videoId = website.heroVideoUrl ? extractYouTubeId(website.heroVideoUrl) : null;
  if (website.heroSource === "image" && website.heroImageUrl) {
    media = { kind: "image", url: website.heroImageUrl, alt: `${name} photography` };
  } else if (website.heroSource === "video" && videoId) {
    media = { kind: "video", youtubeId: videoId, posterUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` };
  } else if ((website.heroSource === "auto" || website.heroSource === "image") && autoCover) {
    media = { kind: "image", url: autoCover.url, alt: autoCover.alt || `${name} portfolio` };
  }

  const accent = sanitizeCssColor(website.accentColor || business.accentColor, "#C8A15A");
  const primary = sanitizeCssColor(business.primaryColor, "#111827");

  const social = WEBSITE_SOCIAL_KEYS.filter((k) => website.social[k]).map((k) => ({
    key: k,
    label: WEBSITE_SOCIAL_LABELS[k],
    url: website.social[k],
  }));

  const city = [business.city.trim(), [business.state.trim(), business.postalCode.trim()].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const addressLines = website.showAddress
    ? [business.addressLine1.trim(), business.addressLine2.trim(), city].filter(Boolean)
    : [];

  const nav: SiteView["nav"] = [{ key: "home", label: "Home", href: "/" }];
  if (portfolio.length) nav.push({ key: "portfolio", label: "Portfolio", href: "/portfolio" });
  if (allServices.length) nav.push({ key: "services", label: "Services", href: "/services" });
  nav.push({ key: "contact", label: "Contact", href: "/contact" });

  const site = (business.websiteUrl || "").trim();

  return {
    template: website.template,
    colors: { primary, accent, onAccent: readableOn(accent) },
    business: {
      name,
      tagline: business.tagline.trim(),
      logoUrl: business.logoUrl.trim(),
      email: business.email.trim(),
      phone: business.phone.trim(),
      phoneHref: phoneHref(business.phone),
      websiteUrl: /^https:\/\//.test(site) ? site : "",
      websiteLabel: /^https:\/\//.test(site) ? websiteLabel(site) : "",
      addressLines,
      legalName: business.legalName.trim() || name,
      termsUrl: business.termsUrl.trim(),
      privacyUrl: business.privacyUrl.trim(),
      social,
    },
    hero: {
      eyebrow: business.tagline.trim() || name,
      headline: website.headline || defaultWebsiteHeadline(name, serviceNames, business.tagline),
      intro: website.intro || defaultWebsiteIntro(name, serviceNames),
      media,
    },
    services,
    allServices,
    portfolio,
    featured,
    cta: {
      label: website.ctaLabel || DEFAULT_WEBSITE_CTA_LABEL,
      heading: website.ctaHeading || defaultCtaHeading(serviceNames, business.tagline),
      text: website.ctaText || "Tell us a little about your project — it only takes a minute.",
    },
    contactIntro:
      website.contactIntro ||
      `Have a project in mind? Send us the details below and ${name} will get back to you shortly.`,
    links: { ...input.links, showClientLogin: website.showClientLogin },
    nav,
  };
}
