import { projectServiceNames } from "@/lib/project-service-names";
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import type { MediaAsset, Project3dModel, Tour } from "@/lib/types";
import { loadLibraryFolderMembers, type LibraryFolderMembers } from "@/lib/library-folders";

export type LibraryAssetKind = "photo" | "video" | "document" | "tour" | "model";

/** Kinds that are stored files (downloadable / deletable from the library). */
export const LIBRARY_FILE_KINDS: LibraryAssetKind[] = ["photo", "video", "document"];
/** Kinds that are external links (360° tours, 3D model embeds). */
export const LIBRARY_LINK_KINDS: LibraryAssetKind[] = ["tour", "model"];
export const LIBRARY_ASSET_KINDS: LibraryAssetKind[] = [...LIBRARY_FILE_KINDS, ...LIBRARY_LINK_KINDS];

const MEDIA_TABLE_KINDS = new Set<string>(LIBRARY_FILE_KINDS);

export interface LibraryAsset {
  id: string;
  kind: LibraryAssetKind;
  title: string;
  file_name: string | null;
  thumbnail_url: string | null;
  project_id: string | null;
  project_name: string;
  /** Photo folder inside the project; null = General Photos (or not a project photo). */
  folder_id: string | null;
  folder_name: string | null;
  project_status: string;
  service_type: string;
  property_address: string;
  property_type: string | null;
  client_id: string | null;
  client_name: string;
  client_company: string | null;
  property_id: string | null;
  media_source: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  download_count: number;
  is_favorite: boolean;
  tags: string[];
  description: string | null;
  alt_text: string | null;
  notes: string | null;
  created_at: string;
  captured_at: string | null;
  is_cover: boolean;
  mime_type: string | null;
  youtube_url: string | null;
  embed_url: string | null;
  kuula_url: string | null;
  visibility: string | null;
  downloadable: boolean | null;
  camera_model: string | null;
  orientation: string | null;
  version: number;
  /** True when a stored file backs this asset (not YouTube / Kuula / external embeds). */
  has_file: boolean;
  /** Set only when the query is scoped to a Media Library folder: when it was added there. */
  folder_added_at?: string | null;
}

/** Sort orders for the library grid. "added" applies inside a Media Library folder. */
export type LibrarySort = "newest" | "oldest" | "name" | "size" | "added";
export const LIBRARY_SORTS: LibrarySort[] = ["newest", "oldest", "name", "size", "added"];

export interface LibraryFilters {
  q?: string;
  /** Asset kinds (OR within the list). Empty / undefined = all kinds. */
  types?: string[];
  /** Project service types (OR within the list). */
  services?: string[];
  clientIds?: string[];
  propertyIds?: string[];
  /** Legacy single-value preset ("today" | "7d" | "30d" | "year"). */
  datePreset?: string;
  /** ISO timestamps, inclusive. Take precedence over datePreset. */
  dateFrom?: string;
  dateTo?: string;
  /** Legacy single property filter (related assets). */
  propertyId?: string;
  favoritesOnly?: boolean;
  page?: number;
  limit?: number;
  /** Staff scope: "all" or explicit project ids. Empty → no rows. */
  projectIds?: "all" | string[];
  /** Restrict to the members of one Media Library folder (v126). */
  libraryFolderId?: string;
  /** Default "newest" (upload date, newest first). */
  sort?: LibrarySort;
}

export interface LibraryResult {
  assets: LibraryAsset[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** Matching asset count per kind (whole result set, not just this page). */
  kindCounts: Partial<Record<LibraryAssetKind, number>>;
}

export interface MediaAssetEvent {
  id: string;
  event_type: string;
  description: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface MediaDownloadRecord {
  id: string;
  downloaded_by_email: string | null;
  created_at: string;
}

const DEFAULT_LIMIT = 48;

export async function logMediaEvent(options: {
  businessId: string;
  mediaAssetId: string;
  projectId?: string | null;
  userId?: string | null;
  eventType: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = await createTenantServiceClient(options.businessId);
    await db.from("media_asset_events").insert({
      media_asset_id: options.mediaAssetId,
      project_id: options.projectId ?? null,
      user_id: options.userId ?? null,
      event_type: options.eventType,
      description: options.description ?? null,
      metadata: options.metadata ?? null,
    });
  } catch {
    // non-blocking
  }
}

export async function trackMediaDownload(options: {
  businessId: string;
  mediaAssetId: string;
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
}) {
  try {
    const db = await createTenantServiceClient(options.businessId);
    await db.from("media_downloads").insert({
      media_asset_id: options.mediaAssetId,
      user_id: options.userId ?? null,
      downloaded_by_email: options.email ?? null,
      ip_address: options.ipAddress ?? null,
    });
    const { data } = await db
      .from("media_assets")
      .select("download_count")
      .eq("id", options.mediaAssetId)
      .single();
    await db
      .from("media_assets")
      .update({
        download_count: (data?.download_count ?? 0) + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq("id", options.mediaAssetId);
  } catch {
    // non-blocking
  }
}

function dateRangeFromPreset(preset?: string): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString();
  if (!preset || preset === "all") return {};
  if (preset === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to };
  }
  if (preset === "7d") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to };
  }
  if (preset === "30d") {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to };
  }
  if (preset === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { from: start.toISOString(), to };
  }
  return {};
}

