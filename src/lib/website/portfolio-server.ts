/**
 * Business Website portfolio — server data layer (tenant-scoped).
 *
 * Privacy model (fail closed, re-checked on every request):
 *   - Only projects at the existing Delivered stage are eligible, and only after the business
 *     explicitly publishes them (an entry in settings.portfolio). Delivered alone is never enough.
 *   - Only media the business approved for the entry (entry.mediaIds) can be public, and each item
 *     must STILL be client-visible delivery media (same rules as the Marketing Kit: visible to
 *     clients, section shown, latest video-review version). Hiding a photo takes it offline.
 *   - Nothing else about the project is ever loaded for the public site: no address, client,
 *     invoices, notes or messages. Public titles are written by the business.
 *   - Removing an entry only revokes public access; the project and its media are untouched.
 */
import { getAppSettings, saveAppSettings } from "@/lib/app-settings";
import { normalizeStatus } from "@/lib/constants";
import { isClientVisibleTour } from "@/lib/client-media";
import { normalizeTourUrl } from "@/lib/tour-url";
import { resolveTourEmbedMap } from "@/lib/tour-embed-server";
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from "@/lib/youtube";
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { loadEligibleMedia, loadProjectRow, type EligibleMediaRow } from "@/lib/marketing/server";
import {
  mergePortfolioSettings,
  sanitizeWebsiteText,
  uniquePortfolioSlug,
  WEBSITE_LIMITS,
  isUuidLike,
  type PortfolioEntry,
  type PortfolioSettings,
} from "@/lib/website/settings";
import type { SiteImage, SitePortfolioProject, SiteTour, SiteVideo } from "@/lib/website/view";

type ProjectRow = NonNullable<Awaited<ReturnType<typeof loadProjectRow>>>;

export type PortfolioUrlMode = "public" | "admin";

function imageUrls(mode: PortfolioUrlMode, projectId: string, mediaId: string) {
  const base = mode === "public" ? `/api/public/portfolio/${projectId}/img/${mediaId}` : `/api/marketing/${projectId}/img/${mediaId}`;
  return { url: `${base}?s=large`, mediumUrl: `${base}?s=medium`, thumbUrl: `${base}?s=thumb` };
}

function videoUrl(mode: PortfolioUrlMode, projectId: string, mediaId: string) {
  return mode === "public" ? `/api/public/portfolio/${projectId}/video/${mediaId}` : `/api/marketing/${projectId}/video/${mediaId}`;
}

export function isPortfolioEligibleStatus(status: string | null | undefined): boolean {
  return normalizeStatus(String(status ?? "")) === "delivered";
}

async function loadTours(db: TenantServiceClient, project: ProjectRow): Promise<SiteTour[]> {
  if (project.client_section_tours === false) return [];
  const { data } = await db
    .from("tours")
    .select("id, tour_name, kuula_url, embed_code, thumbnail_url, client_visible")
    .eq("project_id", project.id)
    .order("display_order");
  const rows = ((data ?? []) as { id: string; tour_name: string; kuula_url: string; embed_code?: string | null; thumbnail_url?: string | null; client_visible?: boolean }[])
    .filter((t) => isClientVisibleTour(t) && t.kuula_url && normalizeTourUrl(t.kuula_url));
  const embeds = await resolveTourEmbedMap(rows);
  return rows.map((t) => ({
    id: t.id,
    title: t.tour_name || "Virtual tour",
    url: normalizeTourUrl(t.kuula_url) ?? "",
    embedUrl: embeds[t.id] ?? null,
    thumbnailUrl: t.thumbnail_url?.startsWith("https://") ? t.thumbnail_url : null,
  }));
}

function toImage(mode: PortfolioUrlMode, projectId: string, row: EligibleMediaRow, title: string): SiteImage {
  return {
    id: row.id,
    ...imageUrls(mode, projectId, row.id),
    width: row.width,
    height: row.height,
    // Never the file name (it can contain an address); alt text written by the studio is fine.
    alt: row.alt_text?.trim() || title,
  };
}

