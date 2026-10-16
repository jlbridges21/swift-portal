import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { clientIp, PUBLIC_LINK_CACHE_HEADERS } from "@/lib/public-link-api";
import {
  allowPhotoShareAssetRequest,
  isPhotoShareLookupBlocked,
  recordPhotoShareMiss,
} from "@/lib/public-link-rate-limit";
import { resolveMediaShareToken, resolveSharedPhoto, type ShareablePhoto } from "@/lib/media-shares";
import { TRANSFORM_MAX_SOURCE_BYTES } from "@/lib/media-signed-thumbs";
import { serveMediaFileDownload } from "@/lib/serve-media-file-download";
import { trackMediaDownload } from "@/lib/media-library";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "project-media";
const PREVIEW_EDGE = 2048;
const THUMB_EDGE = 640;
/** Only used server-side to fetch bytes; never sent to the browser. */
const INTERNAL_SIGN_TTL_SECONDS = 60;

const SECURITY_HEADERS = {
  ...PUBLIC_LINK_CACHE_HEADERS,
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function deny(status: number, error: string, retryAfterSec?: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        ...SECURITY_HEADERS,
        ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}),
      },
    }
  );
}

/**
 * Streams a resized preview through this route rather than redirecting to a
 * signed storage URL, so revocation takes effect on the very next request.
 * Never serves the original bytes — that is what "view only" withholds.
 */
async function streamPreview(photo: ShareablePhoto, businessId: string, edge: number): Promise<NextResponse> {
  const db = await createTenantServiceClient(businessId);
  const storage = db.raw.storage.from(BUCKET);
  const size = photo.file_size ?? 0;
  const canTransform = size > 0 && size <= TRANSFORM_MAX_SOURCE_BYTES;

  let body: ReadableStream<Uint8Array> | Buffer | null = null;
  let contentType = "image/jpeg";

  if (canTransform) {
    const { data } = await storage.createSignedUrl(photo.file_path, INTERNAL_SIGN_TTL_SECONDS, {
      transform: { width: edge, height: edge, resize: "contain", quality: 80 },
    });
    if (data?.signedUrl) {
      const res = await fetch(data.signedUrl, { cache: "no-store" });
      if (res.ok && res.body) {
        body = res.body;
        contentType = res.headers.get("content-type") || contentType;
      }
    }
  }

  // Storage can't transform sources over its size limit; resize here instead.
  if (!body) {
    const { data: file, error } = await storage.download(photo.file_path);
    if (error || !file) return deny(502, "We couldn't load this photo. Please try again.");
    try {
      const sharp = (await import("sharp")).default;
      body = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      contentType = "image/jpeg";
    } catch (err) {
      console.error("[photo-share] preview resize failed", { mediaId: photo.id, err });
      return deny(502, "We couldn't load this photo. Please try again.");
    }
  }

  return new NextResponse(body as BodyInit, {
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": contentType,
      "Content-Disposition": "inline",
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(request);

  const blocked = isPhotoShareLookupBlocked(ip);
  if (blocked.blocked) return deny(429, "Too many requests. Please try again later.", blocked.retryAfterSec);
  const rate = allowPhotoShareAssetRequest(ip);
  if (!rate.allowed) return deny(429, "Too many requests. Please try again later.", rate.retryAfterSec);

  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return deny(404, "Not found.");

  const share = await resolveMediaShareToken(token, host.businessId);
  if (!share) {
    recordPhotoShareMiss(ip);
    return deny(404, "Not found.");
  }

  // Folder shares name the photo; it must be in the folder at this moment.
  const url = new URL(request.url);
  const photo = await resolveSharedPhoto(share, url.searchParams.get("photo"));
  if (!photo) return deny(404, "Not found.");

  const variant = url.searchParams.get("variant") ?? "preview";

  if (variant === "preview") return streamPreview(photo, share.businessId, PREVIEW_EDGE);
  if (variant === "thumb") return streamPreview(photo, share.businessId, THUMB_EDGE);

  if (variant === "original") {
    if (!share.allowDownload) return deny(403, "Downloads aren't enabled for this photo.");
    const db = await createTenantServiceClient(share.businessId);
    const res = await serveMediaFileDownload({
      storage: db.raw,
      bucket: BUCKET,
      asset: photo,
      searchParams: url.searchParams,
      onSuccess: () => {
        void trackMediaDownload({
          businessId: share.businessId,
          mediaAssetId: photo.id,
          email: share.email,
          ipAddress: ip,
        });
      },
    });
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(key, value);
    return res;
  }

  return deny(400, "Unknown variant.");
}
