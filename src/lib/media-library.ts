import { createServiceClient } from "@/lib/supabase/server";
import type { MediaAsset, Tour } from "@/lib/types";

export type LibraryAssetKind = "photo" | "video" | "document" | "tour";

export interface LibraryAsset {
  id: string;
  kind: LibraryAssetKind;
  title: string;
  file_name: string | null;
  thumbnail_url: string | null;
  project_id: string | null;
  project_name: string;
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
}

export interface LibraryFilters {
  q?: string;
  type?: string;
  service?: string;
  propertyType?: string;
  projectStatus?: string;
  source?: string;
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  propertyId?: string;
  favoritesOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface LibraryResult {
  assets: LibraryAsset[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
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
  mediaAssetId: string;
  projectId?: string | null;
  userId?: string | null;
  eventType: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = await createServiceClient();
    await supabase.from("media_asset_events").insert({
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
  mediaAssetId: string;
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
}) {
  try {
    const supabase = await createServiceClient();
    await supabase.from("media_downloads").insert({
      media_asset_id: options.mediaAssetId,
      user_id: options.userId ?? null,
      downloaded_by_email: options.email ?? null,
      ip_address: options.ipAddress ?? null,
    });
    const { data } = await supabase
      .from("media_assets")
      .select("download_count")
      .eq("id", options.mediaAssetId)
      .single();
    await supabase
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

function matchesProjectStatus(status: string, filter?: string): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "active") return status !== "delivered";
  if (filter === "awaiting_payment") return status === "awaiting_payment";
  if (filter === "delivered") return status === "delivered";
  return true;
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
  client_id: string;
  property_id: string | null;
  clients: { id: string; name: string; full_name: string | null; company: string | null } | { id: string; name: string; full_name: string | null; company: string | null }[] | null;
  properties: { property_type: string | null } | { property_type: string | null }[] | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function loadProjectMap(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  projectIds: string[]
): Promise<Map<string, ProjectRow>> {
  const map = new Map<string, ProjectRow>();
  if (!projectIds.length) return map;

  const unique = [...new Set(projectIds)];
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
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

function mapUnassignedMediaRow(row: MediaAsset): LibraryAsset {
  return {
    id: row.id,
    kind: row.media_type as LibraryAssetKind,
    title: row.title || row.file_name,
    file_name: row.file_name,
    thumbnail_url: row.thumbnail_url ?? null,
    project_id: null,
    project_name: "Unassigned",
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
  };
}

function mapTourRowWithProject(row: Tour, project: ProjectRow): LibraryAsset {
  const client = unwrapRelation(project.clients);
  const property = unwrapRelation(project.properties);
  return {
    id: row.id,
    kind: "tour",
    title: row.tour_name,
    file_name: null,
    thumbnail_url: row.thumbnail_url,
    project_id: row.project_id,
    project_name: project.project_name,
    project_status: project.status,
    service_type: project.service_type,
    property_address: project.property_address,
    property_type: property?.property_type ?? null,
    client_id: project.client_id,
    client_name: client?.full_name || client?.name || "—",
    client_company: client?.company ?? null,
    property_id: project.property_id,
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
  };
}

async function fetchMediaAssets(filters: LibraryFilters): Promise<LibraryAsset[]> {
  const supabase = await createServiceClient();
  const presetRange = dateRangeFromPreset(filters.datePreset);
  const from = filters.dateFrom ?? presetRange.from;
  const to = filters.dateTo ?? presetRange.to;

  if (filters.type === "tour" || filters.source === "kuula") {
    return [];
  }

  let query = supabase.from("media_assets").select("*").order("created_at", { ascending: false });

  if (filters.type && filters.type !== "tour") {
    if (filters.type === "video") {
      query = query.in("media_type", ["video"]);
    } else {
      query = query.eq("media_type", filters.type);
    }
  }
  if (filters.source && filters.source !== "kuula") {
    query = query.eq("media_source", filters.source);
  }
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query.limit(2000);

  if (error) {
    console.error("[media-library] media_assets query failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as MediaAsset[];
  let filtered = rows;

  if (filters.favoritesOnly) {
    filtered = filtered.filter((r) => (r as MediaAsset & { is_favorite?: boolean }).is_favorite === true);
  }

  const projectMap = await loadProjectMap(
    supabase,
    filtered.map((r) => r.project_id).filter((id): id is string => !!id)
  );

  return filtered
    .map((row) => {
      if (!row.project_id) return mapUnassignedMediaRow(row);
      const project = projectMap.get(row.project_id);
      if (!project) return mapUnassignedMediaRow(row);
      return mapMediaRowWithProject(row, project);
    });
}

async function fetchTourAssets(filters: LibraryFilters): Promise<LibraryAsset[]> {
  if (filters.type && filters.type !== "tour") return [];
  if (filters.source && filters.source !== "kuula") return [];

  const supabase = await createServiceClient();
  const presetRange = dateRangeFromPreset(filters.datePreset);
  const from = filters.dateFrom ?? presetRange.from;
  const to = filters.dateTo ?? presetRange.to;

  let query = supabase.from("tours").select("*").order("created_at", { ascending: false });
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query.limit(500);
  if (error) {
    console.error("[media-library] tours query failed:", error.message);
    return [];
  }

  let rows = (data ?? []) as Tour[];
  if (filters.favoritesOnly) {
    rows = rows.filter((r) => r.is_favorite === true);
  }

  const projectMap = await loadProjectMap(
    supabase,
    rows.map((r) => r.project_id)
  );

  return rows
    .map((row) => {
      const project = projectMap.get(row.project_id);
      if (!project) return null;
      return mapTourRowWithProject(row, project);
    })
    .filter((a): a is LibraryAsset => a !== null);
}

export async function queryMediaLibrary(filters: LibraryFilters): Promise<LibraryResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, filters.limit ?? DEFAULT_LIMIT);
  const includeTours = !filters.type || filters.type === "tour";
  const includeMedia = !filters.type || filters.type !== "tour";

  const [mediaRows, tourRows] = await Promise.all([
    includeMedia ? fetchMediaAssets(filters) : Promise.resolve([]),
    includeTours ? fetchTourAssets(filters) : Promise.resolve([]),
  ]);

  const supabase = await createServiceClient();

  // Deduplicate by kind+id (safety)
  const seen = new Set<string>();
  let combined = [...mediaRows, ...tourRows].filter((a) => {
    const key = `${a.kind}:${a.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  combined = await attachTagsToAssets(supabase, combined);

  if (filters.service) {
    combined = combined.filter((a) => a.service_type === filters.service);
  }
  if (filters.propertyType) {
    combined = combined.filter((a) => a.property_type === filters.propertyType);
  }
  if (filters.projectStatus) {
    combined = combined.filter((a) => matchesProjectStatus(a.project_status, filters.projectStatus));
  }
  if (filters.clientId) {
    combined = combined.filter((a) => a.client_id === filters.clientId);
  }
  if (filters.propertyId) {
    combined = combined.filter((a) => a.property_id === filters.propertyId);
  }
  if (filters.q?.trim()) {
    combined = combined.filter((a) => matchesSearch(a, filters.q!.trim()));
  }

  combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = combined.length;
  const offset = (page - 1) * limit;
  const assets = combined.slice(offset, offset + limit);

  return {
    assets,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
}

async function attachTagsToAssets(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  assets: LibraryAsset[]
): Promise<LibraryAsset[]> {
  if (!assets.length) return assets;
  const ids = assets.filter((a) => a.kind !== "tour").map((a) => a.id);
  if (!ids.length) return assets;
  const { data: tagRows, error } = await supabase
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

export async function getMediaAssetDetail(assetId: string, kind: LibraryAssetKind) {
  const supabase = await createServiceClient();

  if (kind === "tour") {
    const { data } = await supabase.from("tours").select("*").eq("id", assetId).maybeSingle();
    if (!data) return null;
    const projectMap = await loadProjectMap(supabase, [data.project_id]);
    const project = projectMap.get(data.project_id);
    if (!project) return null;
    return mapTourRowWithProject(data as Tour, project);
  }

  const { data } = await supabase.from("media_assets").select("*").eq("id", assetId).maybeSingle();
  if (!data) return null;
  const projectMap = await loadProjectMap(supabase, [data.project_id]);
  const project = projectMap.get(data.project_id);
  if (!project) return null;
  const asset = mapMediaRowWithProject(data as MediaAsset, project);
  const [withTags] = await attachTagsToAssets(supabase, [asset]);
  return withTags;
}

export async function getMediaAssetEvents(assetId: string): Promise<MediaAssetEvent[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("media_asset_events")
    .select("id, event_type, description, created_at, metadata")
    .eq("media_asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as MediaAssetEvent[];
}

export async function getMediaDownloadHistory(assetId: string): Promise<MediaDownloadRecord[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("media_downloads")
    .select("id, downloaded_by_email, created_at")
    .eq("media_asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as MediaDownloadRecord[];
}

export async function getRelatedAssets(asset: LibraryAsset, limit = 6): Promise<LibraryAsset[]> {
  const result = await queryMediaLibrary({
    propertyId: asset.property_id ?? undefined,
    limit: limit + 1,
  });
  return result.assets.filter((a) => a.id !== asset.id).slice(0, limit);
}

export async function getMediaTags(assetId: string): Promise<string[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("media_asset_tags")
    .select("tag")
    .eq("media_asset_id", assetId);
  return (data ?? []).map((row) => row.tag);
}

export async function setMediaTags(assetId: string, tags: string[]) {
  const supabase = await createServiceClient();
  const normalized = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  await supabase.from("media_asset_tags").delete().eq("media_asset_id", assetId);
  if (normalized.length) {
    await supabase.from("media_asset_tags").insert(
      normalized.map((tag) => ({ media_asset_id: assetId, tag }))
    );
  }
}

export async function getLibraryFilterOptions() {
  const supabase = await createServiceClient();
  const [{ data: clients }, { data: properties }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, name, full_name, company").order("name"),
    supabase.from("properties").select("id, address, nickname").order("address").limit(200),
    supabase
      .from("projects")
      .select("id, project_name, property_address")
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);
  return {
    clients: clients ?? [],
    properties: properties ?? [],
    projects: projects ?? [],
  };
}
