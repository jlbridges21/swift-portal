import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { canAccessMediaAsset, staffCan } from "@/lib/staff-access";
import {
  MediaShareError,
  enableShareLink,
  folderSubject,
  getMediaShareState,
  invitePeople,
  loadShareableFolder,
  loadShareablePhoto,
  parseMediaShareExpiry,
  photoSubject,
  resendEmailShare,
  revokeShare,
  updateShare,
  type ShareSubject,
} from "@/lib/media-shares";
import { isMediaShareExpiryPreset, type MediaInviteResult, type MediaShareState } from "@/lib/media-share-types";
import { parseShareEmailInput } from "@/lib/share-email-parse";
import type { Profile } from "@/lib/types";

export type PhotoSharePermissions = { email: boolean; link: boolean };

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function photoSharePermissions(profile: Profile | null | undefined): PhotoSharePermissions {
  return {
    email: staffCan(profile, "sharing.email"),
    link: staffCan(profile, "sharing.anyone_with_link"),
  };
}

/** Hide the link URL from users who may not manage "anyone with the link". */
export function shareStateFor(state: MediaShareState, perms: PhotoSharePermissions): MediaShareState {
  if (perms.link || !state.link) return state;
  return { ...state, link: { ...state.link, url: null } };
}

type Gate =
  | { error: NextResponse }
  | { error?: undefined; profile: Profile; businessId: string; subject: ShareSubject; perms: PhotoSharePermissions };

async function requireShareAccess(
  load: (businessId: string) => Promise<{ subject: ShareSubject; projectId: string | null } | null>,
  notFoundMessage: string
): Promise<Gate> {
  const profile = await getProfile();
  if (!profile) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const perms = photoSharePermissions(profile);
  if (!perms.email && !perms.link) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) };

  const found = await load(tenant.businessId);
  if (!found || !(await canAccessMediaAsset(tenant.businessId, profile, found.projectId))) {
    return { error: NextResponse.json({ error: notFoundMessage }, { status: 404 }) };
  }
  return { profile, businessId: tenant.businessId, subject: found.subject, perms };
}

/**
 * Owner/staff gate for one photo's shares: a sharing permission, the photo's
 * project must be visible to this user, and the photo must be shareable.
 * Unknown or inaccessible photos are 404 so existence is not confirmed.
 */
export function requirePhotoShareAccess(mediaId: string): Promise<Gate> {
  return requireShareAccess(async (businessId) => {
    const photo = await loadShareablePhoto(businessId, mediaId);
    return photo ? { subject: photoSubject(photo), projectId: photo.project_id } : null;
  }, "Photo not found.");
}

/** Same gate for a folder's shares; the folder's project must be visible to this user. */
export function requireFolderShareAccess(folderId: string): Promise<Gate> {
  return requireShareAccess(async (businessId) => {
    const folder = await loadShareableFolder(businessId, folderId);
    return folder ? { subject: folderSubject(folder), projectId: folder.project_id } : null;
  }, "Folder not found.");
}

export async function shareStateResponse(gate: Exclude<Gate, { error: NextResponse }>) {
  const state = await getMediaShareState(gate.subject);
  return NextResponse.json(
    { state: shareStateFor(state, gate.perms), permissions: gate.perms },
    { headers: NO_STORE }
  );
}

type ActionBody = {
  action?: string;
  emails?: string[] | string;
  shareId?: string;
  allowDownload?: boolean;
  expiryPreset?: string;
};

/**
 * Actions: invite, resend, enable_link, rotate_link, update, revoke.
 * Responses never contain an invite token; link URLs are only returned to
 * users allowed to manage "anyone with the link".
 */
export async function handleShareAction(gate: Exclude<Gate, { error: NextResponse }>, request: Request) {
  const { subject, profile, perms } = gate;

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actorId = profile.id;
  let results: MediaInviteResult[] | undefined;

  try {
    const state = await getMediaShareState(subject);
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
        results = await invitePeople({
          subject,
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
        results = [await resendEmailShare({ subject, shareId: body.shareId, actorId })];
        break;
      }
      case "enable_link":
      case "rotate_link": {
        if (!perms.link) return forbidden();
        const current = state.link;
        await enableShareLink({
          subject,
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
        await updateShare({
          subject,
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
        await revokeShare({ subject, shareId: body.shareId, actorId });
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const next = await getMediaShareState(subject);
    return NextResponse.json(
      { state: shareStateFor(next, perms), results, permissions: perms },
      { headers: NO_STORE }
    );
  } catch (error) {
    if (error instanceof MediaShareError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const subjectId = subject.kind === "photo" ? subject.photo.id : subject.folder.id;
    console.error("[media-shares] action failed", { kind: subject.kind, subjectId, action: body.action, error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
