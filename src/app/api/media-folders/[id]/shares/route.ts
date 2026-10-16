import { handleShareAction, requireFolderShareAccess, shareStateResponse } from "@/lib/media-share-api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireFolderShareAccess(id);
  if (gate.error) return gate.error;
  return shareStateResponse(gate);
}

/** Share actions for one folder — see handleShareAction. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireFolderShareAccess(id);
  if (gate.error) return gate.error;
  return handleShareAction(gate, request);
}
