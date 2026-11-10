/**
 * Marketing Kit — shared data model (pure; safe on client and server).
 *
 * One body of marketing information per project feeds both products:
 *   - Property Website (public listing site)
 *   - Social Media Kit (square posts, stories, carousels, flyer PDF)
 *
 * Storage model: `marketing_kits.content` holds ONLY what someone changed (overrides).
 * Everything else is derived live from the project — address, approved media, hero image,
 * client/realtor branding — so drafts follow project updates automatically. Publishing
 * freezes the fully resolved content into `published_content`.
 */

export type MarketingProduct = "website" | "social";
export const MARKETING_PRODUCTS: MarketingProduct[] = ["website", "social"];
export const PRODUCT_LABEL: Record<MarketingProduct, string> = {
  website: "Property Website",
  social: "Social Media Kit",
};

export type DesignStyle = "modern" | "luxury" | "coastal";
export const DESIGN_STYLES: DesignStyle[] = ["modern", "luxury", "coastal"];
export const DESIGN_STYLE_META: Record<DesignStyle, { label: string; blurb: string }> = {
  modern: { label: "Modern", blurb: "Clean, bright and spacious" },
  luxury: { label: "Luxury", blurb: "Cinematic and refined" },
  coastal: { label: "Coastal", blurb: "Warm, airy, lifestyle-led" },
};

/** Image reference. Media = an approved project photo; upload = a marketing upload (logo/headshot). */
export type AssetRef =
  | { kind: "media"; id: string }
  | { kind: "upload"; path: string }
  | { kind: "business_logo" };

export type ListingStatus = "for_sale" | "coming_soon" | "pending" | "sold" | "for_lease";
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  for_sale: "For Sale",
  coming_soon: "Coming Soon",
  pending: "Pending",
  sold: "Sold",
  for_lease: "For Lease",
};

export type OpenHouse = { date: string; start: string; end: string; note: string };

export interface PropertyInfo {
  address: string;
  /** City, State ZIP line. */
  locality: string;
  /** Dollars. null = hide price everywhere. */
  price: number | null;
  status: ListingStatus;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: string;
  yearBuilt: number | null;
  propertyType: string;
  description: string;
  /**
   * True while the description is an automatically drafted summary nobody has reviewed.
   * Drafts are labelled in the editor and must be confirmed (or edited) before publishing.
   */
  descriptionIsDraft: boolean;
  highlights: string[];
  openHouse: OpenHouse | null;
  mlsNumber: string;
}

export interface AgentInfo {
  name: string;
  title: string;
  phone: string;
  email: string;
  website: string;
  brokerage: string;
  license: string;
  headshot: AssetRef | null;
  brokerageLogo: AssetRef | null;
}

export type BrandSource = "realtor" | "brokerage" | "business";
export const BRAND_SOURCE_LABEL: Record<BrandSource, string> = {
  realtor: "Realtor",
  brokerage: "Brokerage",
  business: "Photography business",
};

export interface Branding {
  source: BrandSource;
  primaryColor: string;
  accentColor: string;
  logo: AssetRef | null;
  /** Unbranded variant: hide agent + brokerage details (e.g. MLS-safe tours). */
  unbranded: boolean;
  /** "Photography by …" credit in the website footer and flyer. */
  photographerCredit: boolean;
}

export type GalleryPick = { mode: "auto"; excluded: string[] } | { mode: "custom"; ids: string[] };

export interface MediaPicks {
  /** null = automatic (project hero image, else best exterior). */
  heroId: string | null;
  gallery: GalleryPick;
  /** null = all approved videos. */
  videoIds: string[] | null;
  /** null = photos named like floor plans. */
  floorPlanIds: string[] | null;
}

export type WebsiteSectionKey =
  | "facts"
  | "description"
  | "highlights"
  | "gallery"
  | "video"
  | "floorplans"
  | "tour"
  | "openhouse"
  | "agent";

export const WEBSITE_SECTION_LABEL: Record<WebsiteSectionKey, string> = {
  facts: "Key facts",
  description: "Description",
  highlights: "Highlights & amenities",
  gallery: "Photo gallery",
  video: "Video",
  floorplans: "Floor plans",
  tour: "Virtual tour",
  openhouse: "Open house",
  agent: "Agent contact",
};

export const DEFAULT_SECTION_ORDER: WebsiteSectionKey[] = [
  "facts",
  "description",
  "gallery",
  "video",
  "highlights",
  "floorplans",
  "tour",
  "openhouse",
  "agent",
];

