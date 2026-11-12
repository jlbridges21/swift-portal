/**
 * Media Library folders (migration v126) — server side.
 *
 * Folders are organizational collections. `library_folder_items` stores (folder, asset) pairs
 * only: nothing here copies, moves, or deletes media, changes an asset's project, or alters
 * project/client visibility. Every query runs through the tenant client (business_id is
 * re-applied on every read and write), and the database re-checks tenant ownership of every
 * referenced folder/asset with enforce_same_business triggers.
 *
 * Callers authorize first (area.media to read, media.organize to change, staff project scope
 * for the assets they add or remove).
 */
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { validateShareAccessWindow } from "@/lib/project-share-expiry";
import type { LibraryAssetKind } from "@/lib/media-library";
import {
  LIBRARY_FOLDER_ITEMS_PER_REQUEST,
  libraryItemColumn,
  type LibraryFolderSummary,
  type LibraryItemRef,
} from "@/lib/library-folder-types";
import type { PhotoShareSummary } from "@/lib/media-share-types";

export class LibraryFolderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** Thrown when migration v126 has not been applied yet. */
export class LibraryFoldersSetupRequiredError extends LibraryFolderError {
  constructor() {
    super("Media Library folders aren't set up yet. Run supabase/migration-v126-library-folders.sql.", 503);
  }
}

export function isMissingLibraryFoldersRelation(message: string | undefined | null): boolean {
  return Boolean(
    message &&
      /library_folder/i.test(message) &&
      /does not exist|schema cache|could not find|PGRST20[25]|42P01|42703|42883/i.test(message)
  );
}

function fail(error: { message?: string; code?: string } | null, fallback: string): never {
  if (error && isMissingLibraryFoldersRelation(error.message)) throw new LibraryFoldersSetupRequiredError();
  throw new LibraryFolderError(fallback, 500);
}

export type LibraryFolderRow = {
  id: string;
  business_id: string;
  name: string;
  cover_media_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

const FOLDER_COLUMNS = "id, business_id, name, cover_media_asset_id, created_at, updated_at";
const PAGE = 1000;
const IN_CHUNK = 150;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function getLibraryFolder(businessId: string, folderId: string): Promise<LibraryFolderRow | null> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("library_folders").select(FOLDER_COLUMNS).eq("id", folderId).maybeSingle();
  if (error) {
    if (isMissingLibraryFoldersRelation(error.message)) throw new LibraryFoldersSetupRequiredError();
    return null;
  }
  return (data as LibraryFolderRow | null) ?? null;
}

async function folderShareSummaries(db: TenantServiceClient): Promise<Record<string, PhotoShareSummary>> {
  const { data, error } = await db
    .from("media_shares")
    .select("library_folder_id, kind, revoked_at, access_mode, access_starts_at, access_expires_at")
    .not("library_folder_id", "is", null)
    .is("revoked_at", null);
  if (error) return {};
  const out: Record<string, PhotoShareSummary> = {};
  for (const row of (data ?? []) as {
    library_folder_id: string;
    kind: "email" | "link";
    revoked_at: string | null;
    access_mode: "reusable";
    access_starts_at: string | null;
    access_expires_at: string | null;
  }[]) {
    if (!validateShareAccessWindow({ ...row, one_time_used_at: null }).ok) continue;
    const entry = (out[row.library_folder_id] ??= { link: false, people: 0 });
    if (row.kind === "link") entry.link = true;
    else entry.people += 1;
  }
  return out;
}

export type LibraryFolderList = { setupRequired: boolean; folders: LibraryFolderSummary[] };

