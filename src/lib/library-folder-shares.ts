/**
 * What a Media Library folder share (or a single-item share) exposes — evaluated live on
 * every request, never stored.
 *
 * A library-folder share grants exactly the folder's current members that are safe to show
 * outside the business:
 *   - photos / videos / files: visibility must be client-visible (not internal-only);
 *   - tours / 3D models: client_visible must not be false;
 *   - the item's project (if any) must not be deleted, and its client media section for that
 *     type must be on.
 * It never grants the project, the client, or any other media.
 *
 * Downloads: the share's allow_download is necessary but not sufficient. Each item still obeys
 * its project's client download rule (business "require Delivered" setting + per-project
 * override, v80/v124), so adding an unpaid project's photo to a shared folder never unlocks
 * its originals. Unassigned media (no project) follows the share setting alone.
 *
 * Single-item shares (videos, files, tours, 3D models) are an explicit, per-asset decision by
 * the business — like v104 photo shares they don't apply the folder visibility filter, but
 * they do apply the same project download rule.
 */
import { getAppSettings } from "@/lib/app-settings";
import { isClientVisibleMedia } from "@/lib/client-media";
import { normalizeStatus } from "@/lib/constants";
import { effectiveRequireDeliveredForDownloads, resolveProjectDownloadAllowed } from "@/lib/deliverables";
import { loadLibraryFolderMembers } from "@/lib/library-folders";
import type { ResolvedMediaShare } from "@/lib/media-shares";
import { clientMayAccessMediaSection, isMediaSectionVisibleForClient, mediaSectionsFromProject } from "@/lib/project-media-sections";
import type { SharedMediaItem, SharedMediaKind } from "@/lib/shared-media-types";
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTourEmbedUrl } from "@/lib/tour-url";
import type { MediaVisibility } from "@/lib/types";

/** Hard cap on what one shared-folder page renders (the grid lazy-loads thumbnails). */
export const SHARED_FOLDER_MAX_ITEMS = 2000;

const MEDIA_COLUMNS =
  "id, project_id, media_type, media_source, title, file_name, file_path, file_size, mime_type, thumbnail_url, width, height, duration_seconds, visibility, embed_url, business_id, created_at";

type MediaRow = {
  id: string;
  project_id: string | null;
  media_type: string;
  media_source: string | null;
  title: string | null;
  file_name: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  visibility: string | null;
  embed_url: string | null;
  business_id: string;
  created_at: string;
};

type TourRow = { id: string; project_id: string | null; tour_name: string | null; kuula_url: string | null; client_visible: boolean | null };
type ModelRow = { id: string; project_id: string | null; title: string | null; embed_url: string | null; client_visible: boolean | null };

type ProjectRules = {
  live: boolean;
  status: string;
  downloadAccess: unknown;
  sections: ReturnType<typeof mediaSectionsFromProject>;
};

/** Server-only detail for serving bytes. Never sent to the browser. */
export type SharedItemSource = {
  item: SharedMediaItem;
  id: string;
  businessId: string;
  filePath: string | null;
  thumbnailPath: string | null;
  mediaSource: string | null;
  mimeType: string | null;
  fileName: string | null;
  mediaType: string;
};

const IN_CHUNK = 150;

async function loadProjectRules(db: TenantServiceClient, ids: string[]): Promise<Map<string, ProjectRules>> {
  const out = new Map<string, ProjectRules>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const part = unique.slice(i, i + IN_CHUNK);
    let { data, error }: { data: Record<string, unknown>[] | null; error: { message: string } | null } = await db
      .from("projects")
      .select(
        "id, deleted_at, status, client_download_access, client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
      )
      .in("id", part);
    if (error) {
      // Before v124 (no client_download_access column): same rules with the business default.
      ({ data, error } = await db
        .from("projects")
        .select(
          "id, deleted_at, status, client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
        )
        .in("id", part));
    }
    for (const p of (data ?? []) as Record<string, unknown>[]) {
      out.set(p.id as string, {
        live: !p.deleted_at,
        status: normalizeStatus((p.status as string) ?? "new_request"),
        downloadAccess: p.client_download_access ?? null,
        sections: mediaSectionsFromProject(p),
      });
    }
  }
  return out;
}

