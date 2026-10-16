import { NextResponse } from "next/server";
import { requirePhotoShareAccess, shareStateFor } from "@/lib/media-share-api";
import {
  MediaShareError,
  enablePhotoLink,
  getMediaShareState,
  invitePeopleToPhoto,
  parseMediaShareExpiry,
  resendEmailShare,
  revokePhotoShare,
  updatePhotoShare,
} from "@/lib/media-shares";
import { isMediaShareExpiryPreset, type MediaInviteResult } from "@/lib/media-share-types";
import { parseShareEmailInput } from "@/lib/share-email-parse";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

type Body = {
  action?: string;
  emails?: string[] | string;
  shareId?: string;
  allowDownload?: boolean;
  expiryPreset?: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requirePhotoShareAccess(id);
  if (gate.error) return gate.error;
  const state = await getMediaShareState(gate.businessId, gate.photo.id);
  return NextResponse.json(
    { state: shareStateFor(state, gate.perms), permissions: gate.perms },
    { headers: NO_STORE }
  );
}

/**
 * Actions: invite, resend, enable_link, rotate_link, update, revoke.
 * Responses never contain an invite token; link URLs are only returned to
 * users allowed to manage "anyone with the link".
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requirePhotoShareAccess(id);
  if (gate.error) return gate.error;
  const { photo, profile, perms, businessId } = gate;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actorId = profile.id;
  let results: MediaInviteResult[] | undefined;

  try {
    const state = await getMediaShareState(businessId, photo.id);
    const target = body.shareId
      ? state.link?.id === body.shareId
        ? ("link" as const)
        : state.people.some((p) => p.id === body.shareId)
          ? ("email" as const)
          : null
      : null;
    const canManage = (kind: "link" | "email" | null) =>
      kind === "link" ? perms.link : kind === "email" ? perms.email : false;

    switch (body.action) {
      case "invite": {
        if (!perms.email) return forbidden();
        const emails = Array.isArray(body.emails)
          ? body.emails
          : parseShareEmailInput(typeof body.emails === "string" ? body.emails : "");
        results = await invitePeopleToPhoto({
          photo,
          emails,
          allowDownload: body.allowDownload === true,
          expiryPreset: parseMediaShareExpiry(body.expiryPreset),
          actorId,
        });
        break;
      }
      case "resend": {
        if (!body.shareId || target !== "email") throw new MediaShareError("Share not found.", 404);
        if (!perms.email) return forbidden();
        results = [await resendEmailShare({ photo, shareId: body.shareId, actorId })];
        break;
      }
      case "enable_link":
      case "rotate_link": {
        if (!perms.link) return forbidden();
        const current = state.link;
        await enablePhotoLink({
          photo,
          allowDownload:
            typeof body.allowDownload === "boolean" ? body.allowDownload : (current?.allow_download ?? false),
          expiryPreset: isMediaShareExpiryPreset(body.expiryPreset)
            ? body.expiryPreset
            : (current?.expiry_preset ?? "indefinite"),
          actorId,
          rotate: body.action === "rotate_link",
        });
        break;
      }
      case "update": {
        if (!body.shareId || !target) throw new MediaShareError("Share not found.", 404);
        if (!canManage(target)) return forbidden();
        await updatePhotoShare({
          photo,
          shareId: body.shareId,
          allowDownload: typeof body.allowDownload === "boolean" ? body.allowDownload : undefined,
          expiryPreset: isMediaShareExpiryPreset(body.expiryPreset) ? body.expiryPreset : undefined,
          actorId,
        });
        break;
      }
      case "revoke": {
        if (!body.shareId || !target) throw new MediaShareError("Share not found.", 404);
        if (!canManage(target)) return forbidden();
        await revokePhotoShare({ photo, shareId: body.shareId, actorId });
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const next = await getMediaShareState(businessId, photo.id);
    return NextResponse.json(
      { state: shareStateFor(next, perms), results, permissions: perms },
      { headers: NO_STORE }
    );
  } catch (error) {
    if (error instanceof MediaShareError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[media-shares] action failed", { mediaId: photo.id, action: body.action, error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
