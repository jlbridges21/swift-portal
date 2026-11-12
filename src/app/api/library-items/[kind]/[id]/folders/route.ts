import { NextResponse } from "next/server";
import { listFoldersContaining } from "@/lib/library-folders";
import { NO_STORE, authorizedItemRefs, requireLibraryFolderAccess } from "@/lib/library-folder-api";

export const dynamic = "force-dynamic";

/** Media Library folders that contain this asset (asset drawer: "In folders"). */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const auth = await requireLibraryFolderAccess(false);
  if (!auth.ok) return auth.response;
  const { refs } = await authorizedItemRefs(auth.businessId, auth.profile, [`${kind}:${id}`]);
  if (!refs.length) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const folders = await listFoldersContaining(auth.businessId, refs[0]);
  return NextResponse.json({ folders }, { headers: NO_STORE });
}
