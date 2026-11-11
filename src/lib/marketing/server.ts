/**
 * Marketing Kit — server data layer (tenant-scoped).
 *
 * Media eligibility (public-safe by construction): only photos and videos in this project
 * that clients can already see (visibility client/both, section visible to clients, latest
 * video-review version). Business-only, hidden, or superseded media never reach a draft,
 * a preview, an export or the public website. The public site re-checks eligibility on
 * every request against its published snapshot, so hiding a photo takes it offline.
 */
import { getAppSettings, type AppSettings } from "@/lib/app-settings";
import { isClientVisibleMedia, isClientVisibleTour } from "@/lib/client-media";
import { getKuulaEmbedUrl } from "@/lib/kuula";
import { mediaSectionsFromProject } from "@/lib/project-media-sections";
import { resolveProjectAccess } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { filterMediaForVideoReviewDelivery, loadVideoReviewVersionMap } from "@/lib/video-review-media";
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from "@/lib/youtube";
import { BRAND } from "@/lib/brand";
import { buildPublicTenantUrlForBusiness } from "@/lib/project-link-access";
import { logProjectActivity } from "@/lib/activity";
import type { Profile } from "@/lib/types";
import { buildDefaults, classifyPhoto, slugCandidates, type BrandProfile } from "@/lib/marketing/defaults";
import {
  MARKETING_PRODUCTS,
  marketingUploadPrefix,
  mergeContent,
  sanitizeOverrides,
  type AssetRef,
  type MarketingContent,
  type MarketingOverrides,
  type MarketingProduct,
  type MediaIndexItem,
  type TourItem,
} from "@/lib/marketing/model";
import {
  resolveAccess,
  resolveOffer,
  sanitizeOfferOverrides,
  type MarketingKitSettings,
  type ProductAccess,
  type ProjectOfferOverrides,
  type PurchaseRow,
  type ResolvedOffer,
} from "@/lib/marketing/offers";
import { brandedListingUrl, fallbackListingPath, listingDomainConnected } from "@/lib/marketing/listing-url";
import { resolveCarousel, resolveFloorPlanIds, resolveGalleryIds, resolveHeroId, resolveVideoIds, socialFeaturedId, supportingPhotoIds } from "@/lib/marketing/view-model";
import { SOCIAL_ASSETS } from "@/lib/marketing/model";

export const MARKETING_BUCKET = "project-media";

export class MarketingSetupRequiredError extends Error {
  constructor() {
    super("The Marketing Kit needs a quick database update (migration v118) before it can be used.");
    this.name = "MarketingSetupRequiredError";
  }
}

export class MarketingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "MarketingError";
    this.status = status;
  }
}

export function isMarketingSchemaMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /marketing_kit|marketing_brand/i.test(error.message ?? "");
}

// ---------------------------------------------------------------------------
// Actor / permissions
// ---------------------------------------------------------------------------

export type MarketingActor = {
  kind: "business" | "client";
  profile: Profile;
  /** Edit property info, design, branding, photo picks. */
  canEdit: boolean;
  /** Change per-project price/availability, bill the client, include at no charge. */
  canManageOffers: boolean;
};

