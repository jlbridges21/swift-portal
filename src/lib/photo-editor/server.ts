import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import type { Profile } from "@/lib/types";
import { signMediaThumbnailUrl } from "@/lib/media-signed-thumbs";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { mediaDisplayName } from "@/lib/media-display-name";
import {
  PHOTO_EDITOR_KEEP_EDIT_VERSIONS,
  isEditablePhotoAsset,
  type PhotoEditSettings,
  type PhotoEditorPhoto,
  type PhotoVersionSummary,
} from "./shared";

export const PHOTO_BUCKET = "project-media";

export const PHOTO_EDITOR_SETUP_MESSAGE =
  "The Photo Editor is almost ready — a database update (migration v117) still needs to be applied.";

/** True when the error means the v117 tables/columns are not there yet. */
export function isPhotoEditorSchemaMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || error.code === "PGRST204") {
    return true;
  }
  const msg = (error.message ?? "").toLowerCase();
  return (
    (msg.includes("media_asset_versions") ||
      msg.includes("media_edit_drafts") ||
      msg.includes("photo_edit_sessions") ||
      msg.includes("edit_status") ||
      msg.includes("current_version_id")) &&
    (msg.includes("does not exist") || msg.includes("could not find") || msg.includes("schema cache"))
  );
}

export const EDITABLE_ASSET_COLUMNS =
  "id, business_id, project_id, folder_id, title, file_name, file_path, thumbnail_url, file_size, mime_type, media_type, media_source, width, height, display_order, created_at, edit_status, current_version_id, edited_at";

export type EditableAssetRow = {
  id: string;
  business_id: string;
  project_id: string | null;
  folder_id: string | null;
  title: string | null;
  file_name: string;
  file_path: string;
  thumbnail_url: string | null;
  file_size: number | null;
  mime_type: string;
  media_type: string;
  media_source: string;
  width: number | null;
  height: number | null;
  display_order: number | null;
  created_at: string;
  edit_status: "unedited" | "edited" | null;
  current_version_id: string | null;
  edited_at: string | null;
};

export type VersionRow = {
  id: string;
  business_id: string;
  media_asset_id: string;
  version_number: number;
  kind: "original" | "edit";
  file_name: string | null;
  file_path: string;
  thumbnail_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  edit_settings: PhotoEditSettings | null;
  created_by: string | null;
  created_at: string;
};

/** Filter rows down to those this operator may edit (staff project scoping). */
export async function filterAccessibleAssets<T extends { project_id: string | null }>(
  businessId: string,
  profile: Profile,
  rows: T[]
): Promise<T[]> {
  const cache = new Map<string, boolean>();
  const out: T[] = [];
  for (const row of rows) {
    const key = row.project_id ?? "__none__";
    if (!cache.has(key)) {
      cache.set(key, await canAccessMediaAsset(businessId, profile, row.project_id));
    }
    if (cache.get(key)) out.push(row);
  }
  return out;
}

/**
 * Load one editable photo row for this business. Callers MUST still run
 * canAccessMediaAsset(...) on the result (staff project scoping) before using it.
 */
export async function loadEditableAsset(
  db: TenantServiceClient,
  mediaId: string
): Promise<{ asset: EditableAssetRow | null; schemaMissing: boolean }> {
  const { data, error } = await db.from("media_assets").select(EDITABLE_ASSET_COLUMNS).eq("id", mediaId).maybeSingle();
  if (error) return { asset: null, schemaMissing: isPhotoEditorSchemaMissing(error) };
  const asset = data as EditableAssetRow | null;
  if (!asset || asset.business_id !== db.businessId) return { asset: null, schemaMissing: false };
  if (!isEditablePhotoAsset(asset)) return { asset: null, schemaMissing: false };
  return { asset, schemaMissing: false };
}

export async function getVersions(db: TenantServiceClient, mediaIds: string[]): Promise<VersionRow[]> {
  if (!mediaIds.length) return [];
  const { data } = await db
    .from("media_asset_versions")
    .select("*")
    .in("media_asset_id", mediaIds)
    .order("version_number", { ascending: true });
  return (data ?? []) as VersionRow[];
}

/**
 * Where the editor reads pixels from: always the ORIGINAL upload, so adjustments are
 * re-applied non-destructively instead of stacking on an already-edited JPEG.
 */