export type WebsiteSection = { key: WebsiteSectionKey; visible: boolean };

export interface WebsiteConfig {
  template: DesignStyle;
  sections: WebsiteSection[];
  /** Small "Powered by ShootPortal" credit in the footer. Missing (older kits) = on. */
  poweredBy: boolean;
}

export type SquareKey = "sq_just_listed" | "sq_open_house" | "sq_just_sold" | "sq_highlights" | "sq_coming_soon";
export type StoryKey = "st_just_listed" | "st_open_house" | "st_details";
export type SocialAssetKey = SquareKey | StoryKey | "flyer";

export type CarouselSlideKind = "cover" | "photo" | "highlights" | "agent";
export type CarouselSlide = { kind: CarouselSlideKind; mediaId: string | null; caption: string };

export type FlyerLayout = "grid" | "showcase" | "gallery";

/** Flyer photo arrangements. `photos` = supporting photos the layout shows (besides the cover). */
export const FLYER_LAYOUTS: { key: FlyerLayout; label: string; blurb: string; photos: number }[] = [
  { key: "grid", label: "Classic Grid", blurb: "Cover photo with a grid of 6", photos: 6 },
  { key: "showcase", label: "Large + Grid", blurb: "Cover, then 5 photos beside the details", photos: 5 },
  { key: "gallery", label: "Gallery", blurb: "Photo-forward with 8 photos", photos: 8 },
];
export const MAX_FLYER_PHOTOS = 8;

export interface FlyerConfig {
  layout: FlyerLayout;
  /** Supporting photos in order; null = automatic picks. */
  photoIds: string[] | null;
  showAgent: boolean;
  showHighlights: boolean;
  showDescription: boolean;
  /** QR code to the property website (only drawn while the website is published). */
  showQr: boolean;
}

export const DEFAULT_FLYER: FlyerConfig = {
  layout: "grid",
  photoIds: null,
  showAgent: true,
  showHighlights: true,
  showDescription: true,
  showQr: true,
};

export interface SocialConfig {
  style: DesignStyle;
  /** Assets the user switched off. */
  disabled: SocialAssetKey[];
  /** Featured photo per asset (mediaId); absent = automatic pick. */
  featured: Partial<Record<SocialAssetKey, string>>;
  /** Headline text per asset; absent = template default. */
  headlines: Partial<Record<SocialAssetKey, string>>;
  /** null = automatic carousel. */
  carousel: CarouselSlide[] | null;
  includeCarousel: boolean;
  flyer: FlyerConfig;
}

export interface MarketingContent {
  version: 1;
  property: PropertyInfo;
  agent: AgentInfo;
  branding: Branding;
  media: MediaPicks;
  website: WebsiteConfig;
  social: SocialConfig;
}

/** What is persisted in marketing_kits.content: only changed fields. */
export interface MarketingOverrides {
  property?: Partial<PropertyInfo>;
  agent?: Partial<AgentInfo>;
  branding?: Partial<Branding>;
  media?: Partial<MediaPicks>;
  website?: Partial<WebsiteConfig>;
  social?: Partial<SocialConfig>;
}

export type MediaIndexItem = {
  id: string;
  type: "photo" | "video";
  source: "upload" | "youtube" | "kuula" | "external";
  name: string;
  alt: string;
  width: number | null;
  height: number | null;
  /** Room/category guess from the file name — used only for automatic picks. */
  category: PhotoCategory | null;
  youtubeUrl: string | null;
  embedUrl: string | null;
};

export type PhotoCategory =
  | "exterior"
  | "aerial"
  | "twilight"
  | "living"
  | "kitchen"
  | "dining"
  | "bedroom"
  | "bathroom"
  | "office"
  | "outdoor"
  | "pool"
  | "view"
  | "floorplan";

export type TourItem = { id: string; title: string; embedUrl: string };

export const SOCIAL_ASSETS: {
  key: SocialAssetKey;
  label: string;
  format: "square" | "story" | "flyer";
  requires?: "openHouse";
}[] = [
  { key: "sq_just_listed", label: "Just Listed", format: "square" },
  { key: "sq_open_house", label: "Open House", format: "square", requires: "openHouse" },
  { key: "sq_highlights", label: "Property Highlights", format: "square" },
  { key: "sq_coming_soon", label: "Coming Soon", format: "square" },
  { key: "sq_just_sold", label: "Just Sold", format: "square" },
  { key: "st_just_listed", label: "Just Listed Story", format: "story" },
  { key: "st_open_house", label: "Open House Story", format: "story", requires: "openHouse" },
  { key: "st_details", label: "Property Details Story", format: "story" },
  { key: "flyer", label: "Property Flyer (PDF)", format: "flyer" },
];