/** Every folder in the business with its item count, cover, and live share summary. */
export async function listLibraryFolders(businessId: string): Promise<LibraryFolderList> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("library_folders").select(FOLDER_COLUMNS).order("name");
  if (error) {
    if (isMissingLibraryFoldersRelation(error.message)) return { setupRequired: true, folders: [] };
    console.error("[library-folders] list failed", error.message);
    return { setupRequired: false, folders: [] };
  }
  const rows = (data ?? []) as LibraryFolderRow[];
  if (!rows.length) return { setupRequired: false, folders: [] };

  const [{ data: summaries, error: sumErr }, shares] = await Promise.all([
    db.raw.rpc("library_folder_summaries", { p_business_id: businessId }),
    folderShareSummaries(db),
  ]);
  if (sumErr) console.error("[library-folders] summaries failed", sumErr.message);
  const byId = new Map<string, { item_count: number; auto_cover_id: string | null }>();
  for (const s of (summaries ?? []) as { folder_id: string; item_count: number | string; auto_cover_id: string | null }[]) {
    byId.set(s.folder_id, { item_count: Number(s.item_count) || 0, auto_cover_id: s.auto_cover_id });
  }

  return {
    setupRequired: false,
    folders: rows.map((r) => {
      const s = byId.get(r.id);
      return {
        id: r.id,
        name: r.name,
        itemCount: s?.item_count ?? 0,
        coverAssetId: r.cover_media_asset_id ?? s?.auto_cover_id ?? null,
        coverMode: r.cover_media_asset_id ? "manual" : "auto",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        share: shares[r.id] ?? { link: false, people: 0 },
      } satisfies LibraryFolderSummary;
    }),
  };
}

/** True when the folder has at least one live (unrevoked, unexpired) share. */
export async function libraryFolderIsShared(businessId: string, folderId: string): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  const shares = await folderShareSummaries(db);
  const s = shares[folderId];
  return Boolean(s && (s.link || s.people > 0));
}

export type LibraryFolderMembers = {
  media: Map<string, string>;
  tour: Map<string, string>;
  model: Map<string, string>;
};

/** Every member of a folder (id → added_at), paged so large folders load completely. */
export async function loadLibraryFolderMembers(businessId: string, folderId: string): Promise<LibraryFolderMembers> {
  const db = await createTenantServiceClient(businessId);
  const members: LibraryFolderMembers = { media: new Map(), tour: new Map(), model: new Map() };
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("library_folder_items")
      .select("media_asset_id, tour_id, model_id, added_at")
      .eq("folder_id", folderId)
      .order("added_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail(error, "Couldn't load this folder.");
    const rows = (data ?? []) as { media_asset_id: string | null; tour_id: string | null; model_id: string | null; added_at: string }[];
    for (const r of rows) {
      if (r.media_asset_id) members.media.set(r.media_asset_id, r.added_at);
      else if (r.tour_id) members.tour.set(r.tour_id, r.added_at);
      else if (r.model_id) members.model.set(r.model_id, r.added_at);
    }
    if (rows.length < PAGE) break;
  }
  return members;
}

/** Folders (id + name) that contain this asset — for the asset drawer. */
export async function listFoldersContaining(businessId: string, ref: LibraryItemRef): Promise<{ id: string; name: string }[]> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("library_folder_items")
    .select("folder_id")
    .eq(libraryItemColumn(ref.kind), ref.id)
    .limit(200);
  if (error || !data?.length) return [];
  const ids = [...new Set(data.map((r) => r.folder_id as string))];
  const { data: folders } = await db.from("library_folders").select("id, name").in("id", ids).order("name");
  return ((folders ?? []) as { id: string; name: string }[]).map((f) => ({ id: f.id, name: f.name }));
}

// ── Writes ─────────────────────────────────────────────────────────────────

function duplicateName(name: string) {
  return new LibraryFolderError(`A folder named “${name}” already exists. Choose another name.`, 409);
}

export async function createLibraryFolder(businessId: string, name: string, actorId: string | null): Promise<LibraryFolderRow> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("library_folders")
    .insert({ name, created_by: actorId })
    .select(FOLDER_COLUMNS)
    .single();
  if (error?.code === "23505") throw duplicateName(name);
  if (error || !data) fail(error, "Couldn't create the folder.");
  return data as LibraryFolderRow;
}

export async function renameLibraryFolder(businessId: string, folderId: string, name: string): Promise<LibraryFolderRow> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("library_folders")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .select(FOLDER_COLUMNS)
    .maybeSingle();
  if (error?.code === "23505") throw duplicateName(name);
  if (error) fail(error, "Couldn't rename the folder.");
  if (!data) throw new LibraryFolderError("Folder not found.", 404);
  return data as LibraryFolderRow;
}

