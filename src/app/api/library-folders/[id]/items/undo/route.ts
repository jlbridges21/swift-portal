import { NextResponse } from "next/server";
import { libraryFolderIsShared, undoLibraryFolderMove } from "@/lib/library-folders";
import {
  NO_STORE,
  authorizedItemRefs,
  badFolderId,
  canManageWholeFolder,
  folderErrorResponse,
  requireLibraryFolderAccess,
} from "@/lib/library-folder-api";
import { LIBRARY_FOLDER_ITEMS_PER_REQUEST, isUuid, libraryItemKey } from "@/lib/library-folder-types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** An item can sit in many folders; this bounds one request's restore list. */
const MAX_RESTORE = LIBRARY_FOLDER_ITEMS_PER_REQUEST * 20;

function validAddedAt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) && t <= Date.now() + 60_000 ? new Date(t).toISOString() : null;
}

/**
 * Undo a "Move" into this folder. Body (from the move response's `undo`):
 *   { added: ["photo:<uuid>", …], restore: [{ folderId, key, addedAt }, …] }
 * Takes `added` back out of this folder and puts each `restore` membership back. Every item is
 * re-authorized like an add; restoring into a shared folder needs sharing permission, as adding does.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireLibraryFolderAccess(true);
  if (!auth.ok) return auth.response;
  const bad = badFolderId(id);
  if (bad) return bad;

  const body = (await request.json().catch(() => ({}))) as { added?: unknown; restore?: unknown };
  const added = Array.isArray(body.added) ? body.added : [];
  const restoreRaw = Array.isArray(body.restore) ? body.restore : [];
  if (added.length > LIBRARY_FOLDER_ITEMS_PER_REQUEST || restoreRaw.length > MAX_RESTORE) {
    return NextResponse.json({ error: "Too many items to undo at once." }, { status: 400 });
  }
  const restoreIn = restoreRaw
    .map((r) => r as { folderId?: unknown; key?: unknown; addedAt?: unknown })
    .filter((r) => isUuid(r.folderId) && typeof r.key === "string" && r.folderId !== id);

  try {
    const keys = [...new Set([...added, ...restoreIn.map((r) => r.key as string)])];
    if (keys.length > LIBRARY_FOLDER_ITEMS_PER_REQUEST) {
      return NextResponse.json({ error: "Too many items to undo at once." }, { status: 400 });
    }
    const { refs } = await authorizedItemRefs(auth.businessId, auth.profile, keys);
    const byKey = new Map(refs.map((r) => [libraryItemKey(r), r]));
    // Stored kinds may differ from the client's ("document" vs "photo"); match on id as well.
    const byId = new Map(refs.map((r) => [r.id, r]));
    const refFor = (key: string) => byKey.get(key) ?? byId.get(key.slice(key.indexOf(":") + 1));

    const addedRefs = added.map((k) => (typeof k === "string" ? refFor(k) : undefined)).filter((r) => r !== undefined);

    // Putting items back into a shared folder publishes them again, like adding does.
    const folderIds = [...new Set(restoreIn.map((r) => r.folderId as string))];
    let canShare: boolean | null = null;
    const allowedFolders = new Set<string>();
    for (const folderId of folderIds) {
      if (await libraryFolderIsShared(auth.businessId, folderId)) {
        canShare ??= await canManageWholeFolder(auth.businessId, auth.profile, { sharing: true });
        if (!canShare) continue;
      }
      allowedFolders.add(folderId);
    }

    const restore = restoreIn
      .filter((r) => allowedFolders.has(r.folderId as string))
      .map((r) => ({ folderId: r.folderId as string, ref: refFor(r.key as string), addedAt: validAddedAt(r.addedAt) }))
      .filter((r): r is { folderId: string; ref: NonNullable<typeof r.ref>; addedAt: string | null } => r.ref !== undefined);

    const result = await undoLibraryFolderMove(auth.businessId, id, addedRefs, restore, auth.profile.id);
    return NextResponse.json({ ...result, skipped: restoreIn.length - restore.length }, { headers: NO_STORE });
  } catch (err) {
    return folderErrorResponse(err, "undo the move");
  }
}