function matchesSearch(asset: LibraryAsset, q: string): boolean {
  const hay = [
    asset.title,
    asset.file_name,
    asset.description,
    asset.notes,
    asset.property_address,
    asset.client_name,
    asset.client_company,
    asset.project_name,
    asset.service_type,
    ...asset.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

type ProjectRow = {
  id: string;
  project_name: string;
  service_type: string;
  status: string;
  property_address: string;
  cover_image_id: string | null;
  client_id: string | null;
  property_id: string | null;
  clients: { id: string; name: string; full_name: string | null; company: string | null } | { id: string; name: string; full_name: string | null; company: string | null }[] | null;
  properties: { property_type: string | null } | { property_type: string | null }[] | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function loadProjectMap(
  db: TenantServiceClient,
  projectIds: string[]
): Promise<Map<string, ProjectRow>> {
  const map = new Map<string, ProjectRow>();
  if (!projectIds.length) return map;

  const unique = [...new Set(projectIds)];
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await db
      .from("projects")
      .select(
        "id, project_name, service_type, status, property_address, cover_image_id, client_id, property_id, clients(id, name, full_name, company), properties(property_type)"
      )
      .in("id", chunk);

    if (error) {
      console.error("[media-library] projects batch failed:", error.message);
      continue;
    }
    (data ?? []).forEach((row) => map.set(row.id, row as ProjectRow));
  }
  return map;
}

async function attachFolderNames(
  db: TenantServiceClient,
  assets: LibraryAsset[]
): Promise<LibraryAsset[]> {
  const ids = [...new Set(assets.map((a) => a.folder_id).filter((id): id is string => !!id))];
  if (!ids.length) return assets;
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db
      .from("media_folders")
      .select("id, name")
      .in("id", ids.slice(i, i + 100));
    (data ?? []).forEach((f) => names.set(f.id as string, f.name as string));
  }
  return assets.map((a) =>
    a.folder_id ? { ...a, folder_name: names.get(a.folder_id) ?? null } : a
  );
}

/** Unassigned rows (no project) carry client_id directly — fill in the client's display name. */
async function attachUnassignedClientNames(
  db: TenantServiceClient,
  assets: LibraryAsset[]
): Promise<LibraryAsset[]> {
  const ids = [
    ...new Set(
      assets
        .filter((a) => !a.project_id && a.client_id && a.client_name === "—")
        .map((a) => a.client_id as string)
    ),
  ];
  if (!ids.length) return assets;
  const names = new Map<string, { name: string; company: string | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db
      .from("clients")
      .select("id, name, full_name, company")
      .in("id", ids.slice(i, i + 100));
    (data ?? []).forEach((c) =>
      names.set(c.id as string, {
        name: (c.full_name as string | null) || (c.name as string) || "—",
        company: (c.company as string | null) ?? null,
      })
    );
  }
  return assets.map((a) => {
    if (a.project_id || !a.client_id) return a;
    const hit = names.get(a.client_id);
    return hit ? { ...a, client_name: hit.name, client_company: hit.company } : a;
  });
}

function mediaRowHasFile(row: MediaAsset): boolean {
  return (
    Boolean(row.file_path) &&
    row.media_source !== "youtube" &&
    row.media_source !== "kuula" &&
    row.media_source !== "external"
  );
}

function mapUnassignedMediaRow(row: MediaAsset): LibraryAsset {
  return {
    id: row.id,
    kind: row.media_type as LibraryAssetKind,
    title: row.title || row.file_name,
    file_name: row.file_name,
    thumbnail_url: row.thumbnail_url ?? null,
    project_id: null,
    project_name: "Unassigned",
    folder_id: null,
    folder_name: null,
    project_status: "—",
    service_type: "—",
    property_address: "—",
    property_type: null,
    client_id: row.client_id ?? null,
    client_name: "—",
    client_company: null,
    property_id: row.property_id ?? null,
    media_source: row.media_source,
    file_size: row.file_size,
    width: row.width ?? null,
    height: row.height ?? null,
    duration_seconds: row.duration_seconds ?? null,
    download_count: row.download_count ?? 0,
    is_favorite: row.is_favorite ?? false,
    tags: [],
    description: row.description ?? null,
    alt_text: row.alt_text ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    captured_at: row.captured_at ?? null,
    is_cover: false,
    mime_type: row.mime_type,
    youtube_url: row.youtube_url,
    embed_url: row.embed_url,
    kuula_url: null,
    visibility: row.visibility ?? null,
    downloadable: row.downloadable ?? null,
    camera_model: row.camera_model ?? null,
    orientation: row.orientation ?? null,
    version: row.version ?? 1,
    has_file: mediaRowHasFile(row),
  };
}

function mapMediaRowWithProject(
  row: MediaAsset,
  project: ProjectRow
): LibraryAsset {
  const client = unwrapRelation(project.clients);
  const property = unwrapRelation(project.properties);
  return {
    id: row.id,
    kind: row.media_type as LibraryAssetKind,
    title: row.title || row.file_name,
    file_name: row.file_name,
    thumbnail_url: row.thumbnail_url ?? null,
    project_id: row.project_id,
    project_name: project.project_name,
    folder_id: row.folder_id ?? null,
    folder_name: null,
    project_status: project.status,
    service_type: project.service_type,
    property_address: project.property_address,
    property_type: property?.property_type ?? null,
    client_id: row.client_id ?? project.client_id,
    client_name: client?.full_name || client?.name || "—",
    client_company: client?.company ?? null,
    property_id: row.property_id ?? project.property_id,
    media_source: row.media_source,
    file_size: row.file_size,
    width: row.width ?? null,
    height: row.height ?? null,
    duration_seconds: row.duration_seconds ?? null,
    download_count: row.download_count ?? 0,
    is_favorite: row.is_favorite ?? false,
    tags: [],
    description: row.description ?? null,
    alt_text: row.alt_text ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    captured_at: row.captured_at ?? null,
    is_cover: project.cover_image_id === row.id,
    mime_type: row.mime_type,
    youtube_url: row.youtube_url,
    embed_url: row.embed_url,
    kuula_url: null,
    visibility: row.visibility ?? null,
    downloadable: row.downloadable ?? null,
    camera_model: row.camera_model ?? null,
    orientation: row.orientation ?? null,
    version: row.version ?? 1,
    has_file: mediaRowHasFile(row),
  };
}

function mapTourRowWithProject(row: Tour, project: ProjectRow | null): LibraryAsset {
  const client = project ? unwrapRelation(project.clients) : null;
  const property = project ? unwrapRelation(project.properties) : null;
  return {
    id: row.id,
    kind: "tour",
    title: row.tour_name,
    file_name: null,
    thumbnail_url: row.thumbnail_url,
    project_id: row.project_id,
    project_name: project?.project_name ?? "Unassigned",
    folder_id: null,
    folder_name: null,
    project_status: project?.status ?? "—",
    service_type: project?.service_type ?? "—",
    property_address: project?.property_address ?? "—",
    property_type: property?.property_type ?? null,
    client_id: project ? project.client_id : row.client_id ?? null,
    client_name: client?.full_name || client?.name || "—",
    client_company: client?.company ?? null,
    property_id: project?.property_id ?? null,
    media_source: "kuula",
    file_size: null,
    width: null,
    height: null,
    duration_seconds: null,
    download_count: row.download_count ?? 0,
    is_favorite: row.is_favorite ?? false,
    tags: [],
    description: row.description ?? null,
    alt_text: null,
    notes: row.notes,
    created_at: row.created_at,
    captured_at: null,
    is_cover: false,
    mime_type: null,
    youtube_url: null,
    embed_url: row.embed_code,
    kuula_url: row.kuula_url,
    visibility: row.client_visible === false ? "admin" : "client",
    downloadable: null,
    camera_model: null,
    orientation: null,
    version: 1,
    has_file: false,
  };
}

function mapModelRowWithProject(row: Project3dModel, project: ProjectRow | null): LibraryAsset {
  const client = project ? unwrapRelation(project.clients) : null;
  const property = project ? unwrapRelation(project.properties) : null;
  return {
    id: row.id,
    kind: "model",
    title: row.title,
    file_name: null,
    thumbnail_url: null,
    project_id: row.project_id,
    project_name: project?.project_name ?? "Unassigned",
    folder_id: null,
    folder_name: null,
    project_status: project?.status ?? "—",
    service_type: project?.service_type ?? "—",
    property_address: project?.property_address ?? "—",
    property_type: property?.property_type ?? null,
    client_id: project ? project.client_id : row.client_id ?? null,
    client_name: client?.full_name || client?.name || "—",
    client_company: client?.company ?? null,
    property_id: project?.property_id ?? null,
    media_source: row.provider,
    file_size: null,
    width: null,
    height: null,
    duration_seconds: null,
    download_count: 0,
    is_favorite: false,
    tags: [],
    description: row.description ?? null,
    alt_text: null,
    notes: null,
    created_at: row.created_at,
    captured_at: null,
    is_cover: false,
    mime_type: null,
    youtube_url: null,
    embed_url: row.embed_url,
    kuula_url: null,
    visibility: row.client_visible === false ? "admin" : "client",
    downloadable: null,
    camera_model: null,
    orientation: null,
    version: 1,
    has_file: false,
  };
}

/** Normalized filter values shared by every source query. */
interface ResolvedFilters {
  kinds: Set<LibraryAssetKind>;
  services: Set<string>;
  clientIds: Set<string>;
  propertyIds: Set<string>;
  from?: string;
  to?: string;
  /** Project ids that match the client/property filters (null = not narrowed). */
  narrowedProjectIds: string[] | null;
  /** Staff scope; "all" or explicit ids. */
  scope: "all" | string[];
  /** Members of a Media Library folder; null = not restricted. */
  restrict: LibraryFolderMembers | null;
}

const MAX_NARROWED_PROJECT_IDS = 150;

function cleanList(values?: (string | null | undefined)[]): string[] {
  return [...new Set((values ?? []).map((v) => (v ?? "").trim()).filter(Boolean))];
}

async function resolveFilters(
  db: TenantServiceClient,
  filters: LibraryFilters,
  restrict: LibraryFolderMembers | null = null
): Promise<ResolvedFilters> {
  const kinds = new Set(
    cleanList(filters.types).filter((k): k is LibraryAssetKind =>
      (LIBRARY_ASSET_KINDS as string[]).includes(k)
    )
  );
  const clientIds = new Set(cleanList(filters.clientIds));
  const propertyIds = new Set(cleanList([...(filters.propertyIds ?? []), filters.propertyId]));
  const presetRange = dateRangeFromPreset(filters.datePreset);

  // Narrow the DB queries to projects owned by the selected clients / properties so
  // the per-source row caps still cover the matching rows. Post-filtering below keeps
  // the result exact either way.
  let narrowedProjectIds: string[] | null = null;
  if (clientIds.size || propertyIds.size) {
    let pq = db.from("projects").select("id");
    if (clientIds.size) pq = pq.in("client_id", [...clientIds]);
    if (propertyIds.size) pq = pq.in("property_id", [...propertyIds]);
    const { data, error } = await pq.limit(MAX_NARROWED_PROJECT_IDS + 1);
    if (!error && data && data.length <= MAX_NARROWED_PROJECT_IDS) {
      narrowedProjectIds = data.map((r) => r.id as string);
    }
  }

  return {
    kinds,
    services: new Set(cleanList(filters.services)),
    clientIds,
    propertyIds,
    from: filters.dateFrom || presetRange.from,
    to: filters.dateTo || presetRange.to,
    narrowedProjectIds,
    scope: filters.projectIds ?? "all",
    restrict,
  };
}

const RESTRICT_CHUNK = 150;

/**
 * Ids a source may read when the query is folder-scoped, split into URL-safe chunks.
 * null = unrestricted (one pass with no id filter); [] = nothing to read.
 */
function restrictChunks(rf: ResolvedFilters, source: keyof LibraryFolderMembers): (string[] | null)[] {
  if (!rf.restrict) return [null];
  const ids = [...rf.restrict[source].keys()];
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += RESTRICT_CHUNK) out.push(ids.slice(i, i + RESTRICT_CHUNK));
  return out;
}

