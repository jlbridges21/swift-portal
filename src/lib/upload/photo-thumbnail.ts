import { createClient } from "@/lib/supabase/client";
import { buildThumbnailStoragePath } from "@/lib/media-upload";
import { compressPhotoThumbnail } from "@/lib/image-compress";
import { logUploadStep } from "./logger";

/**
 * Generate + upload a grid thumbnail for a photo (client-side, same pattern as
 * video-thumbnail.ts). Never blocks the upload on failure.
 */
export async function uploadPhotoThumbnail(
  bucket: string,
  photoFilePath: string,
  file: File,
  context?: { fileName?: string; projectId?: string | null; filePath?: string }
): Promise<string | null> {
  logUploadStep("info", {
    step: "generating_thumbnail",
    fileName: context?.fileName ?? file.name,
    fileSize: file.size,
    fileType: file.type,
    projectId: context?.projectId ?? undefined,
    filePath: context?.filePath ?? photoFilePath,
  });

  const compressed = await compressPhotoThumbnail(file);
  if (!compressed) {
    logUploadStep("warn", {
      step: "thumbnail_generate",
      fileName: context?.fileName ?? file.name,
      fileSize: file.size,
      fileType: file.type,
      providerMessage: "Photo thumbnail compress failed — continuing without thumbnail",
    });
    return null;
  }

  const thumbPath = buildThumbnailStoragePath(photoFilePath, compressed.ext);
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(thumbPath, compressed.blob, {
    contentType: compressed.contentType,
    upsert: true,
    cacheControl: "86400",
  });

  if (error) {
    logUploadStep("warn", {
      step: "thumbnail_upload",
      fileName: context?.fileName ?? file.name,
      projectId: context?.projectId ?? undefined,
      filePath: thumbPath,
      providerMessage: error.message,
    });
    return null;
  }

  logUploadStep("info", {
    step: "thumbnail_upload",
    fileName: context?.fileName ?? file.name,
    filePath: thumbPath,
    details: { bytes: compressed.blob.size, contentType: compressed.contentType },
  });

  return thumbPath;
}
