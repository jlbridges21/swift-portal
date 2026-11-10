/**
 * Builds the render inputs for every Social Media Kit asset (pure). Used by the live preview
 * and by the server export so both pick the same photos, text and slide order.
 */
import { FORMAT_SIZE, SOCIAL_ASSETS, type MarketingContent, type MediaIndexItem, type SocialAssetKey } from "@/lib/marketing/model";
import {
  flyerConfig,
  resolveCarousel,
  resolveFlyerPhotoIds,
  resolveHeroId,
  socialAssetStatuses,
  socialFeaturedId,
  socialHeadline,
  type ListingView,
  type SocialAssetStatus,
} from "@/lib/marketing/view-model";
import { qrSvgDataUri } from "@/lib/marketing/qr";
import type { SocialRenderInput } from "@/components/marketing/social/templates";

export type SocialItem = {
  /** Stable id used for downloads: an asset key, or "carousel-1".."carousel-10". */
  id: string;
  label: string;
  group: "square" | "story" | "carousel" | "flyer";
  input: SocialRenderInput;
  status: SocialAssetStatus | null;
  fileName: string;
};

export function socialFileBase(address: string): string {
  return (
    address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "listing"
  );
}

export function buildSocialItems(args: {
  content: MarketingContent;
  media: MediaIndexItem[];
  coverId: string | null;
  view: ListingView;
  /** Image URL for a media id at export/preview size. */
  photoUrl: (id: string | null) => string | null;
  watermark?: boolean;
  /** Include disabled/unavailable assets (editor shows them greyed out). */
  includeAll?: boolean;
  /** Public property website URL while it is published (flyer QR code); null hides the QR. */
  websiteUrl?: string | null;
}): SocialItem[] {
  const { content, media, view, photoUrl } = args;
  const heroId = resolveHeroId(content, media, args.coverId);
  const hasPhotos = media.some((m) => m.type === "photo");
  const statuses = new Map(socialAssetStatuses(content, hasPhotos).map((s) => [s.key, s]));
  const base = socialFileBase(content.property.address);
  const style = content.social.style;
  const items: SocialItem[] = [];
  const flyer = flyerConfig(content);
  const flyerPhotos = resolveFlyerPhotoIds(content, media, args.coverId);
  const qr = flyer.showQr && args.websiteUrl ? qrSvgDataUri(args.websiteUrl) : null;

  for (const a of SOCIAL_ASSETS) {
    const status = statuses.get(a.key)!;
    if (!args.includeAll && (!status.available || !status.enabled)) continue;
    const size = FORMAT_SIZE[a.format];
    const featured = socialFeaturedId(a.key as SocialAssetKey, content, media, heroId);
    items.push({
      id: a.key,
      label: a.label,
      group: a.format,
      status,
      fileName: `${base}-${a.key.replace(/^sq_|^st_/, "").replace(/_/g, "-")}${a.format === "story" ? "-story" : ""}.${a.format === "flyer" ? "pdf" : "png"}`,
      input: {
        asset: a.key,
        format: a.format,
        width: size.width,
        height: size.height,
        style,
        view,
        headline: socialHeadline(a.key, content),
        photo: photoUrl(featured),
        supporting: a.format === "flyer" ? flyerPhotos.map((id) => photoUrl(id)).filter((u): u is string => Boolean(u)) : [],
        ...(a.format === "flyer" ? { flyer, qr, websiteUrl: args.websiteUrl ?? null } : {}),
        watermark: args.watermark,
      },
    });
  }

  if (hasPhotos && (content.social.includeCarousel || args.includeAll)) {
    const slides = resolveCarousel(content, media, heroId);
    const size = FORMAT_SIZE.carousel;
    slides.forEach((slide, index) => {
      items.push({
        id: `carousel-${index + 1}`,
        label: `Carousel ${index + 1}`,
        group: "carousel",
        status: null,
        fileName: `${base}-carousel-${String(index + 1).padStart(2, "0")}.png`,
        input: {
          asset: "carousel",
          format: "carousel",
          width: size.width,
          height: size.height,
          style,
          view,
          headline: socialHeadline("sq_just_listed", content),
          photo: photoUrl(slide.kind === "cover" ? slide.mediaId ?? heroId : slide.mediaId),
          supporting: [],
          slide: { ...slide, index, total: slides.length, photo: photoUrl(slide.mediaId) },
          watermark: args.watermark,
        },
      });
    });
  }
  return items;
}