function isPdf(mime: string | null, name: string | null): boolean {
  return mime === "application/pdf" || Boolean(name && /\.pdf$/i.test(name));
}

type Context = {
  share: ResolvedMediaShare;
  projects: Map<string, ProjectRules>;
  businessRequiresDelivered: boolean;
  /** Folder shares filter to client-visible items; single-item shares are explicit. */
  applyVisibility: boolean;
};

function downloadState(ctx: Context, projectId: string | null, hasFile: boolean) {
  if (!ctx.share.allowDownload || !hasFile) return { canDownload: false, downloadLocked: false };
  if (!projectId) return { canDownload: true, downloadLocked: false };
  const p = ctx.projects.get(projectId);
  if (!p) return { canDownload: false, downloadLocked: true };
  const allowed = resolveProjectDownloadAllowed({
    projectStatus: p.status,
    isAdmin: false,
    requireDeliveredForDownloads: effectiveRequireDeliveredForDownloads(ctx.businessRequiresDelivered, p.downloadAccess),
  });
  return { canDownload: allowed, downloadLocked: !allowed };
}

function projectAllows(ctx: Context, projectId: string | null, section: (rules: ProjectRules) => boolean): boolean {
  if (!projectId) return true;
  const p = ctx.projects.get(projectId);
  if (!p || !p.live) return false;
  return ctx.applyVisibility ? section(p) : true;
}

function fromMedia(ctx: Context, row: MediaRow): SharedItemSource | null {
  const kind = row.media_type as SharedMediaKind;
  if (kind !== "photo" && kind !== "video" && kind !== "document") return null;
  if (ctx.applyVisibility && !isClientVisibleMedia({ visibility: (row.visibility ?? undefined) as MediaVisibility | undefined })) return null;
  if (!projectAllows(ctx, row.project_id, (p) => clientMayAccessMediaSection(p.sections, row.media_type, false))) return null;
  const youtube = row.media_source === "youtube";
  const hasFile = Boolean(row.file_path) && !youtube && row.media_source !== "external";
  if (!hasFile && !(youtube && row.embed_url)) return null;
  const dl = downloadState(ctx, row.project_id, hasFile);
  return {
    id: row.id,
    businessId: row.business_id,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_url,
    mediaSource: row.media_source,
    mimeType: row.mime_type,
    fileName: row.file_name,
    mediaType: row.media_type,
    item: {
      key: `${kind}:${row.id}`,
      kind,
      title: row.title || row.file_name || (kind === "photo" ? "Photo" : kind === "video" ? "Video" : "File"),
      width: row.width,
      height: row.height,
      durationSeconds: row.duration_seconds,
      fileSize: hasFile ? row.file_size : null,
      hasFile,
      ...dl,
      embedUrl: youtube ? row.embed_url : null,
      hasPoster: kind === "video" && Boolean(row.thumbnail_url),
      isPdf: kind === "document" && isPdf(row.mime_type, row.file_name),
    },
  };
}

function fromTour(ctx: Context, row: TourRow, businessId: string): SharedItemSource | null {
  if (ctx.applyVisibility && row.client_visible === false) return null;
  if (!projectAllows(ctx, row.project_id, (p) => isMediaSectionVisibleForClient(p.sections, "tours"))) return null;
  const embedUrl = getTourEmbedUrl(row.kuula_url);
  if (!embedUrl) return null;
  return {
    id: row.id,
    businessId,
    filePath: null,
    thumbnailPath: null,
    mediaSource: "kuula",
    mimeType: null,
    fileName: null,
    mediaType: "tour",
    item: {
      key: `tour:${row.id}`,
      kind: "tour",
      title: row.tour_name || "360° tour",
      width: null,
      height: null,
      durationSeconds: null,
      fileSize: null,
      hasFile: false,
      canDownload: false,
      downloadLocked: false,
      embedUrl,
      hasPoster: false,
      isPdf: false,
    },
  };
}

