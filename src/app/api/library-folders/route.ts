import { NextResponse } from "next/server";
import { createLibraryFolder, listLibraryFolders } from "@/lib/library-folders";
import { NO_STORE, folderErrorResponse, requireLibraryFolderAccess } from "@/lib/library-folder-api";
import { normalizeLibraryFolderName } from "@/lib/library-folder-types";

export const dynamic = "force-dynamic";

/** Media Library folders for this business (cards: name, count, cover, share summary). */
export async function GET() {
  const auth = await requireLibraryFolderAccess(false);
  if (!auth.ok) return auth.response;
  const result = await listLibraryFolders(auth.businessId);
  return NextResponse.json(result, { headers: NO_STORE });
}

/** Create a folder. Body: { name }. Names are unique per business (case-insensitive). */
export async function POST(request: Request) {
  const auth = await requireLibraryFolderAccess(true);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const parsed = normalizeLibraryFolderName(body.name);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const folder = await createLibraryFolder(auth.businessId, parsed.name, auth.profile.id);
    return NextResponse.json({ folder: { id: folder.id, name: folder.name } }, { status: 201, headers: NO_STORE });
  } catch (err) {
    return folderErrorResponse(err, "create");
  }
}