/** Pixel sizes for exports. Flyer = US Letter at 300 dpi. */
export const FORMAT_SIZE = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  carousel: { width: 1080, height: 1350 },
  flyer: { width: 2550, height: 3300 },
} as const;

export const MAX_CAROUSEL_SLIDES = 10;

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

export function mergeContent(defaults: MarketingContent, overrides: MarketingOverrides | null | undefined): MarketingContent {
  const o = overrides ?? {};
  return {
    version: 1,
    property: { ...defaults.property, ...(o.property ?? {}) },
    agent: { ...defaults.agent, ...(o.agent ?? {}) },
    branding: { ...defaults.branding, ...(o.branding ?? {}) },
    media: { ...defaults.media, ...(o.media ?? {}) },
    website: normalizeWebsite({ ...defaults.website, ...(o.website ?? {}) }),
    social: {
      ...defaults.social,
      ...(o.social ?? {}),
      featured: { ...defaults.social.featured, ...(o.social?.featured ?? {}) },
      headlines: { ...defaults.social.headlines, ...(o.social?.headlines ?? {}) },
      flyer: { ...DEFAULT_FLYER, ...(defaults.social.flyer ?? {}), ...(o.social?.flyer ?? {}) },
    },
  };
}

/** Every known section appears exactly once (new sections get appended, visible). */
export function normalizeWebsite(w: WebsiteConfig): WebsiteConfig {
  const seen = new Set<WebsiteSectionKey>();
  const sections: WebsiteSection[] = [];
  for (const s of w.sections ?? []) {
    if (DEFAULT_SECTION_ORDER.includes(s.key) && !seen.has(s.key)) {
      seen.add(s.key);
      sections.push({ key: s.key, visible: s.visible !== false });
    }
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) sections.push({ key, visible: true });
  }
  return { template: DESIGN_STYLES.includes(w.template) ? w.template : "modern", sections, poweredBy: w.poweredBy !== false };
}

// ---------------------------------------------------------------------------
// Sanitize (server: never trust the browser's overrides)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max);
}

function num(v: unknown, min: number, max: number, decimals = 0): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const f = 10 ** decimals;
  return Math.min(max, Math.max(min, Math.round(v * f) / f));
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function uuidList(v: unknown, max = 200): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return Array.from(new Set(v.filter(isUuid))).slice(0, max);
}

/** Upload paths must live under this project's marketing folder. */
export function marketingUploadPrefix(businessId: string, projectId: string): string {
  return `${businessId}/marketing/${projectId}/`;
}

function assetRef(v: unknown, uploadPrefix: string): AssetRef | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  if (r.kind === "media" && isUuid(r.id)) return { kind: "media", id: r.id };
  if (r.kind === "business_logo") return { kind: "business_logo" };
  if (
    r.kind === "upload" &&
    typeof r.path === "string" &&
    r.path.startsWith(uploadPrefix) &&
    /^[A-Za-z0-9/_.-]+$/.test(r.path) &&
    !r.path.includes("..") &&
    r.path.length < 300
  ) {
    return { kind: "upload", path: r.path };
  }
  return undefined;
}

function assign<T extends object, K extends keyof T>(target: Partial<T>, key: K, value: T[K] | undefined) {
  if (value !== undefined) target[key] = value;
}

const SOCIAL_KEYS = new Set<string>(SOCIAL_ASSETS.map((a) => a.key));

