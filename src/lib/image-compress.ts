/** Client-side image compression helpers (avatars + photo grid thumbnails). */

export async function compressAvatarFile(file: File, maxSize = 512): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "avatar";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** Grid thumbnail: ~400px long edge, WebP @ 0.72 (small size over fidelity). */
export const PHOTO_THUMB_LONG_EDGE = 400;
export const PHOTO_THUMB_WEBP_QUALITY = 0.72;

/**
 * Downscale a photo for grid tiles. Prefer WebP; fall back to JPEG if the
 * browser cannot encode WebP.
 */
export async function compressPhotoThumbnail(
  file: Blob,
  maxLongEdge = PHOTO_THUMB_LONG_EDGE,
  quality = PHOTO_THUMB_WEBP_QUALITY
): Promise<{ blob: Blob; contentType: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" } | null> {
  if (typeof window === "undefined") return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(1, maxLongEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
  if (webp && webp.size > 0) {
    return { blob: webp, contentType: "image/webp", ext: "webp" };
  }

  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );
  if (jpeg && jpeg.size > 0) {
    return { blob: jpeg, contentType: "image/jpeg", ext: "jpg" };
  }

  return null;
}
