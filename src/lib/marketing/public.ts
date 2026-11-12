/**
 * Public property websites (server only).
 *
 * A site resolves only when ALL hold, checked on every request (fail closed):
 *   - the request host belongs to the business (portal subdomain/custom domain/listing domain)
 *   - the kit is published and has a published snapshot
 *   - a granting website purchase exists (paid, or included/comped by the business)
 *   - the project still exists (not hidden/deleted)
 *   - each snapshot photo/video is STILL eligible (client-visible, in the project)
 * Nothing private (invoices, notes, messages, other media, other projects) is ever loaded.
 */
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { isClientVisibleTour } from "@/lib/client-media";
import { normalizeTourUrl } from "@/lib/tour-url";
import { resolveTourEmbedMap } from "@/lib/tour-embed-server";
import { isUuid, type AssetRef, type MarketingContent, type MediaIndexItem, type TourItem } from "@/lib/marketing/model";
import {
  businessLogoFromSettings,
  isMarketingSchemaMissing,
  loadEligibleMedia,
  loadProjectRow,
  toMediaIndex,
  youtubePoster,
  type EligibleMediaRow,
  type PublishedSnapshot,
} from "@/lib/marketing/server";
import { buildListingView, type ListingView, type UrlResolver } from "@/lib/marketing/view-model";

export type PublicListing = {
  kitId: string;
  businessId: string;
  projectId: string;
  slug: string;
  snapshot: PublishedSnapshot;
  content: MarketingContent;
  media: MediaIndexItem[];
  mediaRows: EligibleMediaRow[];
  tours: TourItem[];
  businessLogoUrl: string | null;
};

type KitPublicRow = {
  id: string;
  project_id: string;
  site_slug: string;
  website_status: string;
  published_content: PublishedSnapshot | null;
};

async function hasWebsiteGrant(db: TenantServiceClient, projectId: string): Promise<boolean> {
  const { data } = await db
    .from("marketing_kit_purchases")
    .select("id")
    .eq("project_id", projectId)
    .eq("product", "website")
    .in("status", ["paid", "comped"])
    .limit(1);
  return Boolean(data?.length);
}

async function resolve(db: TenantServiceClient, kit: KitPublicRow | null): Promise<PublicListing | null> {
  if (!kit || kit.website_status !== "published" || !kit.published_content?.content) return null;
  if (!(await hasWebsiteGrant(db, kit.project_id))) return null;
  const project = await loadProjectRow(db, kit.project_id);
  if (!project) return null;
  const snapshot = kit.published_content;
  const allowed = new Set(snapshot.mediaIds);
  const rows = (await loadEligibleMedia(db, project)).filter((r) => allowed.has(r.id));
  const media = toMediaIndex(rows);
  const live = new Set(media.map((m) => m.id));
  const c = snapshot.content;
  // Drop anything no longer eligible (hidden, deleted, moved) — never show stale media.
  const content: MarketingContent = {
    ...c,
    media: {
      heroId: c.media.heroId && live.has(c.media.heroId) ? c.media.heroId : null,
      gallery: c.media.gallery.mode === "custom" ? { mode: "custom", ids: c.media.gallery.ids.filter((id) => live.has(id)) } : { mode: "custom", ids: [] },
      videoIds: (c.media.videoIds ?? []).filter((id) => live.has(id)),
      floorPlanIds: (c.media.floorPlanIds ?? []).filter((id) => live.has(id)),
    },
  };
  let tours: TourItem[] = [];
  if (project.client_section_tours !== false && content.website.sections.some((s) => s.key === "tour" && s.visible)) {
    const { data } = await db
      .from("tours")
      .select("id, tour_name, kuula_url, embed_code, thumbnail_url, client_visible")
      .eq("project_id", project.id)
      .order("display_order");
    const rows = ((data ?? []) as { id: string; tour_name: string; kuula_url: string; embed_code?: string | null; thumbnail_url?: string | null; client_visible?: boolean }[])
      .filter((t) => isClientVisibleTour(t) && t.kuula_url && normalizeTourUrl(t.kuula_url));
    // Same resolver as the client portal: embed code → provider embed URL → framing check.
    const embeds = await resolveTourEmbedMap(rows);
    tours = rows.map((t) => ({
      id: t.id,
      title: t.tour_name || "Virtual tour",
      url: normalizeTourUrl(t.kuula_url) ?? "",
      embedUrl: embeds[t.id] ?? null,
      thumbnailUrl: t.thumbnail_url?.startsWith("https://") ? t.thumbnail_url : null,
    }));
  }
  const settings = await getAppSettings(db.businessId);
  return {
    kitId: kit.id,
    businessId: db.businessId,
    projectId: project.id,
    slug: kit.site_slug,
    snapshot,
    content,
    media,
    mediaRows: rows,
    tours,
    businessLogoUrl: businessLogoFromSettings(settings),
  };
}

