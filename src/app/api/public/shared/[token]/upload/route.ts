import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import {
  GuestUploadError,
  completeGuestUpload,
  createGuestFolder,
  notifyGuestUploads,
  signGuestUpload,
} from "@/lib/library-folder-uploads";
import { SHARE_SECURITY_HEADERS, shareDeny } from "@/lib/media-share-preview";
import { resolveMediaShareToken } from "@/lib/media-shares";
import { clientIp } from "@/lib/public-link-api";
import {
  allowShareUploadNotify,
  allowShareUploadRequest,
  isPhotoShareLookupBlocked,
  recordPhotoShareMiss,
} from "@/lib/public-link-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** complete waits for storage to confirm large videos. */
export const maxDuration = 60;

/**
 * Guest uploads into a Media Library folder shared with "Can upload" (v135).
 * POST { action: "sign", fileName, mimeType, fileSize, mediaType, folderId? } → { signedUrl, ticket }
 *   folderId: a subfolder of the shared folder (v136); omitted = the shared folder itself.
 * POST { action: "complete", ticket }                                → { id }
 * POST { action: "create_folder", name, folderId? }                 → { folder: { id, name } } (v136)
 * POST { action: "done", count }                                    → notify the business once per batch
 *
 * The token is re-resolved on every request, so turning the link off or downgrading it to
 * view-only stops uploads immediately (including saves for files already in flight).
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(request);

  const blocked = isPhotoShareLookupBlocked(ip);
  if (blocked.blocked) return shareDeny(429, "Too many requests. Please try again later.", blocked.retryAfterSec);
  const rate = allowShareUploadRequest(ip);
  if (!rate.allowed) return shareDeny(429, "Too many uploads at once. Please wait a moment.", rate.retryAfterSec);

  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return shareDeny(404, "Not found.");

  const share = await resolveMediaShareToken(token, host.businessId);
  if (!share || share.subject.kind !== "library_folder") {
    recordPhotoShareMiss(ip);
    return shareDeny(404, "Not found.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return shareDeny(400, "Invalid request.");
  }

  try {
    switch (body.action) {
      case "sign":
        return NextResponse.json(await signGuestUpload(share, body), { headers: SHARE_SECURITY_HEADERS });
      case "create_folder":
        return NextResponse.json({ folder: await createGuestFolder(share, body) }, { headers: SHARE_SECURITY_HEADERS });
      case "complete":
        return NextResponse.json(await completeGuestUpload(share, body), { headers: SHARE_SECURITY_HEADERS });
      case "done": {
        const count = typeof body.count === "number" ? body.count : 0;
        if (count > 0 && share.allowUpload && allowShareUploadNotify(share.shareId)) {
          await notifyGuestUploads(share, count, body.folderId);
        }
        return NextResponse.json({ ok: true }, { headers: SHARE_SECURITY_HEADERS });
      }
      default:
        return shareDeny(400, "Unknown action.");
    }
  } catch (err) {
    if (err instanceof GuestUploadError) return shareDeny(err.status, err.message);
    console.error("[shared-upload]", err);
    return shareDeny(500, "Something went wrong. Please try again.");
  }
}