function wantsKind(rf: ResolvedFilters, kind: LibraryAssetKind): boolean {
  return rf.kinds.size === 0 || rf.kinds.has(kind);
}

/** Project ids a project-bound source (tours, 3D models) may read; null = unrestricted. */
function projectIdConstraint(rf: ResolvedFilters): string[] | null {
  const scope = rf.scope === "all" ? null : rf.scope;
  const narrowed = rf.narrowedProjectIds;
  if (scope && narrowed) {
    const allowed = new Set(scope);
    return narrowed.filter((id) => allowed.has(id));
  }
  return scope ?? narrowed;
}

async function fetchMediaAssets(
  db: TenantServiceClient,
  rf: ResolvedFilters,
  favoritesOnly: boolean
): Promise<LibraryAsset[]> {
  const mediaKinds = [...MEDIA_TABLE_KINDS].filter((k) => wantsKind(rf, k as LibraryAssetKind));
  if (!mediaKinds.length) return [];
  if (rf.scope !== "all" && rf.scope.length === 0) return [];

  const rows: MediaAsset[] = [];
  for (const idChunk of restrictChunks(rf, "media")) {
    let query = db
      .from("media_assets")
      .select("*")
      .in("media_type", mediaKinds)
      .order("created_at", { ascending: false });

    if (idChunk) query = query.in("id", idChunk);
    if (rf.from) query = query.gte("created_at", rf.from);
    if (rf.to) query = query.lte("created_at", rf.to);
    if (rf.scope !== "all") query = query.in("project_id", rf.scope);
    if (favoritesOnly) query = query.eq("is_favorite", true);

    // Media rows can carry client_id / property_id directly (unassigned uploads) or
    // inherit them from their project — match either.
    if (rf.narrowedProjectIds) {
      const pids = rf.narrowedProjectIds;
      if (rf.clientIds.size) {
        const parts = [`client_id.in.(${[...rf.clientIds].join(",")})`];
        if (pids.length) parts.push(`project_id.in.(${pids.join(",")})`);
        query = query.or(parts.join(","));
      }
      if (rf.propertyIds.size) {
        const parts = [`property_id.in.(${[...rf.propertyIds].join(",")})`];
        if (pids.length) parts.push(`project_id.in.(${pids.join(",")})`);
        query = query.or(parts.join(","));
      }
    }

    const { data, error } = await query.limit(2000);

    if (error) {
      console.error("[media-library] media_assets query failed:", error.message);
      if (!idChunk) return [];
      continue;
    }
    rows.push(...((data ?? []) as MediaAsset[]));
  }

  const projectMap = await loadProjectMap(
    db,
    rows.map((r) => r.project_id).filter((id): id is string => !!id)
  );

  const mapped = rows.map((row) => {
    if (!row.project_id) return mapUnassignedMediaRow(row);
    const project = projectMap.get(row.project_id);
    if (!project) return mapUnassignedMediaRow(row);
    return mapMediaRowWithProject(row, project);
  });
  return attachFolderNames(db, mapped);
}

