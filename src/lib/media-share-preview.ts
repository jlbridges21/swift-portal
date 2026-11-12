import { NextResponse } from "next/server";
import { recordEgress } from "@/lib/egress-metering";
import { TRANSFORM_MAX_SOURCE_BYTES } from "@/lib/media-signed-thumbs";
import { PUBLIC_LINK_CACHE_HEADERS } from "@/lib/public-link-api";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

/** Shared by the public photo / folder / library share routes (moved from /api/public/photo). */

const BUCKET = "project-media";
/** Only used server-side to fetch bytes; never sent to the browser. */
const INTERNAL_SIGN_TTL_SECONDS = 60;

export const SHARE_SECURITY_HEADERS = {
  ...PUBLIC_LINK_CACHE_HEADERS,
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export function shareDeny(status: number, error: string, retryAfterSec?: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        ...SHARE_SECURITY_HEADERS,
        ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}),
      },
    }
  );
}

export type PreviewablePhoto = { id: string; file_path: string; file_size: number | null };

/**
 * Streams a resized preview through this route rather than redirecting to a
 * signed storage URL, so revocation takes effect on the very next request.
 * Never serves the original bytes — that is what "view only" withholds.
 */
export async function streamPreview(photo: PreviewablePhoto, businessId: string, edge: number): Promise<NextResponse> {
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
        const len = Number(res.headers.get("content-length"));
        recordEgress(businessId, "proxied_download", Number.isFinite(len) && len > 0 ? len : 0, { imageTransforms: 1 });
      }
    }
  }

  // Storage can't transform sources over its size limit; resize here instead.
  if (!body) {
    const { data: file, error } = await storage.download(photo.file_path);
    if (error || !file) return shareDeny(502, "We couldn't load this photo. Please try again.");
    try {
      const sharp = (await import("sharp")).default;
      body = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      contentType = "image/jpeg";
      recordEgress(businessId, "proxied_download", file.size);
    } catch (err) {
      console.error("[photo-share] preview resize failed", { mediaId: photo.id, err });
      return shareDeny(502, "We couldn't load this photo. Please try again.");
    }
  }

  return new NextResponse(body as BodyInit, {
    headers: {
      ...SHARE_SECURITY_HEADERS,
      "Content-Type": contentType,
      "Content-Disposition": "inline",
    },
  });
}

