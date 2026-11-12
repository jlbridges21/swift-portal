import { NextResponse } from "next/server";
import {
  deleteLibraryFolder,
  getLibraryFolder,
  renameLibraryFolder,
  setLibraryFolderCover,
} from "@/lib/library-folders";
import {
  NO_STORE,
  authorizedItemRefs,
  badFolderId,
  canManageWholeFolder,
  folderErrorResponse,
  requireLibraryFolderAccess,
} from "@/lib/library-folder-api";
import { isUuid, normalizeLibraryFolderName } from "@/lib/library-folder-types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireLibraryFolderAccess(false);
  if (!auth.ok) return auth.response;
  const bad = badFolderId(id);
  if (bad) return bad;
  try {
    const folder = await getLibraryFolder(auth.businessId, id);
    if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    return NextResponse.json(
      { folder: { id: folder.id, name: folder.name, coverAssetId: folder.cover_media_asset_id } },
      { headers: NO_STORE }
    );
  } catch (err) {
    return folderErrorResponse(err, "get");
  }
}

/** Rename and/or set the cover. Body: { name?, coverAssetId?: uuid | null } (null = automatic). */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireLibraryFolderAccess(true);
  if (!auth.ok) return auth.response;
  const bad = badFolderId(id);
  if (bad) return bad;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; coverAssetId?: unknown };
  try {
    if (body.name !== undefined) {
      const parsed = normalizeLibraryFolderName(body.name);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      await renameLibraryFolder(auth.businessId, id, parsed.name);
    }
    if (body.coverAssetId !== undefined) {
      if (body.coverAssetId !== null && !isUuid(body.coverAssetId)) {
        return NextResponse.json({ error: "Choose a photo or a video for the cover." }, { status: 400 });
      }
      // The cover may come from anywhere in the library: the user must be able to see it.
      if (body.coverAssetId !== null) {
        const { refs } = await authorizedItemRefs(auth.businessId, auth.profile, [`photo:${body.coverAssetId}`]);
        if (!refs.length) return NextResponse.json({ error: "That photo or video isn't available." }, { status: 404 });
      }
      await setLibraryFolderCover(auth.businessId, id, body.coverAssetId);
    }
    const folder = await getLibraryFolder(auth.businessId, id);
    if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    return NextResponse.json(
      { folder: { id: folder.id, name: folder.name, coverAssetId: folder.cover_media_asset_id } },
      { headers: NO_STORE }
    );
  } catch (err) {
    return folderErrorResponse(err, "update");
  }
}

/** Delete the folder and its membership only — never the media in it. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireLibraryFolderAccess(true);
  if (!auth.ok) return auth.response;
  const bad = badFolderId(id);
  if (bad) return bad;
  if (!(await canManageWholeFolder(auth.businessId, auth.profile))) {
    return NextResponse.json({ error: "Only people who can see every project can delete folders." }, { status: 403 });
  }
  try {
    await deleteLibraryFolder(auth.businessId, id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return folderErrorResponse(err, "delete");
  }
}