export function sanitizeOverrides(raw: unknown, uploadPrefix: string): MarketingOverrides {
  const out: MarketingOverrides = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, Record<string, unknown> | undefined>;

  if (r.property && typeof r.property === "object") {
    const p = r.property;
    const o: Partial<PropertyInfo> = {};
    assign(o, "address", str(p.address, 160));
    assign(o, "locality", str(p.locality, 120));
    assign(o, "price", num(p.price, 0, 1_000_000_000));
    if (typeof p.status === "string" && p.status in LISTING_STATUS_LABEL) o.status = p.status as ListingStatus;
    assign(o, "beds", num(p.beds, 0, 100, 1));
    assign(o, "baths", num(p.baths, 0, 100, 2));
    assign(o, "sqft", num(p.sqft, 0, 10_000_000));
    assign(o, "lotSize", str(p.lotSize, 60));
    assign(o, "yearBuilt", num(p.yearBuilt, 1600, 2200));
    assign(o, "propertyType", str(p.propertyType, 60));
    assign(o, "description", str(p.description, 6000));
    if (typeof p.descriptionIsDraft === "boolean") o.descriptionIsDraft = p.descriptionIsDraft;
    if (Array.isArray(p.highlights)) {
      o.highlights = p.highlights
        .map((h) => str(h, 120))
        .filter((h): h is string => Boolean(h && h.trim()))
        .slice(0, 24);
    }
    if (p.openHouse === null) o.openHouse = null;
    else if (p.openHouse && typeof p.openHouse === "object") {
      const oh = p.openHouse as Record<string, unknown>;
      if (typeof oh.date === "string" && DATE_RE.test(oh.date)) {
        o.openHouse = {
          date: oh.date,
          start: typeof oh.start === "string" && TIME_RE.test(oh.start) ? oh.start : "13:00",
          end: typeof oh.end === "string" && TIME_RE.test(oh.end) ? oh.end : "15:00",
          note: str(oh.note, 120) ?? "",
        };
      }
    }
    assign(o, "mlsNumber", str(p.mlsNumber, 40));
    out.property = o;
  }

  if (r.agent && typeof r.agent === "object") {
    const a = r.agent;
    const o: Partial<AgentInfo> = {};
    assign(o, "name", str(a.name, 80));
    assign(o, "title", str(a.title, 60));
    assign(o, "phone", str(a.phone, 40));
    assign(o, "email", str(a.email, 120));
    assign(o, "website", str(a.website, 200));
    assign(o, "brokerage", str(a.brokerage, 100));
    assign(o, "license", str(a.license, 60));
    assign(o, "headshot", assetRef(a.headshot, uploadPrefix));
    assign(o, "brokerageLogo", assetRef(a.brokerageLogo, uploadPrefix));
    out.agent = o;
  }

  if (r.branding && typeof r.branding === "object") {
    const b = r.branding;
    const o: Partial<Branding> = {};
    if (b.source === "realtor" || b.source === "brokerage" || b.source === "business") o.source = b.source;
    if (typeof b.primaryColor === "string" && HEX_RE.test(b.primaryColor)) o.primaryColor = b.primaryColor;
    if (typeof b.accentColor === "string" && HEX_RE.test(b.accentColor)) o.accentColor = b.accentColor;
    assign(o, "logo", assetRef(b.logo, uploadPrefix));
    if (typeof b.unbranded === "boolean") o.unbranded = b.unbranded;
    if (typeof b.photographerCredit === "boolean") o.photographerCredit = b.photographerCredit;
    out.branding = o;
  }

  if (r.media && typeof r.media === "object") {
    const m = r.media;
    const o: Partial<MediaPicks> = {};
    if (m.heroId === null || isUuid(m.heroId)) o.heroId = m.heroId as string | null;
    if (m.gallery && typeof m.gallery === "object") {
      const g = m.gallery as Record<string, unknown>;
      if (g.mode === "auto") o.gallery = { mode: "auto", excluded: uuidList(g.excluded) ?? [] };
      else if (g.mode === "custom") o.gallery = { mode: "custom", ids: uuidList(g.ids) ?? [] };
    }
    if (m.videoIds === null) o.videoIds = null;
    else assign(o, "videoIds", uuidList(m.videoIds, 30));
    if (m.floorPlanIds === null) o.floorPlanIds = null;
    else assign(o, "floorPlanIds", uuidList(m.floorPlanIds, 20));
    out.media = o;
  }

  if (r.website && typeof r.website === "object") {
    const w = r.website;
    const o: Partial<WebsiteConfig> = {};
    if (typeof w.template === "string" && DESIGN_STYLES.includes(w.template as DesignStyle)) {
      o.template = w.template as DesignStyle;
    }
    if (Array.isArray(w.sections)) {
      o.sections = normalizeWebsite({
        template: "modern",
        poweredBy: true,
        sections: w.sections
          .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === "object"))
          .map((s) => ({ key: s.key as WebsiteSectionKey, visible: s.visible !== false })),
      }).sections;
    }
    if (typeof w.poweredBy === "boolean") o.poweredBy = w.poweredBy;
    out.website = o;
  }

  if (r.social && typeof r.social === "object") {
    const s = r.social;
    const o: Partial<SocialConfig> = {};
    if (typeof s.style === "string" && DESIGN_STYLES.includes(s.style as DesignStyle)) o.style = s.style as DesignStyle;
    if (Array.isArray(s.disabled)) {
      o.disabled = Array.from(new Set(s.disabled.filter((k): k is SocialAssetKey => typeof k === "string" && SOCIAL_KEYS.has(k))));
    }
    if (s.featured && typeof s.featured === "object") {
      const f: Partial<Record<SocialAssetKey, string>> = {};
      for (const [k, v] of Object.entries(s.featured as Record<string, unknown>)) {
        if (SOCIAL_KEYS.has(k) && isUuid(v)) f[k as SocialAssetKey] = v;
      }
      o.featured = f;
    }
    if (s.headlines && typeof s.headlines === "object") {
      const h: Partial<Record<SocialAssetKey, string>> = {};
      for (const [k, v] of Object.entries(s.headlines as Record<string, unknown>)) {
        const t = str(v, 40);
        if (SOCIAL_KEYS.has(k) && t) h[k as SocialAssetKey] = t;
      }
      o.headlines = h;
    }
    if (s.carousel === null) o.carousel = null;
    else if (Array.isArray(s.carousel)) {
      o.carousel = s.carousel
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
        .filter((x) => x.kind === "cover" || x.kind === "photo" || x.kind === "highlights" || x.kind === "agent")
        .map((x) => ({
          kind: x.kind as CarouselSlideKind,
          mediaId: isUuid(x.mediaId) ? x.mediaId : null,
          caption: str(x.caption, 40) ?? "",
        }))
        .slice(0, MAX_CAROUSEL_SLIDES);
    }
    if (typeof s.includeCarousel === "boolean") o.includeCarousel = s.includeCarousel;
    if (s.flyer && typeof s.flyer === "object") {
      const f = s.flyer as Record<string, unknown>;
      const fl: FlyerConfig = { ...DEFAULT_FLYER };
      if (FLYER_LAYOUTS.some((l) => l.key === f.layout)) fl.layout = f.layout as FlyerLayout;
      fl.photoIds = Array.isArray(f.photoIds) ? Array.from(new Set(f.photoIds.filter(isUuid))).slice(0, MAX_FLYER_PHOTOS) : null;
      for (const k of ["showAgent", "showHighlights", "showDescription", "showQr"] as const) {
        if (typeof f[k] === "boolean") fl[k] = f[k] as boolean;
      }
      o.flyer = fl;
    }
    out.social = o;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Formatting (shared by templates)
// ---------------------------------------------------------------------------

export function formatPrice(price: number | null): string | null {
  if (price == null || price <= 0) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

export function formatNumber(n: number | null): string | null {
  if (n == null || n <= 0) return null;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export function formatOpenHouse(oh: OpenHouse | null): { day: string; time: string } | null {
  if (!oh?.date) return null;
  const [y, m, d] = oh.date.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(date);
  const t = (hm: string) => {
    const [h, min] = hm.split(":").map(Number);
    const suffix = h! >= 12 ? "PM" : "AM";
    const hr = h! % 12 === 0 ? 12 : h! % 12;
    return min ? `${hr}:${String(min).padStart(2, "0")} ${suffix}` : `${hr} ${suffix}`;
  };
  return { day, time: `${t(oh.start)} – ${t(oh.end)}` };
}

/** Fact chips in display order; missing facts are skipped, never invented. */
export function propertyFacts(p: PropertyInfo): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  const beds = formatNumber(p.beds);
  const baths = formatNumber(p.baths);
  const sqft = formatNumber(p.sqft);
  if (beds) facts.push({ label: p.beds === 1 ? "Bed" : "Beds", value: beds });
  if (baths) facts.push({ label: p.baths === 1 ? "Bath" : "Baths", value: baths });
  if (sqft) facts.push({ label: "Sq Ft", value: sqft });
  if (p.lotSize.trim()) facts.push({ label: "Lot", value: p.lotSize.trim() });
  if (p.yearBuilt) facts.push({ label: "Built", value: String(p.yearBuilt) });
  return facts;
}

export function clampText(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:\s]+$/, "")}…`;
}

/** Readable text color for a background hex. */
export function onColor(hex: string): string {
  const m = HEX_RE.test(hex) ? hex : "#111827";
  const r = parseInt(m.slice(1, 3), 16);
  const g = parseInt(m.slice(3, 5), 16);
  const b = parseInt(m.slice(5, 7), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? "#111111" : "#FFFFFF";
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}
