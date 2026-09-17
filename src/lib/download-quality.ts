import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadFileName } from "@/lib/media-display-name";
import { TRANSFORM_MAX_SOURCE_BYTES } from "@/lib/media-signed-thumbs";

/** Client-selectable photo download quality. */
export type DownloadQuality = "print" | "mls";

/** MLS long-edge target (contain box = 2048×2048). */
export const MLS_LONG_EDGE = 2048;

/** MLS JPEG quality for Supabase Image Transformation. */
export const MLS_TRANSFORM_QUALITY = 85;

export const DOWNLOAD_QUALITY_PARAM = "quality";

/** Human-readable copy for UI + ZIP notes. */
export const MLS_OVERSIZE_DISCLOSURE =
  `Photos larger than ${Math.round(TRANSFORM_MAX_SOURCE_BYTES / (1024 * 1024))}MB (or that our storage provider cannot resize) download at original (Print) size instead.`;

export const DOWNLOAD_QUALITY_PHOTOS_ONLY_NOTE =
  "Quality applies to photos only. Videos, documents, and tours always download as-is.";

export function parseDownloadQuality(raw: string | null | undefined): DownloadQuality {
  return raw === "mls" ? "mls" : "print";
}

export function canApplyMlsTransform(fileSize: number | null | undefined): boolean {
  const size = fileSize ?? 0;
  return size > 0 && size <= TRANSFORM_MAX_SOURCE_BYTES;
}

/**
 * Insert a quality tag before the extension so filenames make the mode obvious.
 * e.g. kitchen.jpg → kitchen-MLS.jpg / kitchen-Print.jpg
 */
export function downloadFileNameForQuality(
  asset: { title?: string | null; file_name?: string | null },
  quality: DownloadQuality,
  opts?: { mlsFellBackToPrint?: boolean }
): string {
  const base = downloadFileName(asset);
  const tag = opts?.mlsFellBackToPrint
    ? "Print-original"
    : quality === "mls"
      ? "MLS"
      : "Print";
  return insertQualityTag(base, tag);
}

export function insertQualityTag(fileName: string, tag: string): string {
  const safeTag = tag.replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeTag) return fileName;
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return `${fileName}-${safeTag}`;
  return `${fileName.slice(0, dot)}-${safeTag}${fileName.slice(dot)}`;
}

export function zipQualityLabel(quality: DownloadQuality): string {
  return quality === "mls" ? "MLS" : "Print";
}

/** Append -Print / -MLS before .zip so the archive quality is obvious. */
export function appendZipQualitySuffix(filename: string, quality: DownloadQuality): string {
  const label = zipQualityLabel(quality);
  if (filename.toLowerCase().endsWith(".zip")) {
    return `${filename.slice(0, -4)}-${label}.zip`;
  }
  return `${filename}-${label}`;
}

export type MlsSignResult =
  | { ok: true; signedUrl: string; transformed: true }
  | {
      ok: true;
      signedUrl: string;
      transformed: false;
      reason: "oversized_source" | "sign_failed_no_transform" | "transform_fetch_failed";
    }
  | { ok: false; error: string };

/**
 * Mint a signed URL for an MLS photo download.
 * Uses 2048×2048 contain when the source is within TRANSFORM_MAX_SOURCE_BYTES;
 * otherwise signs the original (caller must disclose the Print fallback).
 */
export async function signMlsPhotoDownloadUrl(
  storage: SupabaseClient,
  bucket: string,
  filePath: string,
  fileSize: number | null | undefined,
  ttlSeconds = 300
): Promise<MlsSignResult> {
  const canTransform = canApplyMlsTransform(fileSize);

  if (canTransform) {
    const { data, error } = await storage.storage.from(bucket).createSignedUrl(filePath, ttlSeconds, {
      transform: {
        width: MLS_LONG_EDGE,
        height: MLS_LONG_EDGE,
        resize: "contain",
        quality: MLS_TRANSFORM_QUALITY,
      },
    });
    if (!error && data?.signedUrl) {
      return { ok: true, signedUrl: data.signedUrl, transformed: true };
    }
    // Transform signing failed — try original so the download still works.
    const fallback = await storage.storage.from(bucket).createSignedUrl(filePath, ttlSeconds);
    if (!fallback.error && fallback.data?.signedUrl) {
      return {
        ok: true,
        signedUrl: fallback.data.signedUrl,
        transformed: false,
        reason: "sign_failed_no_transform",
      };
    }
    return { ok: false, error: error?.message ?? fallback.error?.message ?? "Failed to sign MLS URL" };
  }

  const { data, error } = await storage.storage.from(bucket).createSignedUrl(filePath, ttlSeconds);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "Failed to sign original URL" };
  }
  return {
    ok: true,
    signedUrl: data.signedUrl,
    transformed: false,
    reason: "oversized_source",
  };
}
