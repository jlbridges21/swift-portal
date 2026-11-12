import { handleShareAction, requireItemShareAccess, shareStateResponse } from "@/lib/media-share-api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ kind: string; id: string }> };

/** Sharing state for one video / file / 360° tour / 3D model. Photos use /api/media/{id}/shares. */
export async function GET(_request: Request, { params }: Ctx) {
  const { kind, id } = await params;
  const gate = await requireItemShareAccess(kind, id);
  if (gate.error) return gate.error;
  return shareStateResponse(gate);
}

export async function POST(request: Request, { params }: Ctx) {
  const { kind, id } = await params;
  const gate = await requireItemShareAccess(kind, id);
  if (gate.error) return gate.error;
  return handleShareAction(gate, request);
}
