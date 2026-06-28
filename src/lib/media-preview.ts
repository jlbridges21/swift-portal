import type { MediaAsset } from "@/lib/types";
import type { LibraryAsset, LibraryAssetKind } from "@/lib/media-library";

const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|avi|mkv|mpeg|mpg)(\?|#|$)/i;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?|#|$)/i;

const VIDEO_MIME_PREFIX = "video/";
const IMAGE_MIME_PREFIX = "image/";

export function isVideoExtension(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  return VIDEO_EXTENSIONS.test(fileName.toLowerCase());
}

export function isImageExtension(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  return IMAGE_EXTENSIONS.test(fileName.toLowerCase());
}

export function isVideoMimeType(mimeType: string | null | undefined): boolean {
  return !!mimeType?.toLowerCase().startsWith(VIDEO_MIME_PREFIX);
}

export function isImageMimeType(mimeType: string | null | undefined): boolean {
  return !!mimeType?.toLowerCase().startsWith(IMAGE_MIME_PREFIX);
}

/** True when a URL likely points at a video file (never pass to next/image). */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const pathname = new URL(url, "https://placeholder.local").pathname.toLowerCase();
    return VIDEO_EXTENSIONS.test(pathname);
  } catch {
    return VIDEO_EXTENSIONS.test(url.toLowerCase());
  }
}

/** True when a URL is safe for next/image optimization. */
export function isOptimizableImageUrl(url: string | null | undefined): boolean {
  if (!url || isVideoUrl(url)) return false;
  try {
    const pathname = new URL(url, "https://placeholder.local").pathname.toLowerCase();
    if (IMAGE_EXTENSIONS.test(pathname)) return true;
    // Signed Supabase URLs without extensions: allow only if path doesn't look like video
    return !VIDEO_EXTENSIONS.test(pathname);
  } catch {
    return !isVideoUrl(url);
  }
}

export function isVideoMediaAsset(
  asset: Pick<MediaAsset, "media_type" | "mime_type" | "file_name" | "media_source">
): boolean {
  if (asset.media_source === "youtube") return true;
  if (asset.media_type === "video") return true;
  if (isVideoMimeType(asset.mime_type)) return true;
  return isVideoExtension(asset.file_name);
}

export function isImageMediaAsset(
  asset: Pick<MediaAsset, "media_type" | "mime_type" | "file_name">
): boolean {
  if (asset.media_type === "photo") return true;
  if (isImageMimeType(asset.mime_type)) return true;
  return isImageExtension(asset.file_name);
}

export function isVideoLibraryAsset(
  asset: Pick<LibraryAsset, "kind" | "mime_type" | "file_name" | "media_source">
): boolean {
  if (asset.media_source === "youtube") return true;
  if (asset.kind === "video") return true;
  if (isVideoMimeType(asset.mime_type)) return true;
  return isVideoExtension(asset.file_name);
}

export function isImageLibraryAsset(
  asset: Pick<LibraryAsset, "kind" | "mime_type" | "file_name">
): boolean {
  if (asset.kind === "photo") return true;
  if (isImageMimeType(asset.mime_type)) return true;
  return isImageExtension(asset.file_name);
}

export function shouldFetchImageThumbnail(
  asset: Pick<MediaAsset, "media_type" | "mime_type" | "file_name" | "media_source">
): boolean {
  if (asset.media_source === "youtube") return false;
  return isImageMediaAsset(asset) && !isVideoMediaAsset(asset);
}

export function shouldFetchLibraryThumbnail(
  asset: Pick<LibraryAsset, "kind" | "mime_type" | "file_name" | "media_source">
): boolean {
  if (asset.kind === "tour" || asset.kind === "document") return false;
  if (asset.media_source === "youtube") return false;
  return isImageLibraryAsset(asset) && !isVideoLibraryAsset(asset);
}

export function libraryKindLabel(kind: LibraryAssetKind): string {
  if (kind === "video") return "Video";
  if (kind === "photo") return "Photo";
  if (kind === "tour") return "360 Tour";
  return "Document";
}
