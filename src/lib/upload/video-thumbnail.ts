import { createClient } from "@/lib/supabase/client";
import { buildThumbnailStoragePath } from "@/lib/media-upload";
import { logUploadStep } from "./logger";

/** Capture a JPEG thumbnail from a local video file (~1s in). */
export async function captureVideoThumbnailBlob(file: File, seekSeconds = 1): Promise<Blob | null> {
  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("loadeddata", () => {
      try {
        video.currentTime = Math.min(seekSeconds, Math.max(0, (video.duration || seekSeconds) - 0.1));
      } catch {
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener("seeked", () => {
      try {
        const maxW = 640;
        const ratio = video.videoWidth / video.videoHeight || 16 / 9;
        const width = Math.min(maxW, video.videoWidth || maxW);
        const height = Math.round(width / ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          "image/jpeg",
          0.82
        );
      } catch {
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener("error", () => {
      cleanup();
      resolve(null);
    });
  });
}

export { buildThumbnailStoragePath };

/** Upload a small JPEG thumbnail alongside the video. Non-blocking on failure. */
export async function uploadVideoThumbnail(
  bucket: string,
  videoFilePath: string,
  file: File,
  context?: { fileName?: string; projectId?: string | null }
): Promise<string | null> {
  const blob = await captureVideoThumbnailBlob(file);
  if (!blob) {
    logUploadStep("warn", {
      step: "thumbnail_generate",
      fileName: context?.fileName ?? file.name,
      projectId: context?.projectId ?? undefined,
      providerMessage: "Could not capture video frame",
    });
    return null;
  }

  const thumbPath = buildThumbnailStoragePath(videoFilePath);
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(thumbPath, blob, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
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
  });

  return thumbPath;
}
