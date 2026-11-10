"use client";

import { createClient } from "@/lib/supabase/client";
import { compressPhotoThumbnail } from "@/lib/image-compress";
import { invalidateThumbUrl } from "@/lib/media-thumb-client";
import type { LightCraftEngine, LightCraftSettings } from "./lightcraft-bridge";

export interface SaveResult {
  media: Record<string, unknown>;
  versionNumber: number;
  /** Local preview of the new delivered version (object URL) for the filmstrip. */
  previewUrl: string | null;
}

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/**
 * Render the photo at full resolution and make it the photo's delivered version.
 * The original is preserved server-side (version 1) on the first save.
 */
export async function saveEditedPhoto(options: {
  engine: LightCraftEngine;
  engineId: number;
  mediaId: string;
  sourceMime: string;
  settings: LightCraftSettings;
  onStep?: (step: "rendering" | "uploading" | "finishing") => void;
}): Promise<SaveResult> {
  const { engine, engineId, mediaId, sourceMime, settings, onStep } = options;
  // Lossless sources stay lossless; everything else is delivered as high-quality JPEG.
  const format = sourceMime === "image/png" ? "png" : "jpeg";
  const mimeType = format === "png" ? "image/png" : "image/jpeg";

  onStep?.("rendering");
  const rendered = await engine.exportPhoto(engineId, format);
  const blob = new Blob([rendered.bytes], { type: mimeType });
  const thumb = await compressPhotoThumbnail(blob);

  onStep?.("uploading");
  const sign = await json<{
    bucket: string;
    filePath: string;
    token: string;
    thumbPath: string | null;
    thumbToken: string | null;
  }>(
    await fetch(`/api/media/editor/photos/${mediaId}/save/sign`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType, fileSize: blob.size, thumbExt: thumb?.ext ?? "webp" }),
    })
  );

  const supabase = createClient();
  const upload = await supabase.storage
    .from(sign.bucket)
    .uploadToSignedUrl(sign.filePath, sign.token, blob, { contentType: mimeType, upsert: false });
  if (upload.error) throw new Error("The edited photo couldn't be uploaded. Check your connection and try again.");

  let thumbPath: string | null = null;
  if (thumb && sign.thumbPath && sign.thumbToken) {
    const t = await supabase.storage
      .from(sign.bucket)
      .uploadToSignedUrl(sign.thumbPath, sign.thumbToken, thumb.blob, { contentType: thumb.contentType, upsert: false });
    if (!t.error) thumbPath = sign.thumbPath;
  }

  onStep?.("finishing");
  const saved = await json<{ media: Record<string, unknown>; versionNumber: number }>(
    await fetch(`/api/media/editor/photos/${mediaId}/save`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath: sign.filePath,
        thumbPath,
        mimeType,
        fileSize: blob.size,
        width: rendered.width,
        height: rendered.height,
        settings,
        editorVersion: engine.version ?? undefined,
      }),
    })
  );

  invalidateThumbUrl(mediaId);
  return {
    ...saved,
    previewUrl: thumb ? URL.createObjectURL(thumb.blob) : null,
  };
}

/** Deliver the original again (used when a photo's adjustments are reset to none). */
export async function restorePhotoVersion(mediaId: string, versionId: string | "original") {
  const data = await json<{ media: Record<string, unknown> }>(
    await fetch(`/api/media/editor/photos/${mediaId}/restore`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    })
  );
  invalidateThumbUrl(mediaId);
  return data.media;
}
