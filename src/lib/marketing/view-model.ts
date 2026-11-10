/**
 * Marketing Kit — view model shared by every renderer (pure).
 *
 * The same ListingView feeds the live website preview, the public website, the live social
 * previews and the server-side exports. Only the URL resolver differs per context (signed
 * preview URLs, the public image route, or high-resolution export URLs).
 */
import { pickAutoHero } from "@/lib/marketing/defaults";
import {
  DEFAULT_FLYER,
  FLYER_LAYOUTS,
  MAX_CAROUSEL_SLIDES,
  SOCIAL_ASSETS,
  formatOpenHouse,
  formatPrice,
  onColor,
  propertyFacts,
  type AgentInfo,
  type AssetRef,
  type CarouselSlide,
  type FlyerConfig,
  type MarketingContent,
  type MediaIndexItem,
  type PhotoCategory,
  type PropertyInfo,
  type SocialAssetKey,
  type TourItem,
  type WebsiteSection,
} from "@/lib/marketing/model";

export type ImageSize = "thumb" | "medium" | "large";

export interface UrlResolver {
  image(ref: AssetRef, size: ImageSize): string | null;
  /** Playback URL for an uploaded video (null when unavailable in this context). */
  video(id: string): string | null;
  /** Poster image for a video. */
  poster(id: string): string | null;
}

export type ViewImage = { id: string; url: string; thumbUrl: string; alt: string; width: number | null; height: number | null };
export type ViewVideo = {
  id: string;
  title: string;
  kind: "upload" | "youtube";
  src: string | null;
  embedUrl: string | null;
  posterUrl: string | null;
};

export interface ListingView {
  template: MarketingContent["website"]["template"];
  property: PropertyInfo;
  priceText: string | null;
  facts: { label: string; value: string }[];
  openHouse: { day: string; time: string; note: string } | null;
  agent: AgentInfo & { headshotUrl: string | null; brokerageLogoUrl: string | null };
  showAgent: boolean;
  branding: {
    primary: string;
    accent: string;
    onPrimary: string;
    onAccent: string;
    logoUrl: string | null;
    source: MarketingContent["branding"]["source"];
  };
  hero: ViewImage | null;
  gallery: ViewImage[];
  videos: ViewVideo[];
  floorPlans: ViewImage[];
  tours: TourItem[];
  sections: WebsiteSection[];
  businessName: string;
  photographerCredit: boolean;
}

function image(m: MediaIndexItem, urls: UrlResolver, size: ImageSize): ViewImage | null {
  const url = urls.image({ kind: "media", id: m.id }, size);
  if (!url) return null;
  return {
    id: m.id,
    url,
    thumbUrl: urls.image({ kind: "media", id: m.id }, "thumb") ?? url,
    alt: m.alt || m.name,
    width: m.width,
    height: m.height,
  };
}

export function resolveHeroId(content: MarketingContent, media: MediaIndexItem[], coverId: string | null): string | null {
  const photos = media.filter((m) => m.type === "photo");
  if (content.media.heroId && photos.some((p) => p.id === content.media.heroId)) return content.media.heroId;
  return pickAutoHero(media, coverId);
}

export function resolveFloorPlanIds(content: MarketingContent, media: MediaIndexItem[]): string[] {
  const photos = media.filter((m) => m.type === "photo");
  if (content.media.floorPlanIds) {
    const ok = new Set(photos.map((p) => p.id));
    return content.media.floorPlanIds.filter((id) => ok.has(id));
  }
  return photos.filter((p) => p.category === "floorplan").map((p) => p.id);
}

export function resolveGalleryIds(content: MarketingContent, media: MediaIndexItem[]): string[] {
  const photos = media.filter((m) => m.type === "photo");
  const floor = new Set(resolveFloorPlanIds(content, media));
  if (content.media.gallery.mode === "custom") {
    const ok = new Set(photos.map((p) => p.id));
    return content.media.gallery.ids.filter((id) => ok.has(id));
  }
  const excluded = new Set(content.media.gallery.excluded);
  return photos.filter((p) => !excluded.has(p.id) && !floor.has(p.id)).map((p) => p.id);
}

export function resolveVideoIds(content: MarketingContent, media: MediaIndexItem[]): string[] {
  const videos = media.filter((m) => m.type === "video");
  if (content.media.videoIds) {
    const ok = new Set(videos.map((v) => v.id));
    return content.media.videoIds.filter((id) => ok.has(id));
  }
  return videos.map((v) => v.id);
}

