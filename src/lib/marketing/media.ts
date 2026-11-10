/**
 * Marketing Kit image/video URLs (server only).
 *
 * Browsers never receive storage paths. Templates point at app routes
 * (/api/marketing/{project}/img/{id}, /api/public/listing/{kit}/img/{id}) which authorize the
 * request and redirect to a short-lived signed URL. Preview and website sizes are capped
 * (resized by Supabase Image Transformation) — original full-resolution files are never
 * served by the Marketing Kit. Exports sign higher-resolution copies server-side only.
 */
import { TRANSFORM_MAX_SOURCE_BYTES } from "@/lib/media-signed-thumbs";
import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import { MARKETING_BUCKET, type EligibleMediaRow } from "@/lib/marketing/server";
import type { ImageSize } from "@/lib/marketing/view-model";

export const SIZE_WIDTH: Record<ImageSize, number> = { thumb: 480, medium: 1600, large: 2400 };
const SIGN_TTL_SECONDS = 3600;

export function parseImageSize(raw: string | null): ImageSize {
  return raw === "thumb" || raw === "large" ? raw : "medium";
}

async function sign(db: TenantServiceClient, path: string, width: number | null, quality = 80, ttl = SIGN_TTL_SECONDS): Promise<string | null> {
  const { data, error } = await db.raw.storage
    .from(MARKETING_BUCKET)
    .createSignedUrl(path, ttl, width ? { transform: { width, quality, resize: "contain" } } : undefined);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Signed, size-capped URL for an eligible photo (or a video's poster). */
export async function signMediaImage(db: TenantServiceClient, row: EligibleMediaRow, size: ImageSize, exportWidth?: number): Promise<string | null> {
  if (row.media_type === "video") {
    return row.thumbnail_url ? sign(db, row.thumbnail_url, null) : null;
  }
  if (!row.file_path) return null;
  const width = exportWidth ?? SIZE_WIDTH[size];
  const canTransform = (row.file_size ?? 0) > 0 && (row.file_size ?? 0) <= TRANSFORM_MAX_SOURCE_BYTES;
  if (size === "thumb" && row.thumbnail_url && !exportWidth) return sign(db, row.thumbnail_url, null);
  if (canTransform) return sign(db, row.file_path, width, exportWidth ? 90 : 80);
  // Too large for on-the-fly resizing: fall back to the stored thumbnail for previews; exports
  // (server-side only, never sent to a browser) may read the delivered file.
  if (exportWidth) return sign(db, row.file_path, null);
  return row.thumbnail_url ? sign(db, row.thumbnail_url, null) : null;
}

export async function signUpload(db: TenantServiceClient, path: string, size: ImageSize | "export"): Promise<string | null> {
  return sign(db, path, size === "export" ? 1200 : Math.min(SIZE_WIDTH[size], 1200), 85);
}

export async function signVideo(db: TenantServiceClient, row: EligibleMediaRow): Promise<string | null> {
  if (row.media_type !== "video" || row.media_source !== "upload" || !row.file_path) return null;
  return sign(db, row.file_path, null, 80, 2 * 3600);
}

export function redirectTo(url: string, cache: "private" | "public") {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": cache === "public" ? "public, max-age=1500, s-maxage=1500" : "private, max-age=1500",
      "Referrer-Policy": "no-referrer",
    },
  });
}