/** Manual cover (must be a photo in the folder) or null for automatic. */
export async function setLibraryFolderCover(businessId: string, folderId: string, assetId: string | null): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  if (assetId) {
    const { data: member } = await db
      .from("library_folder_items")
      .select("id")
      .eq("folder_id", folderId)
      .eq("media_asset_id", assetId)
      .maybeSingle();
    if (!member) throw new LibraryFolderError("Choose a photo that's in this folder.", 400);
    const { data: asset } = await db.from("media_assets").select("media_type, media_source").eq("id", assetId).maybeSingle();
    if (!asset || asset.media_type !== "photo" || asset.media_source === "youtube") {
      throw new LibraryFolderError("Only photos can be used as a folder cover.", 400);
    }
  }
  const { data, error } = await db
    .from("library_folders")
    .update({ cover_media_asset_id: assetId, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .select("id")
    .maybeSingle();
  if (error) fail(error, "Couldn't update the cover.");
  if (!data) throw new LibraryFolderError("Folder not found.", 404);
}

/**
 * Delete the folder and its membership rows only (CASCADE). The assets themselves, their
 * projects, and any per-asset shares are untouched. Folder shares are revoked by trigger.
 */
export async function deleteLibraryFolder(businessId: string, folderId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("library_folders").delete().eq("id", folderId).select("id").maybeSingle();
  if (error) fail(error, "Couldn't delete the folder.");
  if (!data) throw new LibraryFolderError("Folder not found.", 404);
}

async function touchFolder(db: TenantServiceClient, folderId: string) {
  await db.from("library_folders").update({ updated_at: new Date().toISOString() }).eq("id", folderId);
}

export type ItemProject = { ref: LibraryItemRef; projectId: string | null };

/**
 * Look up the given refs in this business. Unknown ids (or ids of another business) are
 * dropped; kinds are corrected to the stored media_type. Returns each item's project so the
 * caller can apply staff project scope.
 */
export async function resolveLibraryItems(businessId: string, refs: LibraryItemRef[]): Promise<ItemProject[]> {
  const db = await createTenantServiceClient(businessId);
  const out: ItemProject[] = [];
  const media = [...new Set(refs.filter((r) => libraryItemColumn(r.kind) === "media_asset_id").map((r) => r.id))];
  const tours = [...new Set(refs.filter((r) => r.kind === "tour").map((r) => r.id))];
  const models = [...new Set(refs.filter((r) => r.kind === "model").map((r) => r.id))];

  for (const ids of chunk(media, IN_CHUNK)) {
    const { data } = await db.from("media_assets").select("id, media_type, project_id").in("id", ids);
    for (const r of (data ?? []) as { id: string; media_type: string; project_id: string | null }[]) {
      const kind = (["photo", "video", "document"].includes(r.media_type) ? r.media_type : "document") as LibraryAssetKind;
      out.push({ ref: { kind, id: r.id }, projectId: r.project_id });
    }
  }
  for (const ids of chunk(tours, IN_CHUNK)) {
    const { data } = await db.from("tours").select("id, project_id").in("id", ids);
    for (const r of (data ?? []) as { id: string; project_id: string | null }[]) {
      out.push({ ref: { kind: "tour", id: r.id }, projectId: r.project_id });
    }
  }
  for (const ids of chunk(models, IN_CHUNK)) {
    const { data, error } = await db.from("project_3d_models").select("id, project_id").in("id", ids);
    if (error) continue;
    for (const r of (data ?? []) as { id: string; project_id: string | null }[]) {
      out.push({ ref: { kind: "model", id: r.id }, projectId: r.project_id });
    }
  }
  return out;
}

/** Add references (idempotent). Returns how many were new. */
export async function addLibraryFolderItems(
  businessId: string,
  folderId: string,
  refs: LibraryItemRef[],
  actorId: string | null
): Promise<{ added: number; alreadyInFolder: number }> {
  if (refs.length > LIBRARY_FOLDER_ITEMS_PER_REQUEST) {
    throw new LibraryFolderError(`Add up to ${LIBRARY_FOLDER_ITEMS_PER_REQUEST} items at a time.`, 400);
  }
  const folder = await getLibraryFolder(businessId, folderId);
  if (!folder) throw new LibraryFolderError("Folder not found.", 404);
  if (!refs.length) return { added: 0, alreadyInFolder: 0 };

  const db = await createTenantServiceClient(businessId);
  let added = 0;
  // One insert per column kind so each uses its own partial unique index for ON CONFLICT.
  const groups: Record<"media_asset_id" | "tour_id" | "model_id", string[]> = { media_asset_id: [], tour_id: [], model_id: [] };
  for (const r of refs) groups[libraryItemColumn(r.kind)].push(r.id);

  for (const [column, ids] of Object.entries(groups) as ["media_asset_id" | "tour_id" | "model_id", string[]][]) {
    const unique = [...new Set(ids)];
    for (const part of chunk(unique, IN_CHUNK)) {
      // Skip existing members explicitly (partial unique indexes can't be ON CONFLICT targets
      // through PostgREST), then insert the rest; a concurrent duplicate is a harmless 23505.
      const { data: existing, error: exErr } = await db
        .from("library_folder_items")
        .select(column)
        .eq("folder_id", folderId)
        .in(column, part);
      if (exErr) fail(exErr, "Couldn't add to the folder.");
      const have = new Set(((existing ?? []) as unknown as Record<string, string>[]).map((r) => r[column]));
      const rows = part.filter((id) => !have.has(id)).map((id) => ({ folder_id: folderId, [column]: id, added_by: actorId }));
      if (!rows.length) continue;
      const { data, error } = await db.from("library_folder_items").insert(rows).select("id");
      if (error) {
        if (error.code !== "23505") fail(error, "Couldn't add to the folder.");
        // Raced with another add — fall back to one-by-one so the rest still land.
        for (const row of rows) {
          const { error: oneErr } = await db.from("library_folder_items").insert(row);
          if (!oneErr) added += 1;
          else if (oneErr.code !== "23505") fail(oneErr, "Couldn't add to the folder.");
        }
      } else {
        added += data?.length ?? rows.length;
      }
    }
  }
  if (added) await touchFolder(db, folderId);
  const unique = new Set(refs.map((r) => `${libraryItemColumn(r.kind)}:${r.id}`)).size;
  return { added, alreadyInFolder: Math.max(0, unique - added) };
}

/** Remove references only — the assets themselves are never touched. */
export async function removeLibraryFolderItems(
  businessId: string,
  folderId: string,
  refs: LibraryItemRef[]
): Promise<{ removed: number }> {
  if (refs.length > LIBRARY_FOLDER_ITEMS_PER_REQUEST) {
    throw new LibraryFolderError(`Remove up to ${LIBRARY_FOLDER_ITEMS_PER_REQUEST} items at a time.`, 400);
  }
  const folder = await getLibraryFolder(businessId, folderId);
  if (!folder) throw new LibraryFolderError("Folder not found.", 404);
  const db = await createTenantServiceClient(businessId);
  let removed = 0;
  const groups: Record<"media_asset_id" | "tour_id" | "model_id", string[]> = { media_asset_id: [], tour_id: [], model_id: [] };
  for (const r of refs) groups[libraryItemColumn(r.kind)].push(r.id);
  for (const [column, ids] of Object.entries(groups) as ["media_asset_id" | "tour_id" | "model_id", string[]][]) {
    for (const part of chunk([...new Set(ids)], IN_CHUNK)) {
      const { data, error } = await db
        .from("library_folder_items")
        .delete()
        .eq("folder_id", folderId)
        .in(column, part)
        .select("id");
      if (error) fail(error, "Couldn't remove from the folder.");
      removed += data?.length ?? 0;
    }
  }
  // A removed manual cover falls back to automatic.
  if (folder.cover_media_asset_id && groups.media_asset_id.includes(folder.cover_media_asset_id)) {
    await db.from("library_folders").update({ cover_media_asset_id: null }).eq("id", folderId);
  }
  if (removed) await touchFolder(db, folderId);
  return { removed };
}