export function buildListingView(args: {
  content: MarketingContent;
  media: MediaIndexItem[];
  tours: TourItem[];
  coverId: string | null;
  businessName: string;
  urls: UrlResolver;
}): ListingView {
  const { content, media, urls } = args;
  const byId = new Map(media.map((m) => [m.id, m]));
  const heroId = resolveHeroId(content, media, args.coverId);
  const heroItem = heroId ? byId.get(heroId) : undefined;
  const hero = heroItem ? image(heroItem, urls, "large") : null;
  const gallery = resolveGalleryIds(content, media)
    .map((id) => byId.get(id))
    .filter((m): m is MediaIndexItem => Boolean(m))
    .map((m) => image(m, urls, "medium"))
    .filter((v): v is ViewImage => Boolean(v));
  const floorPlans = resolveFloorPlanIds(content, media)
    .map((id) => byId.get(id))
    .filter((m): m is MediaIndexItem => Boolean(m))
    .map((m) => image(m, urls, "large"))
    .filter((v): v is ViewImage => Boolean(v));
  const videos: ViewVideo[] = resolveVideoIds(content, media)
    .map((id) => byId.get(id))
    .filter((m): m is MediaIndexItem => Boolean(m))
    .map((m): ViewVideo | null => {
      if (m.source === "youtube" && m.embedUrl) {
        return { id: m.id, title: m.name, kind: "youtube", src: null, embedUrl: m.embedUrl, posterUrl: urls.poster(m.id) };
      }
      if (m.source === "upload") {
        return { id: m.id, title: m.name, kind: "upload", src: urls.video(m.id), embedUrl: null, posterUrl: urls.poster(m.id) };
      }
      return null;
    })
    .filter((v): v is ViewVideo => Boolean(v && (v.src || v.embedUrl)));

  const b = content.branding;
  const oh = formatOpenHouse(content.property.openHouse);
  return {
    template: content.website.template,
    property: content.property,
    priceText: formatPrice(content.property.price),
    facts: propertyFacts(content.property),
    openHouse: oh ? { ...oh, note: content.property.openHouse?.note ?? "" } : null,
    agent: {
      ...content.agent,
      headshotUrl: content.agent.headshot ? urls.image(content.agent.headshot, "medium") : null,
      brokerageLogoUrl: content.agent.brokerageLogo ? urls.image(content.agent.brokerageLogo, "thumb") : null,
    },
    showAgent: !b.unbranded && Boolean(content.agent.name || content.agent.phone || content.agent.email),
    branding: {
      primary: b.primaryColor,
      accent: b.accentColor,
      onPrimary: onColor(b.primaryColor),
      onAccent: onColor(b.accentColor),
      logoUrl: !b.unbranded && b.logo ? urls.image(b.logo, "thumb") : null,
      source: b.source,
    },
    hero,
    gallery,
    videos,
    floorPlans,
    tours: args.tours,
    sections: content.website.sections,
    businessName: args.businessName,
    photographerCredit: b.photographerCredit,
  };
}

// ---------------------------------------------------------------------------
// Social picks
// ---------------------------------------------------------------------------

const AUTO_PREFS: Record<SocialAssetKey, PhotoCategory[]> = {
  sq_just_listed: [],
  st_just_listed: [],
  flyer: [],
  sq_just_sold: [],
  sq_open_house: ["living", "exterior", "kitchen"],
  sq_highlights: ["kitchen", "living", "dining"],
  sq_coming_soon: ["twilight", "aerial", "exterior"],
  st_open_house: ["living", "kitchen", "exterior"],
  st_details: ["kitchen", "living", "outdoor"],
};

/** Featured photo per social asset: the user's pick if still approved, else an automatic pick. */
export function socialFeaturedId(
  key: SocialAssetKey,
  content: MarketingContent,
  media: MediaIndexItem[],
  heroId: string | null
): string | null {
  const photos = media.filter((m) => m.type === "photo" && m.category !== "floorplan");
  const chosen = content.social.featured[key];
  if (chosen && photos.some((p) => p.id === chosen)) return chosen;
  const prefs = AUTO_PREFS[key];
  for (const cat of prefs) {
    const hit = photos.find((p) => p.category === cat && p.id !== heroId);
    if (hit) return hit.id;
  }
  if (prefs.length && photos.length > 1) {
    return photos.find((p) => p.id !== heroId)?.id ?? heroId;
  }
  return heroId ?? photos[0]?.id ?? null;
}

/** Up to `n` supporting photos (distinct from the hero) for flyers and detail layouts. */
export function supportingPhotoIds(media: MediaIndexItem[], heroId: string | null, n: number): string[] {
  const photos = media.filter((m) => m.type === "photo" && m.category !== "floorplan" && m.id !== heroId);
  const order: PhotoCategory[] = ["living", "kitchen", "bedroom", "outdoor", "bathroom", "dining", "pool", "view", "exterior"];
  const picked: string[] = [];
  for (const cat of order) {
    const hit = photos.find((p) => p.category === cat && !picked.includes(p.id));
    if (hit) picked.push(hit.id);
    if (picked.length >= n) return picked;
  }
  for (const p of photos) {
    if (!picked.includes(p.id)) picked.push(p.id);
    if (picked.length >= n) break;
  }
  return picked;
}