function toVideo(mode: PortfolioUrlMode, projectId: string, row: EligibleMediaRow, index: number, title: string): SiteVideo | null {
  const label = index === 0 ? `${title} — video` : `${title} — video ${index + 1}`;
  if (row.media_source === "youtube") {
    const embed = getYouTubeEmbedUrl(row.youtube_url || row.embed_url || "");
    if (!embed) return null;
    return { id: row.id, title: label, kind: "youtube", src: embed, posterUrl: getYouTubeThumbnail(row.youtube_url || row.embed_url || "") };
  }
  if (row.media_source !== "upload" || !row.file_path) return null;
  return {
    id: row.id,
    title: label,
    kind: "file",
    src: videoUrl(mode, projectId, row.id),
    posterUrl: row.thumbnail_url ? imageUrls(mode, projectId, row.id).mediumUrl : null,
  };
}

export type ResolvedPortfolioEntry = {
  entry: PortfolioEntry;
  project: ProjectRow;
  /** Approved + still-eligible rows, in the business's chosen order. */
  rows: EligibleMediaRow[];
  tours: SiteTour[];
};

/** Re-check one entry against the live project (null = must not be public). */
export async function resolvePortfolioEntry(db: TenantServiceClient, entry: PortfolioEntry): Promise<ResolvedPortfolioEntry | null> {
  const project = await loadProjectRow(db, entry.projectId);
  if (!project || !isPortfolioEligibleStatus(project.status)) return null;
  const eligible = await loadEligibleMedia(db, project);
  const byId = new Map(eligible.map((r) => [r.id, r]));
  const rows = entry.mediaIds.map((id) => byId.get(id)).filter((r): r is EligibleMediaRow => Boolean(r));
  const allowedTours = new Set(entry.tourIds);
  const tours = entry.tourIds.length ? (await loadTours(db, project)).filter((t) => allowedTours.has(t.id)) : [];
  if (!rows.length && !tours.length) return null;
  return { entry, project, rows, tours };
}

export function toSiteProject(resolved: ResolvedPortfolioEntry, mode: PortfolioUrlMode): SitePortfolioProject {
  const { entry, rows, tours } = resolved;
  const pid = entry.projectId;
  const photos = rows.filter((r) => r.media_type === "photo").map((r) => toImage(mode, pid, r, entry.title));
  const videos = rows
    .filter((r) => r.media_type === "video")
    .map((r, i) => toVideo(mode, pid, r, i, entry.title))
    .filter((v): v is SiteVideo => Boolean(v));
  const coverRow = rows.find((r) => r.id === entry.coverId && r.media_type === "photo") ?? rows.find((r) => r.media_type === "photo") ?? null;
  let cover = coverRow ? toImage(mode, pid, coverRow, entry.title) : null;
  if (!cover && videos[0]?.posterUrl) {
    cover = { id: videos[0].id, url: videos[0].posterUrl, mediumUrl: videos[0].posterUrl, thumbUrl: videos[0].posterUrl, width: null, height: null, alt: entry.title };
  }
  return {
    projectId: pid,
    slug: entry.slug,
    title: entry.title,
    category: entry.category,
    description: entry.description,
    featured: entry.featured,
    publishedAt: entry.publishedAt,
    cover,
    photos,
    videos,
    tours,
  };
}

/** Every published, still-eligible portfolio project for the public site or the editor preview. */
export async function loadSitePortfolio(businessId: string, mode: PortfolioUrlMode, portfolio?: PortfolioSettings): Promise<SitePortfolioProject[]> {
  const settings = portfolio ?? (await getAppSettings(businessId)).portfolio;
  if (!settings.entries.length) return [];
  const db = await createTenantServiceClient(businessId);
  const resolved = await Promise.all(settings.entries.map((e) => resolvePortfolioEntry(db, e).catch(() => null)));
  return resolved.filter((r): r is ResolvedPortfolioEntry => Boolean(r)).map((r) => toSiteProject(r, mode));
}