function fromModel(ctx: Context, row: ModelRow, businessId: string): SharedItemSource | null {
  if (ctx.applyVisibility && row.client_visible === false) return null;
  if (!projectAllows(ctx, row.project_id, (p) => isMediaSectionVisibleForClient(p.sections, "models"))) return null;
  if (!row.embed_url || !/^https:\/\//i.test(row.embed_url)) return null;
  return {
    id: row.id,
    businessId,
    filePath: null,
    thumbnailPath: null,
    mediaSource: "external",
    mimeType: null,
    fileName: null,
    mediaType: "model",
    item: {
      key: `model:${row.id}`,
      kind: "model",
      title: row.title || "3D model",
      width: null,
      height: null,
      durationSeconds: null,
      fileSize: null,
      hasFile: false,
      canDownload: false,
      downloadLocked: false,
      embedUrl: row.embed_url,
      hasPoster: false,
      isPdf: false,
    },
  };
}

async function loadRows(db: TenantServiceClient, ids: { media: string[]; tour: string[]; model: string[] }) {
  const media: MediaRow[] = [];
  const tours: TourRow[] = [];
  const models: ModelRow[] = [];
  for (let i = 0; i < ids.media.length; i += IN_CHUNK) {
    const { data } = await db.from("media_assets").select(MEDIA_COLUMNS).in("id", ids.media.slice(i, i + IN_CHUNK));
    media.push(...((data ?? []) as MediaRow[]));
  }
  for (let i = 0; i < ids.tour.length; i += IN_CHUNK) {
    const { data } = await db
      .from("tours")
      .select("id, project_id, tour_name, kuula_url, client_visible")
      .in("id", ids.tour.slice(i, i + IN_CHUNK));
    tours.push(...((data ?? []) as TourRow[]));
  }
  for (let i = 0; i < ids.model.length; i += IN_CHUNK) {
    const { data, error } = await db
      .from("project_3d_models")
      .select("id, project_id, title, embed_url, client_visible")
      .in("id", ids.model.slice(i, i + IN_CHUNK));
    if (!error) models.push(...((data ?? []) as ModelRow[]));
  }
  return { media, tours, models };
}

async function buildContext(db: TenantServiceClient, share: ResolvedMediaShare, projectIds: string[], applyVisibility: boolean): Promise<Context> {
  const [projects, settings] = await Promise.all([loadProjectRules(db, projectIds), getAppSettings(share.businessId)]);
  return {
    share,
    projects,
    businessRequiresDelivered: settings.payments.requireDeliveredForDownloads,
    applyVisibility,
  };
}

async function sourcesFor(
  share: ResolvedMediaShare,
  ids: { media: string[]; tour: string[]; model: string[] },
  applyVisibility: boolean
): Promise<Map<string, SharedItemSource>> {
  const db = await createTenantServiceClient(share.businessId);
  const rows = await loadRows(db, ids);
  const projectIds = [
    ...rows.media.map((r) => r.project_id),
    ...rows.tours.map((r) => r.project_id),
    ...rows.models.map((r) => r.project_id),
  ].filter((id): id is string => Boolean(id));
  const ctx = await buildContext(db, share, projectIds, applyVisibility);
  const out = new Map<string, SharedItemSource>();
  for (const r of rows.media) {
    const s = fromMedia(ctx, r);
    if (s) out.set(s.item.key, s);
  }
  for (const r of rows.tours) {
    const s = fromTour(ctx, r, share.businessId);
    if (s) out.set(s.item.key, s);
  }
  for (const r of rows.models) {
    const s = fromModel(ctx, r, share.businessId);
    if (s) out.set(s.item.key, s);
  }
  return out;
}

/** The items a library-folder share shows right now, newest-added first. */
export async function listSharedLibraryFolderItems(share: ResolvedMediaShare): Promise<SharedMediaItem[]> {
  if (share.subject.kind !== "library_folder") return [];
  const members = await loadLibraryFolderMembers(share.businessId, share.subject.libraryFolder.id);
  const order: { key: string; at: string }[] = [];
  const ids = { media: [] as string[], tour: [] as string[], model: [] as string[] };
  for (const [id, at] of members.media) {
    ids.media.push(id);
    order.push({ key: id, at });
  }
  for (const [id, at] of members.tour) {
    ids.tour.push(id);
    order.push({ key: `tour:${id}`, at });
  }
  for (const [id, at] of members.model) {
    ids.model.push(id);
    order.push({ key: `model:${id}`, at });
  }
  const sources = await sourcesFor(share, ids, true);
  const byRawKey = new Map<string, SharedItemSource>();
  for (const s of sources.values()) {
    byRawKey.set(s.item.kind === "tour" || s.item.kind === "model" ? s.item.key : s.id, s);
  }
  order.sort((a, b) => b.at.localeCompare(a.at));
  const out: SharedMediaItem[] = [];
  for (const o of order) {
    const s = byRawKey.get(o.key);
    if (s) out.push(s.item);
    if (out.length >= SHARED_FOLDER_MAX_ITEMS) break;
  }
  return out;
}

function parseKey(key: string | null): { kind: SharedMediaKind; id: string } | null {
  if (!key) return null;
  const i = key.indexOf(":");
  if (i < 0) return null;
  const kind = key.slice(0, i) as SharedMediaKind;
  const id = key.slice(i + 1);
  if (!["photo", "video", "document", "tour", "model"].includes(kind)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return { kind, id };
}

/**
 * The single item a request may receive through this share, or null. A library-folder share
 * yields `key` only while it is a member and passes the visibility rules; an item share only
 * ever yields its own item.
 */
export async function resolveSharedLibraryItem(share: ResolvedMediaShare, key: string | null): Promise<SharedItemSource | null> {
  const { subject } = share;
  if (subject.kind === "item") {
    const own = `${subject.item.kind}:${subject.item.id}`;
    if (key && key !== own) return null;
    const ids =
      subject.item.kind === "tour"
        ? { media: [], tour: [subject.item.id], model: [] }
        : subject.item.kind === "model"
          ? { media: [], tour: [], model: [subject.item.id] }
          : { media: [subject.item.id], tour: [], model: [] };
    const sources = await sourcesFor(share, ids, false);
    return sources.get(own) ?? null;
  }
  if (subject.kind !== "library_folder") return null;
  const ref = parseKey(key);
  if (!ref) return null;
  const db = await createTenantServiceClient(share.businessId);
  const column = ref.kind === "tour" ? "tour_id" : ref.kind === "model" ? "model_id" : "media_asset_id";
  const { data: member } = await db
    .from("library_folder_items")
    .select("id")
    .eq("folder_id", subject.libraryFolder.id)
    .eq(column, ref.id)
    .maybeSingle();
  if (!member) return null;
  const ids =
    ref.kind === "tour"
      ? { media: [], tour: [ref.id], model: [] }
      : ref.kind === "model"
        ? { media: [], tour: [], model: [ref.id] }
        : { media: [ref.id], tour: [], model: [] };
  const sources = await sourcesFor(share, ids, true);
  const found = sources.get(`${ref.kind}:${ref.id}`);
  return found ?? null;
}

/** Item-share landing data (single video / file / tour / 3D model). */
export async function getSharedItem(share: ResolvedMediaShare): Promise<SharedMediaItem | null> {
  const src = await resolveSharedLibraryItem(share, null);
  return src?.item ?? null;
}
