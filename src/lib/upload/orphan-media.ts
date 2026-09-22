/**
 * Shared helpers to detect media_assets rows whose storage objects are missing.
 * Used by audit/repair scripts and the repair API.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MediaAssetOrphanRow = {
  id: string;
  business_id: string;
  project_id: string | null;
  file_name: string;
  file_path: string | null;
  storage_path: string | null;
  thumbnail_url: string | null;
  media_type: string;
  media_source: string | null;
  created_at: string;
  file_size: number | null;
};

export type OrphanCheckResult = {
  id: string;
  business_id: string;
  project_id: string | null;
  file_name: string;
  media_type: string;
  file_path: string;
  thumbnail_url: string | null;
  created_at: string;
  file_size: number | null;
  file_missing: boolean;
  thumb_missing: boolean | null;
};

export function storageBucketForMediaType(mediaType: string): string {
  return mediaType === "document" ? "project-documents" : "project-media";
}

export function isStorageBackedAsset(row: Pick<MediaAssetOrphanRow, "media_source" | "file_path" | "storage_path">): boolean {
  if (row.media_source === "youtube" || row.media_source === "kuula" || row.media_source === "external") {
    return false;
  }
  return !!(row.file_path || row.storage_path);
}

/** Prove object existence with a real byte fetch (signed URL mint alone is insufficient). */
export async function storageObjectExists(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<"exists" | "missing" | "error"> {
  if (!path.trim()) return "missing";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    const msg = (error?.message || "").toLowerCase();
    if (/not found|does not exist|no such|404/.test(msg)) return "missing";
    // Could not mint a URL — treat as missing for orphan detection (safer than false "exists").
    return "missing";
  }
  try {
    const head = await fetch(data.signedUrl, { method: "HEAD", cache: "no-store" });
    if (head.ok) return "exists";
    const get = await fetch(data.signedUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
    });
    if (get.ok || get.status === 206) return "exists";
    if (get.status === 400 || get.status === 404) return "missing";
    return "error";
  } catch {
    return "error";
  }
}

export async function checkAssetForOrphan(
  supabase: SupabaseClient,
  row: MediaAssetOrphanRow
): Promise<OrphanCheckResult | null> {
  if (!isStorageBackedAsset(row)) return null;
  const path = (row.file_path || row.storage_path || "").trim();
  if (!path) return null;

  const bucket = storageBucketForMediaType(row.media_type);
  const fileStatus = await storageObjectExists(supabase, bucket, path);
  let thumbMissing: boolean | null = null;
  if (row.thumbnail_url) {
    const thumbStatus = await storageObjectExists(supabase, "project-media", row.thumbnail_url);
    thumbMissing = thumbStatus === "missing";
  }

  const fileMissing = fileStatus === "missing";
  if (!fileMissing && thumbMissing !== true) return null;

  return {
    id: row.id,
    business_id: row.business_id,
    project_id: row.project_id,
    file_name: row.file_name,
    media_type: row.media_type,
    file_path: path,
    thumbnail_url: row.thumbnail_url,
    created_at: row.created_at,
    file_size: row.file_size,
    file_missing: fileMissing,
    thumb_missing: thumbMissing,
  };
}