export function editorSourceFor(asset: EditableAssetRow, versions: VersionRow[]) {
  const original = versions.find((v) => v.media_asset_id === asset.id && v.kind === "original");
  if (original) {
    return { filePath: original.file_path, mimeType: original.mime_type ?? asset.mime_type, fileSize: original.file_size };
  }
  return { filePath: asset.file_path, mimeType: asset.mime_type, fileSize: asset.file_size };
}

/** Snapshot the current file as version 1 the first time a photo is edited. */
export async function ensureOriginalVersion(
  db: TenantServiceClient,
  asset: EditableAssetRow,
  userId: string | null
): Promise<VersionRow> {
  const { data: existing } = await db
    .from("media_asset_versions")
    .select("*")
    .eq("media_asset_id", asset.id)
    .eq("kind", "original")
    .maybeSingle();
  if (existing) return existing as VersionRow;

  const { data: created, error } = await db
    .from("media_asset_versions")
    .insert({
      media_asset_id: asset.id,
      version_number: 1,
      kind: "original",
      file_name: asset.file_name,
      file_path: asset.file_path,
      thumbnail_url: asset.thumbnail_url,
      file_size: asset.file_size,
      mime_type: asset.mime_type,
      width: asset.width,
      height: asset.height,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !created) {
    // Lost a race with another tab: read the winner.
    const { data: raced } = await db
      .from("media_asset_versions")
      .select("*")
      .eq("media_asset_id", asset.id)
      .eq("kind", "original")
      .maybeSingle();
    if (raced) return raced as VersionRow;
    throw new Error(error?.message || "Could not preserve the original photo.");
  }
  return created as VersionRow;
}

/** Point the delivered media row at a version's file. */
export function deliveryFieldsFor(version: VersionRow, asset: Pick<EditableAssetRow, "file_name">) {
  return {
    file_path: version.file_path,
    storage_path: version.file_path,
    thumbnail_url: version.thumbnail_url,
    file_size: version.file_size,
    mime_type: version.mime_type ?? undefined,
    width: version.width,
    height: version.height,
    file_name: version.file_name ?? asset.file_name,
    current_version_id: version.id,
    edit_status: version.kind === "original" ? "unedited" : "edited",
    edited_at: version.kind === "original" ? null : version.created_at,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Keep the original + the newest N edits. Older edited files are removed from storage
 * (never the original, never the file currently delivered).
 */
export async function pruneOldEditVersions(db: TenantServiceClient, mediaId: string, currentFilePath: string) {
  const { data } = await db
    .from("media_asset_versions")
    .select("id, kind, version_number, file_path, thumbnail_url")
    .eq("media_asset_id", mediaId)
    .eq("kind", "edit")
    .order("version_number", { ascending: false });
  const edits = (data ?? []) as Pick<VersionRow, "id" | "kind" | "version_number" | "file_path" | "thumbnail_url">[];
  const stale = edits.slice(PHOTO_EDITOR_KEEP_EDIT_VERSIONS).filter((v) => v.file_path !== currentFilePath);
  if (!stale.length) return;
  const paths = stale.flatMap((v) => [v.file_path, v.thumbnail_url].filter((p): p is string => Boolean(p)));
  const owned = paths.filter((p) => p.startsWith(`${db.businessId}/`));
  if (owned.length) await db.raw.storage.from(PHOTO_BUCKET).remove(owned);
  await db
    .from("media_asset_versions")
    .delete()
    .in(
      "id",
      stale.map((v) => v.id)
    );
}

/**
 * Storage objects owned by a photo's versions other than its current file. Called by the
 * media delete routes so removing a photo also removes its preserved original / old edits.
 * Returns [] when v117 is not applied.
 */
export async function versionStoragePathsForDelete(
  db: TenantServiceClient,
  mediaId: string,
  currentFilePath: string | null | undefined
): Promise<string[]> {
  const { data, error } = await db
    .from("media_asset_versions")
    .select("file_path, thumbnail_url")
    .eq("media_asset_id", mediaId);
  if (error || !data) return [];
  const out = new Set<string>();
  for (const row of data as { file_path: string; thumbnail_url: string | null }[]) {
    if (row.file_path && row.file_path !== currentFilePath && row.file_path.startsWith(`${db.businessId}/`)) {
      out.add(row.file_path);
    }
    if (row.thumbnail_url && row.thumbnail_url.startsWith(`${db.businessId}/`)) out.add(row.thumbnail_url);
  }
  return Array.from(out);
}

/** Build the editor payload for a list of assets (order preserved). */
export async function buildEditorPhotos(
  db: TenantServiceClient,
  assets: EditableAssetRow[]
): Promise<PhotoEditorPhoto[]> {
  const ids = assets.map((a) => a.id);
  const [versions, draftsRes] = await Promise.all([
    getVersions(db, ids),
    ids.length
      ? db.from("media_edit_drafts").select("media_asset_id, settings, revision, updated_at").in("media_asset_id", ids)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const drafts = new Map(
    ((draftsRes.data ?? []) as { media_asset_id: string; settings: PhotoEditSettings; revision: number; updated_at: string }[]).map(
      (d) => [d.media_asset_id, d]
    )
  );
  const versionsById = new Map(versions.map((v) => [v.id, v]));

  return Promise.all(
    assets.map(async (asset): Promise<PhotoEditorPhoto> => {
      const current = asset.current_version_id ? versionsById.get(asset.current_version_id) : undefined;
      const draft = drafts.get(asset.id);
      const thumbUrl = await signMediaThumbnailUrl(db.raw, PHOTO_BUCKET, {
        id: asset.id,
        file_path: asset.file_path,
        thumbnail_url: asset.thumbnail_url,
        media_type: "photo",
        media_source: "upload",
        mime_type: asset.mime_type,
        file_name: asset.file_name,
        file_size: asset.file_size,
        business_id: asset.business_id,
      } as Parameters<typeof signMediaThumbnailUrl>[2]);
      const original = versions.find((v) => v.media_asset_id === asset.id && v.kind === "original");
      return {
        id: asset.id,
        name: mediaDisplayName(asset),
        projectId: asset.project_id,
        folderId: asset.folder_id,
        mimeType: original?.mime_type ?? asset.mime_type,
        width: original?.width ?? asset.width,
        height: original?.height ?? asset.height,
        fileSize: original?.file_size ?? asset.file_size,
        editStatus: asset.edit_status === "edited" ? "edited" : "unedited",
        editedAt: asset.edited_at,
        thumbUrl,
        draft: draft ? { settings: draft.settings, revision: draft.revision, updatedAt: draft.updated_at } : null,
        publishedSettings: current?.kind === "edit" ? current.edit_settings : null,
        currentVersionNumber: current?.version_number ?? null,
      };
    })
  );
}

export async function buildVersionSummaries(
  db: TenantServiceClient,
  asset: EditableAssetRow
): Promise<PhotoVersionSummary[]> {
  const versions = await getVersions(db, [asset.id]);
  const creatorIds = Array.from(new Set(versions.map((v) => v.created_by).filter((v): v is string => Boolean(v))));
  const names = new Map<string, string>();
  if (creatorIds.length) {
    const { data } = await db.raw
      .from("profiles")
      .select("id, full_name, email")
      .eq("business_id", db.businessId)
      .in("id", creatorIds);
    for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      names.set(p.id, p.full_name || p.email || "");
    }
  }
  return Promise.all(
    versions
      .slice()
      .reverse()
      .map(async (v) => {
        const thumbUrl = await signMediaThumbnailUrl(db.raw, PHOTO_BUCKET, {
          id: v.id,
          file_path: v.file_path,
          thumbnail_url: v.thumbnail_url,
          media_type: "photo",
          media_source: "upload",
          mime_type: v.mime_type ?? "image/jpeg",
          file_name: v.file_name ?? "photo.jpg",
          file_size: v.file_size,
          business_id: v.business_id,
        } as Parameters<typeof signMediaThumbnailUrl>[2]);
        return {
          id: v.id,
          versionNumber: v.version_number,
          kind: v.kind,
          createdAt: v.created_at,
          createdByName: v.created_by ? names.get(v.created_by) || null : null,
          fileSize: v.file_size,
          width: v.width,
          height: v.height,
          thumbUrl,
          isCurrent: asset.current_version_id ? asset.current_version_id === v.id : v.kind === "original",
          settings: v.kind === "edit" ? v.edit_settings : null,
        };
      })
  );
}
