import { createClient } from "@/lib/supabase/client";
import { buildThumbnailStoragePath } from "@/lib/media-upload";
import { THUMBNAIL_CAPTURE_TIMEOUT_MS } from "./constants";
import { logUploadStep } from "./logger";

function captureVideoThumbnailBlobInner(file: File, seekSeconds: number): Promise<Blob | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("loadeddata", () => {
      try {
        video.currentTime = Math.min(seekSeconds, Math.max(0, (video.duration || seekSeconds) - 0.1));
      } catch {
        finish(null);
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
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => finish(blob),
          "image/jpeg",
          0.82
        );
      } catch {
        finish(null);
      }
    });

    video.addEventListener("error", () => finish(null));
  });
}

/** Capture a JPEG thumbnail from a local video file (~1s in). Times out on mobile/iPhone MP4. */
export async function captureVideoThumbnailBlob(
  file: File,
  seekSeconds = 1,
  timeoutMs = THUMBNAIL_CAPTURE_TIMEOUT_MS
): Promise<Blob | null> {
  const result = await Promise.race([
    captureVideoThumbnailBlobInner(file, seekSeconds),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

  if (result === null) {
    logUploadStep("warn", {
      step: "thumbnail_generate",
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      providerMessage: "Thumbnail capture timed out or failed — continuing without thumbnail",
      details: { timeoutMs },
    });
  }

  return result;
}

export { buildThumbnailStoragePath };

/** Upload a small JPEG thumbnail alongside the video. Never blocks upload on failure. */
export async function uploadVideoThumbnail(
  bucket: string,
  videoFilePath: string,
  file: File,
  context?: { fileName?: string; projectId?: string | null; filePath?: string }
): Promise<string | null> {
  logUploadStep("info", {
    step: "generating_thumbnail",
    fileName: context?.fileName ?? file.name,
    fileSize: file.size,
    fileType: file.type,
    projectId: context?.projectId ?? undefined,
    filePath: context?.filePath ?? videoFilePath,
  });

  const blob = await captureVideoThumbnailBlob(file);
  if (!blob) {
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