/**
 * Tours / 3D models whose project was deleted with "keep media" (project_id NULL, v120).
 * The main query already returns them when it is not narrowed by project; when a client
 * filter narrows it to that client's projects, fetch the client's detached rows too.
 * Staff scopes are project lists, so staff never see detached rows (same as media).
 * Before v120 the client_id column does not exist — the query errors and is skipped.
 */
async function fetchDetachedRows<T extends { id: string }>(
  db: TenantServiceClient,
  table: "tours" | "project_3d_models",
  rf: ResolvedFilters,
  favoritesOnly: boolean
): Promise<T[]> {
  if (rf.scope !== "all" || !rf.narrowedProjectIds || !rf.clientIds.size || rf.propertyIds.size) return [];
  // Folder-scoped queries already read folder members by id (detached ones included).
  if (rf.restrict) return [];
  let query = db
    .from(table)
    .select("*")
    .is("project_id", null)
    .in("client_id", [...rf.clientIds])
    .order("created_at", { ascending: false });
  if (rf.from) query = query.gte("created_at", rf.from);
  if (rf.to) query = query.lte("created_at", rf.to);
  if (favoritesOnly && table === "tours") query = query.eq("is_favorite", true);
  const { data, error } = await query.limit(500);
  if (error) return [];
  return (data ?? []) as unknown as T[];
}