const KIT_PUBLIC_COLUMNS = "id, project_id, site_slug, website_status, published_content";

export async function loadPublicListingBySlug(businessId: string, slug: string): Promise<PublicListing | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("marketing_kits").select(KIT_PUBLIC_COLUMNS).eq("site_slug", slug).maybeSingle();
  if (error && isMarketingSchemaMissing(error)) return null;
  return resolve(db, data as KitPublicRow | null);
}

/** Short in-process cache for the image/video routes (one page view = many image requests). */
const byIdCache = new Map<string, { at: number; value: PublicListing | null }>();
const BY_ID_TTL_MS = 30_000;

export async function loadPublicListingById(businessId: string, kitId: string): Promise<PublicListing | null> {
  if (!isUuid(kitId)) return null;
  const key = `${businessId}:${kitId}`;
  const hit = byIdCache.get(key);
  if (hit && Date.now() - hit.at < BY_ID_TTL_MS) return hit.value;
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("marketing_kits").select(KIT_PUBLIC_COLUMNS).eq("id", kitId).maybeSingle();
  const value = await resolve(db, data as KitPublicRow | null);
  if (byIdCache.size > 500) byIdCache.clear();
  byIdCache.set(key, { at: Date.now(), value });
  return value;
}

export async function listPublishedListings(businessId: string): Promise<{ slug: string; address: string; locality: string; heroUrl: string | null; priceText: string | null }[]> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("marketing_kits")
    .select("id, site_slug, published_content, published_at")
    .eq("website_status", "published")
    .order("published_at", { ascending: false })
    .limit(60);
  if (error) return [];
  const out = [];
  for (const row of (data ?? []) as { id: string; site_slug: string; published_content: PublishedSnapshot | null }[]) {
    const listing = await loadPublicListingById(businessId, row.id);
    if (!listing) continue;
    const view = publicView(listing);
    out.push({
      slug: row.site_slug,
      address: view.property.address,
      locality: view.property.locality,
      heroUrl: view.hero?.thumbUrl ?? view.hero?.url ?? null,
      priceText: view.priceText,
    });
  }
  return out;
}

export function publicUrlResolver(listing: PublicListing): UrlResolver {
  const base = `/api/public/listing/${listing.kitId}`;
  const rows = new Map(listing.mediaRows.map((r) => [r.id, r]));
  return {
    image: (ref: AssetRef, size) =>
      ref.kind === "media"
        ? `${base}/img/${ref.id}?s=${size}`
        : ref.kind === "upload"
          ? `${base}/img/u?p=${encodeURIComponent(ref.path)}&s=${size}`
          : listing.businessLogoUrl,
    video: (id) => `${base}/video/${id}`,
    logo: (ref: AssetRef) =>
      ref.kind === "upload"
        ? `${base}/logo?p=${encodeURIComponent(ref.path)}`
        : ref.kind === "business_logo"
          ? listing.businessLogoUrl
            ? `${base}/logo?ref=business`
            : null
          : `${base}/img/${ref.id}?s=thumb`,
    poster: (id) => {
      const r = rows.get(id);
      if (!r) return null;
      if (r.media_source === "youtube") return youtubePoster(r);
      return r.thumbnail_url ? `${base}/img/${id}?s=medium` : null;
    },
  };
}

export function publicView(listing: PublicListing): ListingView {
  return buildListingView({
    content: listing.content,
    media: listing.media,
    tours: listing.tours,
    coverId: listing.snapshot.coverId,
    businessName: listing.snapshot.businessName,
    urls: publicUrlResolver(listing),
  });
}

export async function recordListingView(businessId: string, kitId: string): Promise<void> {
  try {
    const db = await createTenantServiceClient(businessId);
    await db.raw.rpc("increment_marketing_kit_views", { p_kit_id: kitId, p_business_id: businessId });
  } catch {
    /* best effort */
  }
}
