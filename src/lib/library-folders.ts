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
  /** v136 subfolders: null = top level (always null before the migration). */
  parent_id?: string | null;
  cover_media_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

const FOLDER_COLUMNS = "id, business_id, name, cover_media_asset_id, created_at, updated_at";
/** v136: read parent_id with a fallback so folders keep working before the migration. */
const NESTED_FOLDER_COLUMNS = `${FOLDER_COLUMNS}, parent_id`;
const SUBFOLDERS_SETUP_MESSAGE = "Subfolders aren't set up yet. Run supabase/migration-v136-library-subfolders.sql.";
const PAGE = 1000;
const IN_CHUNK = 150;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ── Tree (v136) ────────────────────────────────────────────────────────────

export type FolderNode = { id: string; parentId: string | null; name: string };

/**
 * Every folder's id, parent and name. Businesses have at most a few thousand folders, so the
 * tree is walked in memory instead of with recursive SQL. `nested` is false before v136.
 */
export async function loadFolderTree(businessId: string): Promise<{ nodes: FolderNode[]; nested: boolean }> {
  const db = await createTenantServiceClient(businessId);
  const probe = await db.from("library_folders").select("parent_id").limit(1);
  const nested = !probe.error;
  const columns = nested ? "id, name, parent_id" : "id, name";
  const nodes: FolderNode[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("library_folders").select(columns).order("id").range(from, from + PAGE - 1);
    if (error) break;
    const rows = (data ?? []) as unknown as { id: string; name: string; parent_id?: string | null }[];
    for (const r of rows) nodes.push({ id: r.id, name: r.name, parentId: r.parent_id ?? null });
    if (rows.length < PAGE) break;
  }
  return { nodes, nested };
}