/** Short cache for the public image/video routes (one page view = many image requests). */
const entryCache = new Map<string, { at: number; value: ResolvedPortfolioEntry | null }>();
const ENTRY_TTL_MS = 30_000;

export function invalidatePortfolioCache(businessId: string) {
  for (const key of entryCache.keys()) if (key.startsWith(`${businessId}:`)) entryCache.delete(key);
}

export async function loadPublicPortfolioEntry(businessId: string, projectId: string): Promise<ResolvedPortfolioEntry | null> {
  if (!isUuidLike(projectId)) return null;
  const key = `${businessId}:${projectId}`;
  const hit = entryCache.get(key);
  if (hit && Date.now() - hit.at < ENTRY_TTL_MS) return hit.value;
  const settings = await getAppSettings(businessId);
  const entry = settings.portfolio.entries.find((e) => e.projectId === projectId) ?? null;
  const db = await createTenantServiceClient(businessId);
  const value = entry ? await resolvePortfolioEntry(db, entry) : null;
  if (entryCache.size > 500) entryCache.clear();
  entryCache.set(key, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------------------
// Editor (admin) data
// ---------------------------------------------------------------------------

export type PortfolioCandidate = {
  projectId: string;
  /** Internal name — shown to the business only, never public. */
  internalName: string;
  serviceType: string;
  deliveredAt: string | null;
  status: "published" | "suggested" | "dismissed";
  /** Published but no longer eligible (stage changed / media hidden). */
  offline: boolean;
  coverThumbUrl: string | null;
  photoCount: number;
  videoCount: number;
  tourCount: number;
  entry: PortfolioEntry | null;
};

type CandidateProjectRow = {
  id: string;
  project_name: string | null;
  property_address: string | null;
  service_type: string | null;
  status: string;
  cover_image_id: string | null;
  delivery_date: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export async function loadPortfolioCandidates(businessId: string): Promise<PortfolioCandidate[]> {
  const settings = await getAppSettings(businessId);
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("projects")
    .select("id, project_name, property_address, service_type, status, cover_image_id, delivery_date, updated_at, deleted_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as CandidateProjectRow[];
  const entries = new Map(settings.portfolio.entries.map((e) => [e.projectId, e]));
  const dismissed = new Set(settings.portfolio.dismissedProjectIds);

  const relevant = rows.filter((p) => isPortfolioEligibleStatus(p.status) || entries.has(p.id)).slice(0, 120);
  const counts = await mediaCounts(db, relevant.map((p) => p.id));

  const out: PortfolioCandidate[] = relevant.map((p) => {
    const entry = entries.get(p.id) ?? null;
    const c = counts.get(p.id) ?? { photos: 0, videos: 0, firstPhoto: null };
    const coverId = entry?.coverId ?? p.cover_image_id ?? c.firstPhoto;
    return {
      projectId: p.id,
      internalName: (p.project_name || p.property_address || "Untitled project").trim(),
      serviceType: (p.service_type || "").trim(),
      deliveredAt: p.delivery_date ?? p.updated_at ?? null,
      status: entry ? "published" : dismissed.has(p.id) ? "dismissed" : "suggested",
      offline: Boolean(entry) && !isPortfolioEligibleStatus(p.status),
      coverThumbUrl: coverId ? `/api/marketing/${p.id}/img/${coverId}?s=thumb` : null,
      photoCount: c.photos,
      videoCount: c.videos,
      tourCount: 0,
      entry,
    };
  });
  // Entries whose project was deleted still show so the business can remove them.
  for (const e of settings.portfolio.entries) {
    if (!out.some((c) => c.projectId === e.projectId)) {
      out.push({
        projectId: e.projectId,
        internalName: e.title,
        serviceType: "",
        deliveredAt: null,
        status: "published",
        offline: true,
        coverThumbUrl: null,
        photoCount: 0,
        videoCount: 0,
        tourCount: 0,
        entry: e,
      });
    }
  }
  return out;
}

async function mediaCounts(db: TenantServiceClient, projectIds: string[]) {
  const out = new Map<string, { photos: number; videos: number; firstPhoto: string | null }>();
  if (!projectIds.length) return out;
  const { data } = await db
    .from("media_assets")
    .select("id, project_id, media_type, visibility, display_order")
    .in("project_id", projectIds)
    .in("media_type", ["photo", "video"])
    .order("display_order", { ascending: true })
    .limit(5000);
  for (const r of (data ?? []) as { id: string; project_id: string; media_type: string; visibility: string | null }[]) {
    if (r.visibility === "admin") continue;
    const c = out.get(r.project_id) ?? { photos: 0, videos: 0, firstPhoto: null };
    if (r.media_type === "photo") {
      c.photos += 1;
      if (!c.firstPhoto) c.firstPhoto = r.id;
    } else c.videos += 1;
    out.set(r.project_id, c);
  }
  return out;
}

export type PortfolioMediaChoice = {
  id: string;
  type: "photo" | "video";
  thumbUrl: string | null;
  label: string;
};

/** Everything that COULD be public for one delivered project (client-visible delivery media). */
export async function loadProjectMediaChoices(businessId: string, projectId: string): Promise<{
  project: { id: string; internalName: string; serviceType: string; coverImageId: string | null };
  media: PortfolioMediaChoice[];
  tours: SiteTour[];
} | null> {
  if (!isUuidLike(projectId)) return null;
  const db = await createTenantServiceClient(businessId);
  const project = await loadProjectRow(db, projectId);
  if (!project || !isPortfolioEligibleStatus(project.status)) return null;
  const rows = await loadEligibleMedia(db, project);
  const tours = await loadTours(db, project);
  const { data: svc } = await db.from("projects").select("service_type").eq("id", projectId).maybeSingle();
  return {
    project: {
      id: project.id,
      internalName: (project.project_name || project.property_address || "Untitled project").trim(),
      serviceType: ((svc?.service_type as string | null) ?? "").trim(),
      coverImageId: project.cover_image_id,
    },
    media: rows.map((r, i) => ({
      id: r.id,
      type: r.media_type === "video" ? "video" : "photo",
      thumbUrl:
        r.media_type === "photo" || r.thumbnail_url
          ? `/api/marketing/${projectId}/img/${r.id}?s=thumb`
          : r.media_source === "youtube"
            ? getYouTubeThumbnail(r.youtube_url || r.embed_url || "")
            : null,
      label: r.media_type === "video" ? `Video ${i + 1}` : `Photo ${i + 1}`,
    })),
    tours,
  };
}

// ---------------------------------------------------------------------------
// Mutations (explicit business actions only)
// ---------------------------------------------------------------------------

export class PortfolioError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "PortfolioError";
  }
}

async function writePortfolio(businessId: string, actorId: string, next: PortfolioSettings) {
  const saved = await saveAppSettings({ portfolio: next }, actorId, businessId, { allowPortfolioWrite: true });
  invalidatePortfolioCache(businessId);
  return saved.portfolio;
}

export type PortfolioPublishInput = {
  projectId: unknown;
  title: unknown;
  category?: unknown;
  description?: unknown;
  mediaIds: unknown;
  coverId?: unknown;
  tourIds?: unknown;
  featured?: unknown;
};

/** Publish (or update) one project. Media must be a subset of what is eligible right now. */
export async function publishPortfolioEntry(businessId: string, actorId: string, input: PortfolioPublishInput): Promise<PortfolioSettings> {
  if (!isUuidLike(input.projectId)) throw new PortfolioError("Choose a project.");
  const projectId = input.projectId;
  const choices = await loadProjectMediaChoices(businessId, projectId);
  if (!choices) throw new PortfolioError("Only Delivered projects can be added to your portfolio.", 409);
  const allowed = new Set(choices.media.map((m) => m.id));
  const requested = Array.isArray(input.mediaIds) ? input.mediaIds.filter(isUuidLike) : [];
  const mediaIds = Array.from(new Set(requested.filter((id) => allowed.has(id)))).slice(0, WEBSITE_LIMITS.portfolioMediaMax);
  const tourAllowed = new Set(choices.tours.map((t) => t.id));
  const tourIds = Array.isArray(input.tourIds) ? input.tourIds.filter((id): id is string => isUuidLike(id) && tourAllowed.has(id)) : [];
  if (!mediaIds.length && !tourIds.length) throw new PortfolioError("Pick at least one photo, video or tour to show.");
  const title = sanitizeWebsiteText(input.title, WEBSITE_LIMITS.portfolioTitle);
  if (!title) throw new PortfolioError("Give the project a public title.");
  const photoIds = mediaIds.filter((id) => choices.media.find((m) => m.id === id)?.type === "photo");
  const coverId = isUuidLike(input.coverId) && photoIds.includes(input.coverId) ? input.coverId : photoIds[0] ?? null;

  const settings = await getAppSettings(businessId);
  const current = mergePortfolioSettings(settings.portfolio);
  const existing = current.entries.find((e) => e.projectId === projectId) ?? null;
  const others = current.entries.filter((e) => e.projectId !== projectId);
  const taken = others.flatMap((e) => [e.slug, ...e.previousSlugs]);
  let slug = existing?.slug ?? uniquePortfolioSlug(title, taken);
  let previousSlugs = existing?.previousSlugs ?? [];
  if (existing && existing.title !== title) {
    const nextSlug = uniquePortfolioSlug(title, taken);
    if (nextSlug !== existing.slug) {
      previousSlugs = Array.from(new Set([existing.slug, ...previousSlugs])).slice(0, 10);
      slug = nextSlug;
    }
  }
  const entry: PortfolioEntry = {
    projectId,
    slug,
    previousSlugs: previousSlugs.filter((s) => s !== slug),
    title,
    category: sanitizeWebsiteText(input.category, WEBSITE_LIMITS.portfolioCategory),
    description: sanitizeWebsiteText(input.description, WEBSITE_LIMITS.portfolioDescription),
    mediaIds,
    coverId,
    tourIds,
    featured: input.featured === undefined ? existing?.featured ?? others.filter((e) => e.featured).length < 3 : input.featured === true,
    publishedAt: existing?.publishedAt ?? new Date().toISOString(),
  };
  return writePortfolio(businessId, actorId, {
    entries: existing ? current.entries.map((e) => (e.projectId === projectId ? entry : e)) : [entry, ...current.entries],
    dismissedProjectIds: current.dismissedProjectIds.filter((id) => id !== projectId),
  });
}

export async function updatePortfolioFlags(
  businessId: string,
  actorId: string,
  input: { action: "remove" | "feature" | "unfeature" | "dismiss" | "restore"; projectId: unknown }
): Promise<PortfolioSettings> {
  if (!isUuidLike(input.projectId)) throw new PortfolioError("Choose a project.");
  const projectId = input.projectId;
  const settings = await getAppSettings(businessId);
  const current = mergePortfolioSettings(settings.portfolio);
  let next: PortfolioSettings = current;
  switch (input.action) {
    case "remove":
      next = { ...current, entries: current.entries.filter((e) => e.projectId !== projectId) };
      break;
    case "feature":
    case "unfeature":
      next = {
        ...current,
        entries: current.entries.map((e) => (e.projectId === projectId ? { ...e, featured: input.action === "feature" } : e)),
      };
      break;
    case "dismiss":
      next = { ...current, dismissedProjectIds: Array.from(new Set([...current.dismissedProjectIds, projectId])) };
      break;
    case "restore":
      next = { ...current, dismissedProjectIds: current.dismissedProjectIds.filter((id) => id !== projectId) };
      break;
  }
  return writePortfolio(businessId, actorId, next);
}
