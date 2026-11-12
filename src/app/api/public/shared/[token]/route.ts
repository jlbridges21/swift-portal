import { NextResponse } from "next/server";
import { recordEgress } from "@/lib/egress-metering";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { resolveSharedLibraryItem } from "@/lib/library-folder-shares";
import { trackMediaDownload } from "@/lib/media-library";
import { SHARE_SECURITY_HEADERS, shareDeny, streamPreview } from "@/lib/media-share-preview";
import { resolveMediaShareToken } from "@/lib/media-shares";
import { clientIp } from "@/lib/public-link-api";
import {
  allowPhotoShareAssetRequest,
  isPhotoShareLookupBlocked,
  recordPhotoShareMiss,
} from "@/lib/public-link-rate-limit";
import { serveMediaFileDownload } from "@/lib/serve-media-file-download";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_BUCKET = "project-media";
const DOCUMENT_BUCKET = "project-documents";
const PREVIEW_EDGE = 2048;
const THUMB_EDGE = 640;
/** Video playback needs range requests straight from storage; the URL dies after this. */
const STREAM_TTL_SECONDS = 60 * 60;

/**
 * Bytes for one item of a Media Library folder share or a single-item share.
 * GET ?item=<kind:id>&variant=thumb|preview|poster|stream|original|inline
 *
 * Every request re-resolves the token AND the item (membership, visibility, project state,
 * download rules), so removing an item, revoking, or expiring the share takes effect on the
 * very next request. Photos and posters are streamed through this route; only video
 * playback hands out a short-lived signed storage URL (needed for seeking). Like video in the
 * client portal, playback streams the original file, so "view only" can't stop a determined
 * viewer from saving a video; the Download button and original/inline variants do obey
 * the share setting and the project download rule.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(request);

  const blocked = isPhotoShareLookupBlocked(ip);
  if (blocked.blocked) return shareDeny(429, "Too many requests. Please try again later.", blocked.retryAfterSec);
  const rate = allowPhotoShareAssetRequest(ip);
  if (!rate.allowed) return shareDeny(429, "Too many requests. Please try again later.", rate.retryAfterSec);

  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return shareDeny(404, "Not found.");

  const share = await resolveMediaShareToken(token, host.businessId);
  if (!share || (share.subject.kind !== "library_folder" && share.subject.kind !== "item")) {
    recordPhotoShareMiss(ip);
    return shareDeny(404, "Not found.");
  }

  const url = new URL(request.url);
  const src = await resolveSharedLibraryItem(share, url.searchParams.get("item"));
  if (!src) return shareDeny(404, "Not found.");
  const { item } = src;
  const variant = url.searchParams.get("variant") ?? "preview";
  const db = await createTenantServiceClient(share.businessId);

  if (variant === "thumb" || variant === "preview") {
    if (item.kind !== "photo" || !src.filePath) return shareDeny(404, "Not found.");
    return streamPreview(
      { id: src.id, file_path: src.filePath, file_size: item.fileSize },
      share.businessId,
      variant === "thumb" ? THUMB_EDGE : PREVIEW_EDGE
    );
  }

  if (variant === "poster") {
    if (item.kind !== "video" || !src.thumbnailPath) return shareDeny(404, "Not found.");
    const { data: file, error } = await db.raw.storage.from(MEDIA_BUCKET).download(src.thumbnailPath);
    if (error || !file) return shareDeny(404, "Not found.");
    recordEgress(share.businessId, "proxied_download", file.size);
    return new NextResponse(file.stream() as BodyInit, {
      headers: {
        ...SHARE_SECURITY_HEADERS,
        "Content-Type": file.type || "image/jpeg",
        "Content-Disposition": "inline",
      },
    });
  }

  if (variant === "stream") {
    if (item.kind !== "video" || !item.hasFile || !src.filePath) return shareDeny(404, "Not found.");
    const { data, error } = await db.raw.storage.from(MEDIA_BUCKET).createSignedUrl(src.filePath, STREAM_TTL_SECONDS);
    if (error || !data?.signedUrl) return shareDeny(502, "We couldn't load this video. Please try again.");
    recordEgress(share.businessId, "signed_delivery", item.fileSize ?? 0);
    return NextResponse.json({ url: data.signedUrl }, { headers: SHARE_SECURITY_HEADERS });
  }

  if (variant === "original" || variant === "inline") {
    if (!item.hasFile || !src.filePath) return shareDeny(404, "Not found.");
    if (!item.canDownload) {
      return shareDeny(
        403,
        item.downloadLocked ? "Downloads for this item aren't available yet." : "Downloads aren't enabled for this share."
      );
    }
    // Inline viewing is only for PDFs; everything else downloads as an attachment.
    const inline = variant === "inline" && item.isPdf;
    const res = await serveMediaFileDownload({
      storage: db.raw,
      bucket: item.kind === "document" ? DOCUMENT_BUCKET : MEDIA_BUCKET,
      asset: {
        id: src.id,
        file_path: src.filePath,
        file_name: src.fileName ?? item.title,
        mime_type: src.mimeType,
        media_type: src.mediaType,
        file_size: item.fileSize,
      },
      searchParams: url.searchParams,
      inline,
      meterBusinessId: share.businessId,
      onSuccess: () => {
        void trackMediaDownload({
          businessId: share.businessId,
          mediaAssetId: src.id,
          email: share.email,
          ipAddress: ip,
        });
      },
    });
    for (const [key, value] of Object.entries(SHARE_SECURITY_HEADERS)) res.headers.set(key, value);
    return res;
  }

  return shareDeny(400, "Unknown variant.");
}