/** Flyer settings, tolerant of content saved before flyer options existed. */
export function flyerConfig(content: MarketingContent): FlyerConfig {
  return { ...DEFAULT_FLYER, ...(content.social.flyer ?? {}) };
}

/**
 * Supporting flyer photos, in order, sized to the chosen layout: the user's picks that are
 * still approved (never the cover), else automatic picks.
 */
export function resolveFlyerPhotoIds(content: MarketingContent, media: MediaIndexItem[], coverId: string | null): string[] {
  const cfg = flyerConfig(content);
  const cap = FLYER_LAYOUTS.find((l) => l.key === cfg.layout)?.photos ?? 6;
  const heroId = resolveHeroId(content, media, coverId);
  const featured = socialFeaturedId("flyer", content, media, heroId);
  if (cfg.photoIds) {
    const ok = new Set(media.filter((m) => m.type === "photo").map((m) => m.id));
    return cfg.photoIds.filter((id) => ok.has(id) && id !== featured).slice(0, cap);
  }
  return supportingPhotoIds(media, featured, cap);
}

const CAROUSEL_ROOMS: { cat: PhotoCategory; caption: string }[] = [
  { cat: "exterior", caption: "Curb appeal" },
  { cat: "living", caption: "Living" },
  { cat: "kitchen", caption: "Kitchen" },
  { cat: "dining", caption: "Dining" },
  { cat: "bedroom", caption: "Primary suite" },
  { cat: "bathroom", caption: "Bath" },
  { cat: "outdoor", caption: "Outdoor living" },
  { cat: "pool", caption: "Pool" },
  { cat: "view", caption: "The view" },
];

/** Automatic carousel: cover, one slide per room type that exists, highlights, agent. */
export function autoCarousel(content: MarketingContent, media: MediaIndexItem[], heroId: string | null): CarouselSlide[] {
  const photos = media.filter((m) => m.type === "photo" && m.category !== "floorplan");
  const slides: CarouselSlide[] = [{ kind: "cover", mediaId: heroId, caption: "" }];
  const used = new Set(heroId ? [heroId] : []);
  for (const room of CAROUSEL_ROOMS) {
    const hit = photos.find((p) => p.category === room.cat && !used.has(p.id));
    if (hit) {
      used.add(hit.id);
      slides.push({ kind: "photo", mediaId: hit.id, caption: room.caption });
    }
    if (slides.length >= 6) break;
  }
  for (const p of photos) {
    if (slides.length >= 6) break;
    if (!used.has(p.id)) {
      used.add(p.id);
      slides.push({ kind: "photo", mediaId: p.id, caption: "" });
    }
  }
  if (content.property.highlights.length || propertyFacts(content.property).length) {
    slides.push({ kind: "highlights", mediaId: null, caption: "" });
  }
  if (!content.branding.unbranded && content.agent.name) slides.push({ kind: "agent", mediaId: null, caption: "" });
  return slides.slice(0, MAX_CAROUSEL_SLIDES);
}

export function resolveCarousel(content: MarketingContent, media: MediaIndexItem[], heroId: string | null): CarouselSlide[] {
  if (!content.social.carousel) return autoCarousel(content, media, heroId);
  const ok = new Set(media.filter((m) => m.type === "photo").map((m) => m.id));
  return content.social.carousel.map((s) =>
    s.mediaId && !ok.has(s.mediaId) ? { ...s, mediaId: s.kind === "cover" ? heroId : null } : s
  );
}

export type SocialAssetStatus = { key: SocialAssetKey; label: string; format: "square" | "story" | "flyer"; available: boolean; reason: string | null; enabled: boolean };

export function socialAssetStatuses(content: MarketingContent, hasPhotos: boolean): SocialAssetStatus[] {
  return SOCIAL_ASSETS.map((a) => {
    let reason: string | null = null;
    if (!hasPhotos) reason = "Add photos to the project";
    else if (a.requires === "openHouse" && !content.property.openHouse) reason = "Add open house details to use this";
    return {
      key: a.key,
      label: a.label,
      format: a.format,
      available: reason === null,
      reason,
      enabled: !content.social.disabled.includes(a.key),
    };
  });
}

/** Default headline per asset (users may override up to 40 characters). */
export function socialHeadline(key: SocialAssetKey, content: MarketingContent): string {
  const custom = content.social.headlines[key];
  if (custom?.trim()) return custom.trim();
  switch (key) {
    case "sq_just_listed":
    case "st_just_listed":
      return content.property.status === "for_lease" ? "For Lease" : "Just Listed";
    case "sq_open_house":
    case "st_open_house":
      return "Open House";
    case "sq_just_sold":
      return "Just Sold";
    case "sq_coming_soon":
      return "Coming Soon";
    case "sq_highlights":
      return "Home Highlights";
    case "st_details":
      return "Tour the Home";
    case "flyer":
      return content.property.status === "sold" ? "Just Sold" : content.property.status === "coming_soon" ? "Coming Soon" : "Now Available";
  }
}