/** The folder and every folder beneath it (cycle-safe). Empty when the root isn't in the tree. */
export function folderSubtreeIds(nodes: FolderNode[], rootId: string): string[] {
  if (!nodes.some((n) => n.id === rootId)) return [];
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = children.get(n.parentId) ?? [];
    list.push(n.id);
    children.set(n.parentId, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}

/** Ancestors from the top level down to (and including) `id`. Stops at `stopAt` when given. */
export function folderPath(nodes: FolderNode[], id: string, stopAt?: string): FolderNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: FolderNode[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    if (cur.id === stopAt) break;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function getLibraryFolder(businessId: string, folderId: string): Promise<LibraryFolderRow | null> {
  const db = await createTenantServiceClient(businessId);
  let { data, error } = await db.from("library_folders").select(NESTED_FOLDER_COLUMNS).eq("id", folderId).maybeSingle();
  if (error) {
    // Before v136 (no parent_id column).
    ({ data, error } = await db.from("library_folders").select(FOLDER_COLUMNS).eq("id", folderId).maybeSingle());
  }
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

export type LibraryFolderList = {
  setupRequired: boolean;
  folders: LibraryFolderSummary[];
  /** Migration v136 applied: folders may hold folders. */
  subfoldersSupported: boolean;
};

/** Every folder in the business with its item count, cover, and live share summary. */
export async function listLibraryFolders(businessId: string): Promise<LibraryFolderList> {
  const db = await createTenantServiceClient(businessId);
  let subfoldersSupported = true;
  let { data, error }: { data: unknown[] | null; error: { message: string } | null } = await db
    .from("library_folders")
    .select(NESTED_FOLDER_COLUMNS)
    .order("name");
  if (error) {
    // Before v136 (no parent_id column): every folder is top-level.
    subfoldersSupported = false;
    ({ data, error } = await db.from("library_folders").select(FOLDER_COLUMNS).order("name"));
  }
  if (error) {
    if (isMissingLibraryFoldersRelation(error.message)) return { setupRequired: true, folders: [], subfoldersSupported: false };
    console.error("[library-folders] list failed", error.message);
    return { setupRequired: false, folders: [], subfoldersSupported };
  }
  const rows = (data ?? []) as LibraryFolderRow[];
  if (!rows.length) return { setupRequired: false, folders: [], subfoldersSupported };
  const childCounts = new Map<string, number>();
  for (const r of rows) if (r.parent_id) childCounts.set(r.parent_id, (childCounts.get(r.parent_id) ?? 0) + 1);

  const [{ data: summaries, error: sumErr }, shares] = await Promise.all([
    db.raw.rpc("library_folder_summaries", { p_business_id: businessId }),
    folderShareSummaries(db),
  ]);
  if (sumErr) console.error("[library-folders] summaries failed", sumErr.message);
  const byId = new Map<string, { item_count: number; auto_cover_id: string | null }>();
  for (const s of (summaries ?? []) as { folder_id: string; item_count: number | string; auto_cover_id: string | null }[]) {
    byId.set(s.folder_id, { item_count: Number(s.item_count) || 0, auto_cover_id: s.auto_cover_id });
  }

  // Folders with no photos fall back to the newest video that has a stored poster.
  const needVideo = rows.filter((r) => (byId.get(r.id)?.item_count ?? 0) > 0 && !byId.get(r.id)?.auto_cover_id).map((r) => r.id);
  const videoCovers = needVideo.length ? await newestVideoPosters(db, needVideo) : new Map<string, string>();

  return {
    setupRequired: false,
    subfoldersSupported,
    folders: rows.map((r) => {
      const s = byId.get(r.id);
      const auto = s?.auto_cover_id ?? videoCovers.get(r.id) ?? null;
      return {
        id: r.id,
        name: r.name,
        parentId: r.parent_id ?? null,
        subfolderCount: childCounts.get(r.id) ?? 0,
        itemCount: s?.item_count ?? 0,
        coverAssetId: r.cover_media_asset_id ?? auto,
        autoCoverAssetId: auto,
        coverMode: r.cover_media_asset_id ? "manual" : "auto",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        share: shares[r.id] ?? { link: false, people: 0 },
      } satisfies LibraryFolderSummary;
    }),
  };
}

/**
 * True when the folder, or any folder above it, has a live (unrevoked, unexpired) share — a
 * share of a folder also opens every subfolder in it.
 */
export async function libraryFolderIsShared(businessId: string, folderId: string): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  const shares = await folderShareSummaries(db);
  const live = (id: string) => Boolean(shares[id] && (shares[id].link || shares[id].people > 0));
  if (live(folderId)) return true;
  const { nodes, nested } = await loadFolderTree(businessId);
  if (!nested) return false;
  return folderPath(nodes, folderId).some((n) => live(n.id));
}

/** Newest-added uploaded video with a stored poster, per folder (YouTube links have none). */
async function newestVideoPosters(db: TenantServiceClient, folderIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const part of chunk(folderIds, IN_CHUNK)) {
    const { data, error } = await db
      .from("library_folder_items")
      .select("folder_id, media_asset_id, added_at")
      .in("folder_id", part)
      .not("media_asset_id", "is", null)
      .order("added_at", { ascending: false })
      .limit(2000);
    if (error || !data?.length) continue;
    const rows = data as { folder_id: string; media_asset_id: string }[];
    const ids = [...new Set(rows.map((r) => r.media_asset_id))];
    const ok = new Set<string>();
    for (const idPart of chunk(ids, IN_CHUNK)) {
      const { data: assets } = await db
        .from("media_assets")
        .select("id")
        .in("id", idPart)
        .eq("media_type", "video")
        .not("thumbnail_url", "is", null)
        .neq("media_source", "youtube");
      for (const a of (assets ?? []) as { id: string }[]) ok.add(a.id);
    }
    for (const r of rows) if (!out.has(r.folder_id) && ok.has(r.media_asset_id)) out.set(r.folder_id, r.media_asset_id);
  }
  return out;
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
  return new LibraryFolderError(`A folder named “${name}” already exists here. Choose another name.`, 409);
}

/** Create a folder at the top level, or inside `parentId` (v136). */
export async function createLibraryFolder(
  businessId: string,
  name: string,
  actorId: string | null,
  parentId: string | null = null,
  /** A guest with a "Can upload" folder share made it (v136 attribution; no profile). */
  createdViaShareId: string | null = null
): Promise<LibraryFolderRow> {
  const db = await createTenantServiceClient(businessId);
  if (parentId) {
    const parent = await getLibraryFolder(businessId, parentId);
    if (!parent) throw new LibraryFolderError("Folder not found.", 404);
    if (parent.parent_id === undefined) throw new LibraryFolderError(SUBFOLDERS_SETUP_MESSAGE, 503);
  }
  const { data, error } = await db
    .from("library_folders")
    .insert({
      name,
      created_by: actorId,
      ...(parentId ? { parent_id: parentId } : {}),
      ...(createdViaShareId ? { created_via_share_id: createdViaShareId } : {}),
    })
    .select(parentId ? NESTED_FOLDER_COLUMNS : FOLDER_COLUMNS)
    .single();
  if (error?.code === "23505") throw duplicateName(name);
  if (error?.code === "23514") throw new LibraryFolderError(error.message, 400);
  if (error || !data) fail(error, "Couldn't create the folder.");
  if (parentId) await touchFolder(db, parentId);
  return data as unknown as LibraryFolderRow;
}

/**
 * Move a folder (with everything inside it) into `parentId`, or to the top level with null.
 * Its shares keep working; it now also appears in shares of its new parent folders and drops
 * out of shares of its old ones. The database refuses a move into itself or its own subfolder.
 */
export async function moveLibraryFolder(businessId: string, folderId: string, parentId: string | null): Promise<LibraryFolderRow> {
  const folder = await getLibraryFolder(businessId, folderId);
  if (!folder) throw new LibraryFolderError("Folder not found.", 404);
  if (folder.parent_id === undefined) throw new LibraryFolderError(SUBFOLDERS_SETUP_MESSAGE, 503);
  if ((folder.parent_id ?? null) === parentId) return folder;
  if (parentId) {
    if (parentId === folderId) throw new LibraryFolderError("A folder can't be moved into itself.", 400);
    const { nodes } = await loadFolderTree(businessId);
    if (!nodes.some((n) => n.id === parentId)) throw new LibraryFolderError("Folder not found.", 404);
    if (folderSubtreeIds(nodes, folderId).includes(parentId)) {
      throw new LibraryFolderError("A folder can't be moved into one of its own subfolders.", 400);
    }
  }
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("library_folders")
    .update({ parent_id: parentId, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .select(NESTED_FOLDER_COLUMNS)
    .maybeSingle();
  if (error?.code === "23505") {
    throw new LibraryFolderError(`There's already a folder named “${folder.name}” there. Rename one of them first.`, 409);
  }
  if (error?.code === "23514") throw new LibraryFolderError(error.message, 400);
  if (error) fail(error, "Couldn't move the folder.");
  if (!data) throw new LibraryFolderError("Folder not found.", 404);
  if (parentId) await touchFolder(db, parentId);
  return data as unknown as LibraryFolderRow;
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

/**
 * Manual cover, or null for automatic. Any photo, or any uploaded video that already has a
 * stored poster, from anywhere in this business's library — it doesn't have to be in the
 * folder. Only the reference is saved: the poster is the video's existing thumbnail, so no
 * new file is created. Callers check the user may see the asset.
 */
export async function setLibraryFolderCover(businessId: string, folderId: string, assetId: string | null): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  if (assetId) {
    const { data: asset } = await db
      .from("media_assets")
      .select("media_type, media_source, file_path, thumbnail_url")
      .eq("id", assetId)
      .maybeSingle();
    if (!asset || !isEligibleCover(asset)) {
      throw new LibraryFolderError(
        asset?.media_type === "video"
          ? "This video's thumbnail isn't ready yet. Try again once it finishes processing."
          : "Choose a photo or a video for the cover.",
        400
      );
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

/** Photos with a file, or uploaded videos with a stored poster. */
export function isEligibleCover(a: { media_type: string | null; media_source: string | null; file_path?: string | null; thumbnail_url: string | null }): boolean {
  if (a.media_source === "youtube") return false;
  if (a.media_type === "photo") return Boolean(a.file_path);
  if (a.media_type === "video") return Boolean(a.thumbnail_url);
  return false;
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
/**
 * Move assets into `folderId`: add them there, then take them out of every other folder, so
 * each one lives in exactly one folder. Nothing is copied or deleted — only membership rows
 * change, and the assets keep their projects. Callers authorize the refs first.
 */
export async function moveIntoLibraryFolder(
  businessId: string,
  folderId: string,
  refs: LibraryItemRef[],
  actorId: string | null
): Promise<{ added: number; alreadyInFolder: number; movedFrom: number }> {
  const result = await addLibraryFolderItems(businessId, folderId, refs, actorId);
  const db = await createTenantServiceClient(businessId);
  let movedFrom = 0;
  const touched = new Set<string>();
  const groups: Record<"media_asset_id" | "tour_id" | "model_id", string[]> = { media_asset_id: [], tour_id: [], model_id: [] };
  for (const r of refs) groups[libraryItemColumn(r.kind)].push(r.id);
  for (const [column, ids] of Object.entries(groups) as ["media_asset_id" | "tour_id" | "model_id", string[]][]) {
    for (const part of chunk([...new Set(ids)], IN_CHUNK)) {
      const { data, error } = await db
        .from("library_folder_items")
        .delete()
        .neq("folder_id", folderId)
        .in(column, part)
        .select("folder_id");
      if (error) fail(error, "Moved into the folder, but couldn't take the items out of their old folders.");
      movedFrom += data?.length ?? 0;
      for (const row of (data ?? []) as { folder_id: string }[]) touched.add(row.folder_id);
    }
  }
  for (const id of touched) await touchFolder(db, id);
  return { ...result, movedFrom };
}

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
