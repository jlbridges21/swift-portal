import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  VideoShareError,
  disableVideoShare,
  enableVideoShare,
  getVideoShareState,
  resetVideoShareLink,
  resolveVideoShareActor,
  saveVideoEmbedSettings,
} from "@/lib/video-public-shares";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

async function gate(mediaId: string) {
  const profile = await getProfile();
  if (!profile) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) };
  const actor = await resolveVideoShareActor(profile, tenant, mediaId);
  // 404 for anything the user can't see, so existence isn't confirmed.
  if (!actor) return { error: NextResponse.json({ error: "Video not found." }, { status: 404 }) };
  return { actor };
}

/** Public sharing state for one video (owner, staff, or a client with access). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gate(id);
  if (g.error) return g.error;
  try {
    return NextResponse.json(await getVideoShareState(g.actor), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof VideoShareError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    }
    console.error("[video-public-share] state failed", { mediaId: id, error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/**
 * Actions: enable, disable, reset_link, save_embed. Each re-checks the caller's
 * permission (business sharing permission, or the business's client-sharing setting).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gate(id);
  if (g.error) return g.error;

  let body: { action?: string; embedSettings?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "enable":
        await enableVideoShare(g.actor, body.embedSettings);
        break;
      case "disable":
        await disableVideoShare(g.actor);
        break;
      case "reset_link":
        await resetVideoShareLink(g.actor);
        break;
      case "save_embed":
        await saveVideoEmbedSettings(g.actor, body.embedSettings);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json(await getVideoShareState(g.actor), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof VideoShareError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    }
    console.error("[video-public-share] action failed", { mediaId: id, action: body.action, error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
