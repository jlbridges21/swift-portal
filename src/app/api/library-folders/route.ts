import { NextResponse } from "next/server";
import { createLibraryFolder, libraryFolderIsShared, listLibraryFolders } from "@/lib/library-folders";
import { NO_STORE, canManageWholeFolder, folderErrorResponse, requireLibraryFolderAccess } from "@/lib/library-folder-api";
import { isUuid, normalizeLibraryFolderName } from "@/lib/library-folder-types";

export const dynamic = "force-dynamic";

/** Media Library folders for this business (cards: name, count, cover, share summary). */
export async function GET() {
  const auth = await requireLibraryFolderAccess(false);
  if (!auth.ok) return auth.response;
  const result = await listLibraryFolders(auth.businessId);
  return NextResponse.json(result, { headers: NO_STORE });
}

/** Create a folder. Body: { name, parentId? }. Names are unique among siblings (case-insensitive). */
export async function POST(request: Request) {
  const auth = await requireLibraryFolderAccess(true);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; parentId?: unknown };
  const parsed = normalizeLibraryFolderName(body.name);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (body.parentId != null && !isUuid(body.parentId)) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  const parentId = (body.parentId as string | null | undefined) ?? null;
  try {
    // A new subfolder of a shared folder is shared at once, like adding media to it.
    if (
      parentId &&
      (await libraryFolderIsShared(auth.businessId, parentId)) &&
      !(await canManageWholeFolder(auth.businessId, auth.profile, { sharing: true }))
    ) {
      return NextResponse.json(
        { error: "This folder is shared, so only people who can share media may add folders to it." },
        { status: 403 }
      );
    }
    const folder = await createLibraryFolder(auth.businessId, parsed.name, auth.profile.id, parentId);
    return NextResponse.json({ folder: { id: folder.id, name: folder.name } }, { status: 201, headers: NO_STORE });
  } catch (err) {
    return folderErrorResponse(err, "create");
  }
}
