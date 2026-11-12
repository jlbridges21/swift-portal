import { NextResponse } from "next/server";
import { addLibraryFolderItems, libraryFolderIsShared, removeLibraryFolderItems } from "@/lib/library-folders";
import {
  NO_STORE,
  authorizedItemRefs,
  badFolderId,
  canManageWholeFolder,
  folderErrorResponse,
  requireLibraryFolderAccess,
} from "@/lib/library-folder-api";
import { LIBRARY_FOLDER_ITEMS_PER_REQUEST } from "@/lib/library-folder-types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function readItems(request: Request): Promise<unknown[] | NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { items?: unknown };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Choose at least one item." }, { status: 400 });
  }
  if (body.items.length > LIBRARY_FOLDER_ITEMS_PER_REQUEST) {
    return NextResponse.json({ error: `Send up to ${LIBRARY_FOLDER_ITEMS_PER_REQUEST} items at a time.` }, { status: 400 });
  }
  return body.items;
}

/**
 * Add assets to the folder by reference (no copy). Body: { items: ["photo:<uuid>", …] }.
 * Idempotent: items already in the folder are counted, not duplicated.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireLibraryFolderAccess(true);
  if (!auth.ok) return auth.response;
  const bad = badFolderId(id);
  if (bad) return bad;
  const items = await readItems(request);
  if (items instanceof NextResponse) return items;
  try {
    // Adding to a shared folder publishes the additions immediately.
    if (
      (await libraryFolderIsShared(auth.businessId, id)) &&
      !(await canManageWholeFolder(auth.businessId, auth.profile, { sharing: true }))
    ) {
      return NextResponse.json(
        { error: "This folder is shared, so only people who can share media may add to it." },
        { status: 403 }
      );
    }
    const { refs, denied, invalid } = await authorizedItemRefs(auth.businessId, auth.profile, items);
    const result = await addLibraryFolderItems(auth.businessId, id, refs, auth.profile.id);
    return NextResponse.json({ ...result, skipped: denied + invalid }, { headers: NO_STORE });
  } catch (err) {
    return folderErrorResponse(err, "add items");
  }
}

/** Remove assets from the folder. The assets, their projects and their shares are untouched. */
export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireLibraryFolderAccess(true);
  if (!auth.ok) return auth.response;
  const bad = badFolderId(id);
  if (bad) return bad;
  const items = await readItems(request);
  if (items instanceof NextResponse) return items;
  try {
    const { refs, denied, invalid } = await authorizedItemRefs(auth.businessId, auth.profile, items);
    const result = await removeLibraryFolderItems(auth.businessId, id, refs);
    return NextResponse.json({ ...result, skipped: denied + invalid }, { headers: NO_STORE });
  } catch (err) {
    return folderErrorResponse(err, "remove items");
  }
}