async function fetchTourAssets(
  db: TenantServiceClient,
  rf: ResolvedFilters,
  favoritesOnly: boolean
): Promise<LibraryAsset[]> {
  if (!wantsKind(rf, "tour")) return [];
  const pids = projectIdConstraint(rf);
  if (pids && pids.length === 0) return [];

  const rows: Tour[] = [];
  for (const idChunk of restrictChunks(rf, "tour")) {
    let query = db.from("tours").select("*").order("created_at", { ascending: false });
    if (idChunk) query = query.in("id", idChunk);
    if (rf.from) query = query.gte("created_at", rf.from);
    if (rf.to) query = query.lte("created_at", rf.to);
    if (pids) query = query.in("project_id", pids);
    if (favoritesOnly) query = query.eq("is_favorite", true);

    const { data, error } = await query.limit(500);
    if (error) {
      console.error("[media-library] tours query failed:", error.message);
      if (!idChunk) return [];
      continue;
    }
    rows.push(...((data ?? []) as Tour[]));
  }
  rows.push(...(await fetchDetachedRows<Tour>(db, "tours", rf, favoritesOnly)));
  const projectMap = await loadProjectMap(
    db,
    rows.map((r) => r.project_id).filter((id): id is string => !!id)
  );

  return rows
    .map((row) => {
      // Detached (project deleted, media kept): listed as Unassigned under its client.
      if (!row.project_id) return mapTourRowWithProject(row, null);
      const project = projectMap.get(row.project_id);
      if (!project) return null;
      return mapTourRowWithProject(row, project);
    })
    .filter((a): a is LibraryAsset => a !== null);
}