/** Admin/staff with project access, or the project's assigned client. Shared viewers: no access. */
export async function resolveMarketingActor(
  profile: Profile,
  projectId: string,
  tenantBusinessId: string
): Promise<MarketingActor | null> {
  const access = await resolveProjectAccess(profile, projectId, { tenantBusinessId });
  if (!access.allowed || access.businessId !== tenantBusinessId) return null;
  if (access.kind === "admin") {
    return {
      kind: "business",
      profile,
      canEdit: isOwnerAdmin(profile) || staffCan(profile, "projects.edit"),
      canManageOffers: isOwnerAdmin(profile) || staffCan(profile, "money.send_payment_links"),
    };
  }
  if (access.kind === "assigned_client") {
    return { kind: "client", profile, canEdit: false, canManageOffers: false };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type KitRow = {
  id: string;
  business_id: string;
  project_id: string;
  content: MarketingOverrides | null;
  published_content: PublishedSnapshot | null;
  site_slug: string;
  website_status: "draft" | "published" | "unpublished";
  published_at: string | null;
  unpublished_at: string | null;
  offer_overrides: ProjectOfferOverrides | null;
  draft_updated_at: string | null;
  view_count: number;
};

const KIT_COLUMNS =
  "id, business_id, project_id, content, published_content, site_slug, website_status, published_at, unpublished_at, offer_overrides, draft_updated_at, view_count";

/** Frozen copy rendered by the public website. */
export type PublishedSnapshot = {
  content: MarketingContent;
  /** Media ids referenced at publish time (hero, gallery, videos, floor plans). */
  mediaIds: string[];
  /** Upload paths referenced (headshot, logos). */
  uploads: string[];
  coverId: string | null;
  businessName: string;
  publishedAt: string;
};

type ProjectRow = {
  id: string;
  business_id: string;
  client_id: string | null;
  property_address: string | null;
  project_name: string | null;
  status: string;
  cover_image_id: string | null;
  deleted_at: string | null;
  client_section_photos?: boolean;
  client_section_videos?: boolean;
  client_section_tours?: boolean;
  /** Migration v123: null/absent = automatic, true = shown, false = hidden from the client. */
  client_section_marketing?: boolean | null;
  properties?: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null; property_type?: string | null } | null;
  clients?: { id: string; name?: string | null; full_name?: string | null; email?: string | null; phone?: string | null; company?: string | null } | null;
};

export type EligibleMediaRow = {
  id: string;
  media_type: "photo" | "video" | "document";
  media_source: "upload" | "youtube" | "kuula" | "external";
  file_name: string;
  file_path: string;
  file_size: number | null;
  thumbnail_url: string | null;
  title: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  youtube_url: string | null;
  embed_url: string | null;
  visibility?: "client" | "admin" | "both";
  mime_type: string;
};

const MEDIA_COLUMNS =
  "id, media_type, media_source, file_name, file_path, file_size, thumbnail_url, title, alt_text, width, height, youtube_url, embed_url, visibility, mime_type, display_order";

const PROJECT_ROW_COLUMNS =
  "id, business_id, client_id, property_address, project_name, status, cover_image_id, deleted_at, client_section_photos, client_section_videos, client_section_tours, properties(address, city, state, zip, property_type), clients(id, name, full_name, email, phone, company)";

/** True when a query failed only because migration v123 (client_section_marketing) isn't applied. */
export function isMissingMarketingVisibilityColumn(error: { message?: string | null } | null | undefined): boolean {
  return Boolean(error?.message?.includes("client_section_marketing"));
}

export async function loadProjectRow(db: TenantServiceClient, projectId: string): Promise<ProjectRow | null> {
  let { data, error } = await db
    .from("projects")
    .select(`${PROJECT_ROW_COLUMNS}, client_section_marketing`)
    .eq("id", projectId)
    .maybeSingle();
  if (error && isMissingMarketingVisibilityColumn(error)) {
    // Pre-v123 database: no per-project override, visibility stays automatic.
    ({ data, error } = await db.from("projects").select(PROJECT_ROW_COLUMNS).eq("id", projectId).maybeSingle());
  }
  if (!data || (data as unknown as ProjectRow).deleted_at) return null;
  return data as unknown as ProjectRow;
}

/** Client-visible photos and videos only (see file header). */
export async function loadEligibleMedia(db: TenantServiceClient, project: ProjectRow): Promise<EligibleMediaRow[]> {
  const sections = mediaSectionsFromProject(project);
  const types: string[] = [];
  if (sections.photos) types.push("photo");
  if (sections.videos) types.push("video");
  if (!types.length) return [];
  const { data } = await db
    .from("media_assets")
    .select(MEDIA_COLUMNS)
    .eq("project_id", project.id)
    .in("media_type", types)
    .order("display_order", { ascending: true });
  const rows = ((data ?? []) as EligibleMediaRow[]).filter(
    (m) => isClientVisibleMedia(m) && (m.media_type === "photo" || m.media_source === "upload" || m.media_source === "youtube")
  );
  const versionMap = await loadVideoReviewVersionMap(db, project.id);
  return filterMediaForVideoReviewDelivery(rows, versionMap, false);
}

export function toMediaIndex(rows: EligibleMediaRow[]): MediaIndexItem[] {
  return rows.map((m) => {
    const name = (m.title?.trim() || m.file_name || "").trim();
    return {
      id: m.id,
      type: m.media_type === "video" ? "video" : "photo",
      source: m.media_source,
      name,
      alt: m.alt_text?.trim() || "",
      width: m.width,
      height: m.height,
      category: m.media_type === "photo" ? classifyPhoto(`${m.title ?? ""} ${m.file_name}`) : null,
      youtubeUrl: m.youtube_url,
      embedUrl: m.media_source === "youtube" ? getYouTubeEmbedUrl(m.youtube_url || m.embed_url || "") : null,
    };
  });
}

export function youtubePoster(m: Pick<EligibleMediaRow, "youtube_url" | "embed_url">): string | null {
  return getYouTubeThumbnail(m.youtube_url || m.embed_url || "");
}

async function loadTours(db: TenantServiceClient, project: ProjectRow): Promise<TourItem[]> {
  if (project.client_section_tours === false) return [];
  const { data } = await db
    .from("tours")
    .select("id, tour_name, kuula_url, client_visible")
    .eq("project_id", project.id)
    .order("display_order");
  return ((data ?? []) as { id: string; tour_name: string; kuula_url: string; client_visible?: boolean }[])
    .filter((t) => isClientVisibleTour(t) && t.kuula_url)
    .map((t) => ({ id: t.id, title: t.tour_name || "Virtual tour", embedUrl: getKuulaEmbedUrl(t.kuula_url) }))
    .filter((t) => /^https:\/\//.test(t.embedUrl));
}

// ---------------------------------------------------------------------------
// Kit row
// ---------------------------------------------------------------------------

async function slugTaken(db: TenantServiceClient, slug: string, exceptKitId?: string): Promise<boolean> {
  let q = db.from("marketing_kits").select("id").eq("site_slug", slug);
  if (exceptKitId) q = q.neq("id", exceptKitId);
  const { data } = await q.limit(1);
  return Boolean(data?.length);
}

export async function uniqueSlug(db: TenantServiceClient, street: string, locality: string, exceptKitId?: string): Promise<string> {
  for (const candidate of slugCandidates(street, locality)) {
    if (!(await slugTaken(db, candidate, exceptKitId))) return candidate;
  }
  return `${slugCandidates(street, locality)[0]}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Load the project's kit, creating it on first open (idempotent under races). */
export async function ensureKitRow(db: TenantServiceClient, project: ProjectRow, street: string, locality: string): Promise<KitRow> {
  const { data, error } = await db.from("marketing_kits").select(KIT_COLUMNS).eq("project_id", project.id).maybeSingle();
  if (isMarketingSchemaMissing(error)) throw new MarketingSetupRequiredError();
  if (data) return data as KitRow;
  const slug = await uniqueSlug(db, street, locality);
  const { data: created, error: insertError } = await db
    .from("marketing_kits")
    .insert({ project_id: project.id, site_slug: slug, content: {}, offer_overrides: {} })
    .select(KIT_COLUMNS)
    .single();
  if (insertError) {
    if (isMarketingSchemaMissing(insertError)) throw new MarketingSetupRequiredError();
    const { data: again } = await db.from("marketing_kits").select(KIT_COLUMNS).eq("project_id", project.id).maybeSingle();
    if (again) return again as KitRow;
    throw new MarketingError(insertError.message, 500);
  }
  return created as KitRow;
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

const PURCHASE_COLUMNS = "id, product, status, amount_cents, payment_id, purchase_method, granted_at, created_at";

/** Purchases, with stale pending rows (payment cancelled / failed / deleted) closed out. */
export async function loadPurchases(db: TenantServiceClient, projectId: string): Promise<PurchaseRow[]> {
  const { data, error } = await db
    .from("marketing_kit_purchases")
    .select(PURCHASE_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (isMarketingSchemaMissing(error)) throw new MarketingSetupRequiredError();
  const rows = (data ?? []) as PurchaseRow[];
  const pending = rows.filter((r) => r.status === "pending");
  if (!pending.length) return rows;
  const paymentIds = pending.map((r) => r.payment_id).filter((id): id is string => Boolean(id));
  const statusById = new Map<string, string>();
  if (paymentIds.length) {
    const { data: pays } = await db.from("payments").select("id, status").in("id", paymentIds);
    for (const p of (pays ?? []) as { id: string; status: string }[]) statusById.set(p.id, p.status);
  }
  const stale = pending.filter((r) => {
    const s = r.payment_id ? statusById.get(r.payment_id) : undefined;
    return !s || s === "cancelled" || s === "failed" || s === "expired";
  });
  if (stale.length) {
    await db
      .from("marketing_kit_purchases")
      .update({ status: "cancelled", revoked_at: new Date().toISOString(), revoked_reason: "payment_closed", updated_at: new Date().toISOString() })
      .in("id", stale.map((r) => r.id))
      .eq("status", "pending");
    const staleIds = new Set(stale.map((r) => r.id));
    return rows.map((r) => (staleIds.has(r.id) ? { ...r, status: "cancelled" as const } : r));
  }
  // A pending row whose payment is already paid (webhook raced) is granted here too.
  const paidPending = pending.filter((r) => r.payment_id && statusById.get(r.payment_id) === "paid");
  if (paidPending.length) {
    const { grantPurchasesForPayment } = await import("@/lib/marketing/purchases");
    for (const pid of new Set(paidPending.map((r) => r.payment_id!))) {
      await grantPurchasesForPayment(db.businessId, pid);
    }
    const { data: fresh } = await db.from("marketing_kit_purchases").select(PURCHASE_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false });
    return (fresh ?? []) as PurchaseRow[];
  }
  return rows;
}

async function loadBrandProfile(db: TenantServiceClient, clientId: string | null): Promise<BrandProfile | null> {
  if (!clientId) return null;
  const { data } = await db.from("marketing_brand_profiles").select("profile").eq("client_id", clientId).maybeSingle();
  const p = (data?.profile ?? null) as BrandProfile | null;
  return p && typeof p === "object" ? p : null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type ListingDomainSummary = { domain: string | null; status: string | null; connected: boolean; setupRequired: boolean };

export interface KitContext {
  db: TenantServiceClient;
  businessId: string;
  project: ProjectRow;
  kit: KitRow;
  mediaRows: EligibleMediaRow[];
  media: MediaIndexItem[];
  tours: TourItem[];
  purchases: PurchaseRow[];
  appSettings: AppSettings;
  settings: MarketingKitSettings;
  defaults: MarketingContent;
  overrides: MarketingOverrides;
  content: MarketingContent;
  offerOverrides: ProjectOfferOverrides;
  offers: Record<MarketingProduct, ResolvedOffer>;
  access: Record<MarketingProduct, ProductAccess>;
  listingDomain: ListingDomainSummary;
  businessName: string;
  businessLogoUrl: string | null;
  urls: { fallback: string; branded: string | null; live: string };
}

async function loadListingDomain(db: TenantServiceClient): Promise<ListingDomainSummary> {
  const { data, error } = await db.raw
    .from("businesses")
    .select("listing_domain, listing_domain_status, listing_domain_vercel_verified, listing_domain_misconfigured")
    .eq("id", db.businessId)
    .maybeSingle();
  if (error || !data) return { domain: null, status: null, connected: false, setupRequired: Boolean(error) };
  const row = data as { listing_domain: string | null; listing_domain_status: string | null };
  return { domain: row.listing_domain, status: row.listing_domain_status, connected: listingDomainConnected(data), setupRequired: false };
}

export function businessLogoFromSettings(settings: AppSettings): string | null {
  const url = settings.business.logoUrl?.trim();
  if (!url || url === BRAND.logoUrl) return null;
  return /^https:\/\//.test(url) || url.startsWith("/") ? url : null;
}

export async function loadKitContext(businessId: string, projectId: string): Promise<KitContext | null> {
  const db = await createTenantServiceClient(businessId);
  const project = await loadProjectRow(db, projectId);
  if (!project) return null;

  const [mediaRows, tours, appSettings, brandProfile, listingDomain, slugBiz] = await Promise.all([
    loadEligibleMedia(db, project),
    loadTours(db, project),
    getAppSettings(businessId),
    loadBrandProfile(db, project.client_id).catch(() => null),
    loadListingDomain(db),
    db.raw.from("businesses").select("slug, custom_domain").eq("id", businessId).maybeSingle(),
  ]);
  const media = toMediaIndex(mediaRows);
  const settings = appSettings.marketingKit;
  const businessLogoUrl = businessLogoFromSettings(appSettings);
  const businessName = appSettings.business.businessName || "";

  const defaults = buildDefaults({
    project: { property_address: project.property_address, cover_image_id: project.cover_image_id },
    property: project.properties ?? null,
    client: project.clients ?? null,
    business: {
      name: businessName,
      primaryColor: appSettings.business.brandPrimaryColor,
      accentColor: appSettings.business.brandAccentColor,
      hasLogo: Boolean(businessLogoUrl),
    },
    brandProfile,
    settings: { defaultTemplate: settings.defaultTemplate, photographerCredit: settings.photographerCredit, poweredBy: settings.poweredBy },
    media,
  });

  const kit = await ensureKitRow(db, project, defaults.property.address, defaults.property.locality);
  const purchases = await loadPurchases(db, projectId);
  const overrides = sanitizeOverrides(kit.content ?? {}, `${businessId}/marketing/`);
  const content = mergeContent(defaults, overrides);
  if (!businessLogoUrl && content.branding.logo?.kind === "business_logo") content.branding.logo = null;
  const offerOverrides = sanitizeOfferOverrides(kit.offer_overrides ?? {});
  const offers = {
    website: resolveOffer("website", settings, offerOverrides),
    social: resolveOffer("social", settings, offerOverrides),
  };
  const access = {
    website: resolveAccess("website", offers.website, purchases),
    social: resolveAccess("social", offers.social, purchases),
  };

  const biz = (slugBiz.data ?? { slug: "", custom_domain: null }) as { slug: string; custom_domain: string | null };
  const fallback = await buildPublicTenantUrlForBusiness(businessId, biz, fallbackListingPath(kit.site_slug));
  const branded = listingDomain.connected && listingDomain.domain ? brandedListingUrl(listingDomain.domain, kit.site_slug) : null;

  return {
    db,
    businessId,
    project,
    kit,
    mediaRows,
    media,
    tours,
    purchases,
    appSettings,
    settings,
    defaults,
    overrides,
    content,
    offerOverrides,
    offers,
    access,
    listingDomain,
    businessName,
    businessLogoUrl,
    urls: { fallback, branded, live: branded ?? fallback },
  };
}

// ---------------------------------------------------------------------------
// Snapshot / change detection
// ---------------------------------------------------------------------------

function refUpload(ref: AssetRef | null | undefined): string | null {
  return ref?.kind === "upload" ? ref.path : null;
}

/** Media + uploads the content references (website + social). */
export function referencedAssets(content: MarketingContent, media: MediaIndexItem[], coverId: string | null): { mediaIds: string[]; uploads: string[] } {
  const heroId = resolveHeroId(content, media, coverId);
  const ids = new Set<string>();
  if (heroId) ids.add(heroId);
  for (const id of resolveGalleryIds(content, media)) ids.add(id);
  for (const id of resolveVideoIds(content, media)) ids.add(id);
  for (const id of resolveFloorPlanIds(content, media)) ids.add(id);
  const uploads = [refUpload(content.agent.headshot), refUpload(content.agent.brokerageLogo), refUpload(content.branding.logo)].filter(
    (p): p is string => Boolean(p)
  );
  return { mediaIds: Array.from(ids), uploads };
}

/** Freeze automatic picks so the public site doesn't change until the next publish. */
export function freezeContent(content: MarketingContent, media: MediaIndexItem[], coverId: string | null): MarketingContent {
  const heroId = resolveHeroId(content, media, coverId);
  return {
    ...content,
    media: {
      heroId,
      gallery: { mode: "custom", ids: resolveGalleryIds(content, media) },
      videoIds: resolveVideoIds(content, media),
      floorPlanIds: resolveFloorPlanIds(content, media),
    },
  };
}

export function buildSnapshot(ctx: KitContext): PublishedSnapshot {
  const frozen = freezeContent(ctx.content, ctx.media, ctx.project.cover_image_id);
  const refs = referencedAssets(frozen, ctx.media, ctx.project.cover_image_id);
  return {
    content: frozen,
    mediaIds: refs.mediaIds,
    uploads: refs.uploads,
    coverId: ctx.project.cover_image_id,
    businessName: ctx.businessName,
    publishedAt: new Date().toISOString(),
  };
}

function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val
  );
}

/** Published site differs from what the draft would publish now (website-relevant fields). */
export function hasUnpublishedChanges(ctx: KitContext): boolean {
  const pub = ctx.kit.published_content;
  if (!pub || ctx.kit.website_status !== "published") return false;
  const next = freezeContent(ctx.content, ctx.media, ctx.project.cover_image_id);
  const pick = (c: MarketingContent) => ({ property: c.property, agent: c.agent, branding: c.branding, media: c.media, website: c.website });
  return stable(pick(next)) !== stable(pick(pub.content));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function saveDraft(ctx: KitContext, raw: unknown, actor: MarketingActor): Promise<void> {
  const overrides = sanitizeOverrides(raw, `${ctx.businessId}/marketing/`);
  // Media picks must reference eligible media only.
  const eligible = new Set(ctx.media.map((m) => m.id));
  if (overrides.media?.heroId && !eligible.has(overrides.media.heroId)) overrides.media.heroId = null;
  // Uploads: this project's folder, or this client's saved brand profile — nothing else.
  const checkRef = async <T extends { headshot?: AssetRef | null; brokerageLogo?: AssetRef | null; logo?: AssetRef | null }>(o: T | undefined, key: keyof T) => {
    const ref = o?.[key] as AssetRef | null | undefined;
    if (o && ref?.kind === "upload" && !(await uploadAllowedForProject(ctx.db, ctx.project.id, ctx.project.client_id, ref.path))) {
      delete o[key];
    }
  };
  await checkRef(overrides.agent, "headshot");
  await checkRef(overrides.agent, "brokerageLogo");
  await checkRef(overrides.branding, "logo");
  const { error } = await ctx.db
    .from("marketing_kits")
    .update({
      content: overrides,
      draft_updated_at: new Date().toISOString(),
      draft_updated_by: actor.profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.kit.id);
  if (error) throw new MarketingError(error.message, 500);
  ctx.kit.content = overrides;
  ctx.overrides = overrides;
  ctx.content = mergeContent(ctx.defaults, overrides);
}

export async function saveSiteSlug(ctx: KitContext, rawSlug: unknown): Promise<string> {
  const { isValidSiteSlug } = await import("@/lib/marketing/defaults");
  const slug = typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : "";
  if (!isValidSiteSlug(slug)) {
    throw new MarketingError("Use lowercase letters, numbers and dashes (for example 123-main-st).");
  }
  if (await slugTaken(ctx.db, slug, ctx.kit.id)) throw new MarketingError("Another property website already uses that address.", 409);
  const { error } = await ctx.db.from("marketing_kits").update({ site_slug: slug, updated_at: new Date().toISOString() }).eq("id", ctx.kit.id);
  if (error) throw new MarketingError(error.code === "23505" ? "Another property website already uses that address." : error.message, 409);
  ctx.kit.site_slug = slug;
  return slug;
}

export async function publishWebsite(ctx: KitContext, actor: MarketingActor): Promise<void> {
  if (!ctx.media.some((m) => m.type === "photo")) {
    throw new MarketingError("Add at least one approved photo before publishing.");
  }
  if (!ctx.content.property.address.trim()) throw new MarketingError("Add the property address before publishing.");
  if (ctx.content.property.descriptionIsDraft && ctx.content.property.description.trim()) {
    throw new MarketingError("Review the drafted description — edit it or tap Confirm — before publishing.");
  }
  const { ensureGrantForPublish } = await import("@/lib/marketing/purchases");
  await ensureGrantForPublish(ctx, actor);

  const snapshot = buildSnapshot(ctx);
  const now = new Date().toISOString();
  const wasLive = ctx.kit.website_status === "published";
  const { error } = await ctx.db
    .from("marketing_kits")
    .update({
      published_content: snapshot,
      website_status: "published",
      published_at: now,
      published_by: actor.profile.id,
      updated_at: now,
    })
    .eq("id", ctx.kit.id);
  if (error) throw new MarketingError(error.message, 500);
  ctx.kit.published_content = snapshot;
  ctx.kit.website_status = "published";
  ctx.kit.published_at = now;
  await logProjectActivity(
    "marketing_website_published",
    wasLive ? "Property website updated" : `Property website published: ${ctx.urls.live}`,
    { businessId: ctx.businessId, projectId: ctx.project.id, userId: actor.profile.id, visibility: "both", metadata: { slug: ctx.kit.site_slug } }
  );
}

export async function unpublishWebsite(ctx: KitContext, actor: MarketingActor | null, reason = "Property website unpublished"): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await ctx.db
    .from("marketing_kits")
    .update({ website_status: "unpublished", unpublished_at: now, updated_at: now })
    .eq("id", ctx.kit.id);
  if (error) throw new MarketingError(error.message, 500);
  ctx.kit.website_status = "unpublished";
  await logProjectActivity("marketing_website_unpublished", reason, {
    businessId: ctx.businessId,
    projectId: ctx.project.id,
    userId: actor?.profile.id ?? null,
    visibility: "both",
  });
}

export async function saveOfferOverride(ctx: KitContext, product: MarketingProduct, raw: unknown): Promise<void> {
  const next: ProjectOfferOverrides = { ...ctx.offerOverrides };
  if (raw === null || raw === "default") delete next[product];
  else {
    const clean = sanitizeOfferOverrides({ [product]: raw })[product];
    if (!clean) throw new MarketingError("Choose Included, Paid or Not offered.");
    next[product] = clean;
  }
  const { error } = await ctx.db
    .from("marketing_kits")
    .update({ offer_overrides: next, updated_at: new Date().toISOString() })
    .eq("id", ctx.kit.id);
  if (error) throw new MarketingError(error.message, 500);
  ctx.offerOverrides = next;
  for (const p of MARKETING_PRODUCTS) {
    ctx.offers[p] = resolveOffer(p, ctx.settings, next);
    ctx.access[p] = resolveAccess(p, ctx.offers[p], ctx.purchases);
  }
}

/** Save agent + branding as this realtor's defaults for their next listing. */
export async function saveBrandProfileFromContent(ctx: KitContext, actor: MarketingActor): Promise<void> {
  const clientId = ctx.project.client_id;
  if (!clientId) throw new MarketingError("This project has no client to save branding for.");
  const c = ctx.content;
  // Uploads live under this project's folder; they stay readable for the client's later
  // projects because the brand-profile image route checks the profile, not the project.
  const profile: BrandProfile = {
    agent: {
      name: c.agent.name,
      title: c.agent.title,
      phone: c.agent.phone,
      email: c.agent.email,
      website: c.agent.website,
      brokerage: c.agent.brokerage,
      license: c.agent.license,
      headshot: c.agent.headshot,
      brokerageLogo: c.agent.brokerageLogo,
    },
    branding: {
      source: c.branding.source,
      primaryColor: c.branding.primaryColor,
      accentColor: c.branding.accentColor,
      logo: c.branding.logo,
    },
    websiteTemplate: c.website.template,
    socialStyle: c.social.style,
  };
  const { error } = await ctx.db
    .from("marketing_brand_profiles")
    .upsert({ client_id: clientId, profile, updated_by: actor.profile.id, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
  if (error) throw new MarketingError(error.message, 500);
}

/** Upload paths a brand profile references (other projects of the same client may reuse them). */
export async function brandProfileUploads(db: TenantServiceClient, clientId: string | null): Promise<string[]> {
  const p = await loadBrandProfile(db, clientId).catch(() => null);
  if (!p) return [];
  return [refUpload(p.agent?.headshot), refUpload(p.agent?.brokerageLogo), refUpload(p.branding?.logo)].filter((x): x is string => Boolean(x));
}

// ---------------------------------------------------------------------------
// Client-facing state
// ---------------------------------------------------------------------------

export type MarketingPermissions = {
  isBusiness: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canDownload: boolean;
  canManageOffers: boolean;
  canPurchase: boolean;
  canAddToInvoice: boolean;
};

export function permissionsFor(ctx: KitContext, actor: MarketingActor): MarketingPermissions {
  if (actor.kind === "business") {
    return {
      isBusiness: true,
      canEdit: actor.canEdit,
      canPublish: actor.canEdit,
      canDownload: true,
      canManageOffers: actor.canManageOffers,
      canPurchase: false,
      canAddToInvoice: false,
    };
  }
  const s = ctx.settings;
  const anyPaidLocked = MARKETING_PRODUCTS.some((p) => ctx.access[p].state === "locked");
  return {
    isBusiness: false,
    canEdit: s.clientCanEdit,
    canPublish: s.clientCanPublish && ctx.access.website.hasAccess,
    canDownload: ctx.access.social.hasAccess,
    canManageOffers: false,
    canPurchase: anyPaidLocked,
    canAddToInvoice: anyPaidLocked && s.allowAddToInvoice,
  };
}

/**
 * Single rule for client visibility. Nothing to show → hidden. Otherwise the per-project
 * toggle (v123) wins when set; unset falls back to the automatic rule.
 */
export function resolveMarketingVisibility(input: {
  anyOffered: boolean;
  projectSetting: boolean | null | undefined;
  automatic: boolean;
}): boolean {
  if (!input.anyOffered) return false;
  if (input.projectSetting === false) return false;
  if (input.projectSetting === true) return true;
  return input.automatic;
}

/** Is the Marketing Kit visible to the client at all on this project? */
export function visibleToClient(ctx: KitContext): boolean {
  const anyOffered = MARKETING_PRODUCTS.some((p) => ctx.access[p].state !== "unavailable");
  const hasProjectOverride = Object.keys(ctx.offerOverrides).length > 0;
  const hasPurchase = ctx.purchases.some((p) => p.status !== "cancelled");
  return resolveMarketingVisibility({
    anyOffered,
    projectSetting: ctx.project.client_section_marketing,
    automatic: ctx.settings.showToClients || hasProjectOverride || hasPurchase || ctx.kit.website_status === "published",
  });
}

export type KitClientState = {
  kitId: string;
  projectId: string;
  projectName: string;
  coverId: string | null;
  defaults: MarketingContent;
  overrides: MarketingOverrides;
  media: (MediaIndexItem & { posterUrl: string | null })[];
  tours: TourItem[];
  businessName: string;
  businessLogoUrl: string | null;
  website: {
    status: KitRow["website_status"];
    slug: string;
    publishedAt: string | null;
    hasUnpublishedChanges: boolean;
    liveUrl: string;
    fallbackUrl: string;
    brandedUrl: string | null;
    viewCount: number;
  };
  listingDomain: ListingDomainSummary;
  access: Record<MarketingProduct, ProductAccess>;
  bundlePriceCents: number | null;
  permissions: MarketingPermissions;
  socialAssets: typeof SOCIAL_ASSETS;
  autoPicks: { heroId: string | null; featured: Record<string, string | null>; supporting: string[] };
  projectStatus: string;
};

export function toClientState(ctx: KitContext, actor: MarketingActor): KitClientState {
  const heroId = resolveHeroId(ctx.content, ctx.media, ctx.project.cover_image_id);
  const featured: Record<string, string | null> = {};
  for (const a of SOCIAL_ASSETS) featured[a.key] = socialFeaturedId(a.key, ctx.content, ctx.media, heroId);
  void resolveCarousel;
  return {
    kitId: ctx.kit.id,
    projectId: ctx.project.id,
    projectName: ctx.project.project_name || ctx.content.property.address,
    coverId: ctx.project.cover_image_id,
    defaults: ctx.defaults,
    overrides: ctx.overrides,
    media: ctx.media.map((m) => {
      const row = ctx.mediaRows.find((r) => r.id === m.id);
      return { ...m, posterUrl: m.source === "youtube" && row ? youtubePoster(row) : null };
    }),
    tours: ctx.tours,
    businessName: ctx.businessName,
    businessLogoUrl: ctx.businessLogoUrl,
    website: {
      status: ctx.kit.website_status,
      slug: ctx.kit.site_slug,
      publishedAt: ctx.kit.published_at,
      hasUnpublishedChanges: hasUnpublishedChanges(ctx),
      liveUrl: ctx.urls.live,
      fallbackUrl: ctx.urls.fallback,
      brandedUrl: ctx.urls.branded,
      viewCount: Number(ctx.kit.view_count ?? 0),
    },
    listingDomain: ctx.listingDomain,
    access: ctx.access,
    bundlePriceCents: ctx.settings.bundlePriceCents,
    permissions: permissionsFor(ctx, actor),
    socialAssets: SOCIAL_ASSETS,
    autoPicks: { heroId, featured, supporting: supportingPhotoIds(ctx.media, heroId, 3) },
    projectStatus: ctx.project.status,
  };
}

/** One eligible asset (same rules as loadEligibleMedia) — for image/video routes. */
export async function loadEligibleAsset(
  db: TenantServiceClient,
  projectId: string,
  assetId: string
): Promise<{ project: ProjectRow; row: EligibleMediaRow } | null> {
  const project = await loadProjectRow(db, projectId);
  if (!project) return null;
  const sections = mediaSectionsFromProject(project);
  const { data } = await db.from("media_assets").select(MEDIA_COLUMNS).eq("project_id", projectId).eq("id", assetId).maybeSingle();
  const row = data as EligibleMediaRow | null;
  if (!row || !isClientVisibleMedia(row)) return null;
  if (row.media_type === "photo" ? !sections.photos : row.media_type === "video" ? !sections.videos : true) return null;
  if (row.media_type === "video") {
    const versionMap = await loadVideoReviewVersionMap(db, projectId);
    if (!filterMediaForVideoReviewDelivery([row], versionMap, false).length) return null;
  }
  return { project, row };
}

/** Upload paths this project may show: its own marketing folder, or its client's saved brand profile. */
export async function uploadAllowedForProject(db: TenantServiceClient, projectId: string, clientId: string | null, path: string): Promise<boolean> {
  if (!/^[A-Za-z0-9/_.-]+$/.test(path) || path.includes("..")) return false;
  if (path.startsWith(marketingUploadPrefix(db.businessId, projectId))) return true;
  return (await brandProfileUploads(db, clientId)).includes(path);
}

// ---------------------------------------------------------------------------
// Summary for project pages (read-only; never creates a kit row)
// ---------------------------------------------------------------------------

export type KitSummary = {
  setupRequired: boolean;
  websiteStatus: KitRow["website_status"] | "none";
  liveUrl: string | null;
  access: Record<MarketingProduct, ProductAccess>;
  offerOverrides: ProjectOfferOverrides;
  defaults: Record<MarketingProduct, { mode: "included" | "paid" | "unavailable"; priceCents: number }>;
  bundlePriceCents: number | null;
  photoCount: number;
  showToClients: boolean;
  visibleToClient: boolean;
  /** Per-project toggle (v123): null = automatic. */
  clientVisibility: boolean | null;
  /** At least one add-on is offered on this project (nothing to show otherwise). */
  anyOffered: boolean;
  allowAddToInvoice: boolean;
  listingDomainConnected: boolean;
};

export async function loadKitSummary(businessId: string, projectId: string): Promise<KitSummary | null> {
  const db = await createTenantServiceClient(businessId);
  const project = await loadProjectRow(db, projectId);
  if (!project) return null;
  const appSettings = await getAppSettings(businessId);
  const settings = appSettings.marketingKit;
  const blankAccess = (p: MarketingProduct): ProductAccess => resolveAccess(p, resolveOffer(p, settings, {}), []);
  const defaultsOut = {
    website: { mode: settings.website.offered ? settings.website.mode : ("unavailable" as const), priceCents: settings.website.priceCents },
    social: { mode: settings.social.offered ? settings.social.mode : ("unavailable" as const), priceCents: settings.social.priceCents },
  };
  const { data: kitRow, error } = await db.from("marketing_kits").select(KIT_COLUMNS).eq("project_id", projectId).maybeSingle();
  if (isMarketingSchemaMissing(error)) {
    return {
      setupRequired: true,
      websiteStatus: "none",
      liveUrl: null,
      access: { website: blankAccess("website"), social: blankAccess("social") },
      offerOverrides: {},
      defaults: defaultsOut,
      bundlePriceCents: settings.bundlePriceCents,
      photoCount: 0,
      showToClients: settings.showToClients,
      visibleToClient: false,
      clientVisibility: project.client_section_marketing ?? null,
      anyOffered: false,
      allowAddToInvoice: settings.allowAddToInvoice,
      listingDomainConnected: false,
    };
  }
  const kit = (kitRow as KitRow | null) ?? null;
  const [purchases, media, listingDomain] = await Promise.all([
    kit ? loadPurchases(db, projectId) : Promise.resolve([] as PurchaseRow[]),
    loadEligibleMedia(db, project),
    loadListingDomain(db),
  ]);
  const offerOverrides = sanitizeOfferOverrides(kit?.offer_overrides ?? {});
  const offers = { website: resolveOffer("website", settings, offerOverrides), social: resolveOffer("social", settings, offerOverrides) };
  const access = { website: resolveAccess("website", offers.website, purchases), social: resolveAccess("social", offers.social, purchases) };
  let liveUrl: string | null = null;
  if (kit?.website_status === "published") {
    const { data: biz } = await db.raw.from("businesses").select("slug, custom_domain").eq("id", businessId).maybeSingle();
    liveUrl =
      listingDomain.connected && listingDomain.domain
        ? brandedListingUrl(listingDomain.domain, kit.site_slug)
        : await buildPublicTenantUrlForBusiness(businessId, (biz ?? { slug: "", custom_domain: null }) as { slug: string; custom_domain: string | null }, fallbackListingPath(kit.site_slug));
  }
  const anyOffered = MARKETING_PRODUCTS.some((p) => access[p].state !== "unavailable");
  const visible = resolveMarketingVisibility({
    anyOffered,
    projectSetting: project.client_section_marketing,
    automatic:
      settings.showToClients || Object.keys(offerOverrides).length > 0 || purchases.some((p) => p.status !== "cancelled") || kit?.website_status === "published",
  });
  return {
    setupRequired: false,
    websiteStatus: kit?.website_status ?? "none",
    liveUrl,
    access,
    offerOverrides,
    defaults: defaultsOut,
    bundlePriceCents: settings.bundlePriceCents,
    photoCount: media.filter((m) => m.media_type === "photo").length,
    showToClients: settings.showToClients,
    visibleToClient: visible,
    clientVisibility: project.client_section_marketing ?? null,
    anyOffered,
    allowAddToInvoice: settings.allowAddToInvoice,
    listingDomainConnected: listingDomain.connected,
  };
}
