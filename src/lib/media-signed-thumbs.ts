import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAsset } from "@/lib/types";

/** Signed thumbnail URL TTL — long enough for browser cache / scroll-back reuse. */
export const THUMB_SIGNED_TTL_SECONDS = 7200;

/** Supabase Image Transformation rejects sources larger than this. */
export const TRANSFORM_MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/** Grid transform size when no stored thumbnail exists (and source ≤ 25MB). */
export const THUMB_TRANSFORM_EDGE = 400;

export type ThumbSignAsset = Pick<
  MediaAsset,
  | "id"
  | "file_path"
  | "thumbnail_url"
  | "media_type"
  | "media_source"
  | "mime_type"
  | "file_name"
  | "file_size"
  | "business_id"
>;

/**
 * Resolve a signed URL suitable for a grid/list tile.
 * Prefer stored thumbnail_url; else on-the-fly transform for photos ≤25MB;
 * else full original (degraded — keeps tiles working until backfill).
 */
export async function signMediaThumbnailUrl(
  storage: SupabaseClient,
  bucket: string,
  asset: ThumbSignAsset,
  ttlSeconds: number = THUMB_SIGNED_TTL_SECONDS
): Promise<string | null> {
  if (asset.media_source === "youtube") return null;
  if (asset.media_type === "video" || asset.media_type === "document") return null;

  if (asset.thumbnail_url) {
    const { data, error } = await storage.storage
      .from(bucket)
      .createSignedUrl(asset.thumbnail_url, ttlSeconds);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  if (asset.media_type !== "photo" || !asset.file_path) return null;

  const size = asset.file_size ?? 0;
  const canTransform = size > 0 && size <= TRANSFORM_MAX_SOURCE_BYTES;

  const { data, error } = await storage.storage.from(bucket).createSignedUrl(
    asset.file_path,
    ttlSeconds,
    canTransform
      ? {
          transform: {
            width: THUMB_TRANSFORM_EDGE,
            height: THUMB_TRANSFORM_EDGE,
            resize: "contain",
            quality: 70,
          },
        }
      : undefined
  );

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