async function fetchModelAssets(
  db: TenantServiceClient,
  rf: ResolvedFilters,
  favoritesOnly: boolean
): Promise<LibraryAsset[]> {
  // 3D models have no favorite flag, so a favorites-only view never includes them.
  if (!wantsKind(rf, "model") || favoritesOnly) return [];
  const pids = projectIdConstraint(rf);
  if (pids && pids.length === 0) return [];

  const rows: Project3dModel[] = [];
  for (const idChunk of restrictChunks(rf, "model")) {
    let query = db
      .from("project_3d_models")
      .select("*")
      .order("created_at", { ascending: false });
    if (idChunk) query = query.in("id", idChunk);
    if (rf.from) query = query.gte("created_at", rf.from);
    if (rf.to) query = query.lte("created_at", rf.to);
    if (pids) query = query.in("project_id", pids);

    const { data, error } = await query.limit(500);
    if (error) {
      // Table missing (migration v89 not applied) or transient failure — skip models.
      console.error("[media-library] project_3d_models query failed:", error.message);
      return [];
    }
    rows.push(...((data ?? []) as Project3dModel[]));
  }
  rows.push(...(await fetchDetachedRows<Project3dModel>(db, "project_3d_models", rf, favoritesOnly)));
  const projectMap = await loadProjectMap(
    db,
    rows.map((r) => r.project_id).filter((id): id is string => !!id)
  );

  return rows
    .map((row) => {
      // Detached (project deleted, media kept): listed as Unassigned under its client.
      if (!row.project_id) return mapModelRowWithProject(row, null);
      const project = projectMap.get(row.project_id);
      if (!project) return null;
      return mapModelRowWithProject(row, project);
    })
    .filter((a): a is LibraryAsset => a !== null);
}

