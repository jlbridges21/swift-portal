import { handleShareAction, requireLibraryFolderShareAccess, shareStateResponse } from "@/lib/media-share-api";

export const dynamic = "force-dynamic";

/** Sharing state for one Media Library folder (people + "anyone with the link"). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireLibraryFolderShareAccess(id);
  if (gate.error) return gate.error;
  return shareStateResponse(gate);
}

/** Share actions for one Media Library folder — see handleShareAction. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireLibraryFolderShareAccess(id);
  if (gate.error) return gate.error;
  return handleShareAction(gate, request);
}