/** Every asset matching the filters (newest first), before pagination. */
export async function queryMediaLibraryAll(
  businessId: string,
  filters: LibraryFilters
): Promise<LibraryAsset[]> {
  const db = await createTenantServiceClient(businessId);
  let restrict: LibraryFolderMembers | null = null;
  if (filters.libraryFolderId) {
    // Unknown folder / missing table → empty result (never the whole library).
    try {
      restrict = await loadLibraryFolderMembers(businessId, filters.libraryFolderId);
    } catch {
      return [];
    }
    if (!restrict.media.size && !restrict.tour.size && !restrict.model.size) return [];
  }
  const rf = await resolveFilters(db, filters, restrict);
  const favoritesOnly = filters.favoritesOnly === true;

  const [mediaRows, tourRows, modelRows] = await Promise.all([
    fetchMediaAssets(db, rf, favoritesOnly),
    fetchTourAssets(db, rf, favoritesOnly),
    fetchModelAssets(db, rf, favoritesOnly),
  ]);

  // Deduplicate by kind+id (safety)
  const seen = new Set<string>();
  let combined = [...mediaRows, ...tourRows, ...modelRows].filter((a) => {
    const key = `${a.kind}:${a.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  combined = await attachTagsToAssets(db, combined);
  combined = await attachUnassignedClientNames(db, combined);

  // All filters combine with AND; values within one filter combine with OR.
  if (rf.kinds.size) combined = combined.filter((a) => rf.kinds.has(a.kind));
  // A multi-service project ("A + B") matches if ANY of its services is selected.
  if (rf.services.size) {
    combined = combined.filter((a) => projectServiceNames(a).some((name) => rf.services.has(name)));
  }
  if (rf.clientIds.size) {
    combined = combined.filter((a) => !!a.client_id && rf.clientIds.has(a.client_id));
  }
  if (rf.propertyIds.size) {
    combined = combined.filter((a) => !!a.property_id && rf.propertyIds.has(a.property_id));
  }
  if (filters.favoritesOnly) combined = combined.filter((a) => a.is_favorite);
  if (filters.q?.trim()) {
    combined = combined.filter((a) => matchesSearch(a, filters.q!.trim()));
  }

  if (restrict) {
    // Belt and braces: only folder members, each stamped with when it was added.
    const members = restrict;
    const scoped: LibraryAsset[] = [];
    for (const a of combined) {
      const map = a.kind === "tour" ? members.tour : a.kind === "model" ? members.model : members.media;
      const added = map.get(a.id);
      if (added !== undefined) scoped.push({ ...a, folder_added_at: added });
    }
    combined = scoped;
  }

  return sortLibraryAssets(combined, filters.sort);
}

/** Stable in-memory sort; unknown / missing sort = newest upload first (the Classic order). */
export function sortLibraryAssets<T extends Pick<LibraryAsset, "created_at" | "title" | "file_size" | "folder_added_at">>(
  assets: T[],
  sort: LibrarySort | undefined
): T[] {
  const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0);
  const newest = (a: T, b: T) => time(b.created_at) - time(a.created_at);
  switch (sort) {
    case "oldest":
      return assets.sort((a, b) => time(a.created_at) - time(b.created_at));
    case "name":
      return assets.sort(
        (a, b) => (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base", numeric: true }) || newest(a, b)
      );
    case "size":
      return assets.sort((a, b) => (b.file_size ?? -1) - (a.file_size ?? -1) || newest(a, b));
    case "added":
      return assets.sort((a, b) => time(b.folder_added_at) - time(a.folder_added_at) || newest(a, b));
    default:
      return assets.sort(newest);
  }
}

export function countLibraryKinds(
  assets: Pick<LibraryAsset, "kind">[]
): Partial<Record<LibraryAssetKind, number>> {
  const counts: Partial<Record<LibraryAssetKind, number>> = {};
  for (const a of assets) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
  return counts;
}

export async function queryMediaLibrary(
  businessId: string,
  filters: LibraryFilters
): Promise<LibraryResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? DEFAULT_LIMIT));
  const combined = await queryMediaLibraryAll(businessId, filters);

  const total = combined.length;
  const offset = (page - 1) * limit;
  const assets = combined.slice(offset, offset + limit);

  return {
    assets,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
    kindCounts: countLibraryKinds(combined),
  };
}

/**
 * Parse library filters from a query string. Multi-value filters accept repeated
 * params (`type=photo&type=video`); `type` also accepts a comma list.
 */
export function parseLibraryFilters(
  sp: URLSearchParams
): Omit<LibraryFilters, "projectIds" | "page" | "limit"> {
  const multi = (key: string) => sp.getAll(key).filter(Boolean);
  return {
    q: sp.get("q") ?? undefined,
    types: multi("type").flatMap((t) => t.split(",")),
    services: multi("service"),
    clientIds: multi("client_id"),
    propertyIds: multi("property_id"),
    datePreset: sp.get("date") ?? undefined,
    dateFrom: sp.get("date_from") ?? undefined,
    dateTo: sp.get("date_to") ?? undefined,
    favoritesOnly: sp.get("favorites") === "1",
    libraryFolderId: sp.get("library_folder") ?? undefined,
    sort: LIBRARY_SORTS.includes(sp.get("sort") as LibrarySort) ? (sp.get("sort") as LibrarySort) : undefined,
  };
}

async function attachTagsToAssets(
  db: TenantServiceClient,
  assets: LibraryAsset[]
): Promise<LibraryAsset[]> {
  if (!assets.length) return assets;
  const ids = assets.filter((a) => MEDIA_TABLE_KINDS.has(a.kind)).map((a) => a.id);
  if (!ids.length) return assets;
  const { data: tagRows, error } = await db
    .from("media_asset_tags")
    .select("media_asset_id, tag")
    .in("media_asset_id", ids);

  if (error || !tagRows?.length) return assets;

  const tagMap = new Map<string, string[]>();
  tagRows.forEach((row) => {
    const list = tagMap.get(row.media_asset_id) ?? [];
    list.push(row.tag);
    tagMap.set(row.media_asset_id, list);
  });

  return assets.map((a) => ({ ...a, tags: tagMap.get(a.id) ?? a.tags }));
}

export async function getMediaAssetDetail(
  businessId: string,
  assetId: string,
  kind: LibraryAssetKind
) {
  const db = await createTenantServiceClient(businessId);

  if (kind === "model") {
    const { data } = await db.from("project_3d_models").select("*").eq("id", assetId).maybeSingle();
    if (!data) return null;
    if (!data.project_id) {
      const [named] = await attachUnassignedClientNames(db, [mapModelRowWithProject(data as Project3dModel, null)]);
      return named;
    }
    const projectMap = await loadProjectMap(db, [data.project_id]);
    const project = projectMap.get(data.project_id);
    if (!project) return null;
    return mapModelRowWithProject(data as Project3dModel, project);
  }

  if (kind === "tour") {
    const { data } = await db.from("tours").select("*").eq("id", assetId).maybeSingle();
    if (!data) return null;
    if (!data.project_id) {
      const [named] = await attachUnassignedClientNames(db, [mapTourRowWithProject(data as Tour, null)]);
      return named;
    }
    const projectMap = await loadProjectMap(db, [data.project_id]);
    const project = projectMap.get(data.project_id);
    if (!project) return null;
    return mapTourRowWithProject(data as Tour, project);
  }

  const { data } = await db.from("media_assets").select("*").eq("id", assetId).maybeSingle();
  if (!data) return null;

  // Unassigned library rows (project_id NULL) are business-scoped, not project-scoped.
  if (!data.project_id) {
    const asset = mapUnassignedMediaRow(data as MediaAsset);
    const [withTags] = await attachTagsToAssets(db, [asset]);
    return withTags;
  }

  const projectMap = await loadProjectMap(db, [data.project_id]);
  const project = projectMap.get(data.project_id);
  if (!project) {
    const asset = mapUnassignedMediaRow(data as MediaAsset);
    const [withTags] = await attachTagsToAssets(db, [asset]);
    return withTags;
  }
  const [asset] = await attachFolderNames(db, [mapMediaRowWithProject(data as MediaAsset, project)]);
  const [withTags] = await attachTagsToAssets(db, [asset]);
  return withTags;
}

export async function getMediaAssetEvents(
  businessId: string,
  assetId: string
): Promise<MediaAssetEvent[]> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("media_asset_events")
    .select("id, event_type, description, created_at, metadata")
    .eq("media_asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as MediaAssetEvent[];
}

export async function getMediaDownloadHistory(
  businessId: string,
  assetId: string
): Promise<MediaDownloadRecord[]> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("media_downloads")
    .select("id, downloaded_by_email, created_at")
    .eq("media_asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as MediaDownloadRecord[];
}

export async function getRelatedAssets(
  businessId: string,
  asset: LibraryAsset,
  limit = 6,
  projectIds: "all" | string[] = "all"
): Promise<LibraryAsset[]> {
  const result = await queryMediaLibrary(businessId, {
    propertyId: asset.property_id ?? undefined,
    limit: limit + 1,
    projectIds,
  });
  return result.assets.filter((a) => a.id !== asset.id).slice(0, limit);
}

export async function getMediaTags(businessId: string, assetId: string): Promise<string[]> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("media_asset_tags")
    .select("tag")
    .eq("media_asset_id", assetId);
  return (data ?? []).map((row) => row.tag);
}

export async function setMediaTags(businessId: string, assetId: string, tags: string[]) {
  const db = await createTenantServiceClient(businessId);
  const normalized = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  await db.from("media_asset_tags").delete().eq("media_asset_id", assetId);
  if (normalized.length) {
    await db.from("media_asset_tags").insert(
      normalized.map((tag) => ({ media_asset_id: assetId, tag }))
    );
  }
}

export async function getLibraryFilterOptions(
  businessId: string,
  scope?: {
    projectIds?: "all" | string[];
    clientIds?: "all" | string[];
  }
) {
  const db = await createTenantServiceClient(businessId);
  const projectIds = scope?.projectIds ?? "all";
  const clientIds = scope?.clientIds ?? "all";

  if (
    (projectIds !== "all" && projectIds.length === 0) ||
    (clientIds !== "all" && clientIds.length === 0)
  ) {
    return {
      clients: [],
      properties: [],
      projects: [],
      services: [] as string[],
      tags: [] as string[],
    };
  }

  let clientsQuery = db.from("clients").select("id, name, full_name, company").order("name");
  if (clientIds !== "all") clientsQuery = clientsQuery.in("id", clientIds);

  let projectsQuery = db
    .from("projects")
    .select("id, project_name, property_address, service_type, client_id, property_id")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (projectIds !== "all") projectsQuery = projectsQuery.in("id", projectIds);

  const [
    { data: clients },
    { data: projects },
    { data: catalogRows },
    { data: tagRows },
  ] = await Promise.all([
    clientsQuery,
    projectsQuery,
    db.from("business_services").select("name, aliases").eq("is_active", true),
    db.from("media_asset_tags").select("tag"),
  ]);

  const propertyIdSet = new Set<string>();
  for (const p of projects ?? []) {
    if (p.property_id) propertyIdSet.add(p.property_id as string);
  }

  let properties: { id: string; address: string | null; nickname: string | null }[] = [];
  if (propertyIdSet.size > 0) {
    const { data } = await db
      .from("properties")
      .select("id, address, nickname")
      .in("id", [...propertyIdSet])
      .order("address")
      .limit(200);
    properties = data ?? [];
  } else if (projectIds === "all") {
    const { data } = await db
      .from("properties")
      .select("id, address, nickname")
      .order("address")
      .limit(200);
    properties = data ?? [];
  }

  const fromCatalog = (catalogRows ?? []).flatMap((row) => {
    const aliases = Array.isArray(row.aliases) ? row.aliases.map(String) : [];
    return [row.name, ...aliases];
  });
  const fromProjects = (projects ?? []).flatMap((row) => projectServiceNames(row)).filter(Boolean);
  const services = [...new Set([...fromCatalog, ...fromProjects].filter(Boolean))].sort() as string[];
  const tags = [...new Set((tagRows ?? []).map((row) => row.tag).filter(Boolean))].sort() as string[];

  return {
    clients: clients ?? [],
    properties: properties.map((p) => ({
      id: p.id,
      address: p.address ?? "",
      nickname: p.nickname,
    })),
    projects: (projects ?? []).map((p) => ({
      id: p.id,
      project_name: p.project_name,
      property_address: p.property_address,
    })),
    services,
    tags,
  };
}
