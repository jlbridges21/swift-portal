import { createClient } from "@/lib/supabase/client";
import { buildThumbnailStoragePath } from "@/lib/media-upload";
import { compressPhotoThumbnail } from "@/lib/image-compress";
import { THUMBNAIL_CAPTURE_TIMEOUT_MS } from "./constants";
import { UPLOAD_DIAGNOSTIC_MODE } from "./diagnostic";
import { logUploadStep } from "./logger";

/**
 * Poster seek rule:
 * - Clips under 10s: 10% of duration (avoids seeking past the end on very short files)
 * - Longer clips: ~1 second in (skips black slates / fade-ins at t=0)
 */
export function chooseVideoPosterSeekSeconds(duration: number, pass: "primary" | "fallback"): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return pass === "primary" ? 1 : 2;
  }
  const maxSeek = Math.max(0.05, duration - 0.1);
  if (pass === "primary") {
    if (duration < 10) return Math.min(maxSeek, Math.max(0.05, duration * 0.1));
    return Math.min(maxSeek, 1);
  }
  return Math.min(maxSeek, Math.max(0.05, duration * 0.35));
}

function isUniformFrame(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const { width, height } = canvas;
  if (width < 2 || height < 2) return true;

  const { data } = ctx.getImageData(0, 0, width, height);
  const stride = Math.max(4, Math.floor((width * height) / 256)) * 4;

  let allDark = true;
  let allLight = true;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += stride) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 20) allDark = false;
    if (lum < 235) allLight = false;
    sumR += r;
    sumG += g;
    sumB += b;
    count++;
  }

  if (allDark || allLight) return true;

  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;
  let variance = 0;
  for (let i = 0; i < data.length; i += stride) {
    const dr = (data[i] ?? 0) - meanR;
    const dg = (data[i + 1] ?? 0) - meanG;
    const db = (data[i + 2] ?? 0) - meanB;
    variance += dr * dr + dg * dg + db * db;
  }
  variance /= count;
  return variance < 40;
}

function captureFrameAtSeek(file: File, seekSeconds: number): Promise<HTMLCanvasElement | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    let settled = false;
    const finish = (canvas: HTMLCanvasElement | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(canvas);
    };

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("error", () => finish(null));

    video.addEventListener("loadedmetadata", () => {
      try {
        const duration = video.duration || seekSeconds;
        video.currentTime = Math.min(seekSeconds, Math.max(0, duration - 0.05));
      } catch {
        finish(null);
      }
    });

    video.addEventListener("seeked", () => {
      try {
        const maxW = 640;
        const vw = video.videoWidth || maxW;
        const vh = video.videoHeight || Math.round(maxW * (9 / 16));
        const ratio = vw / vh || 16 / 9;
        const width = Math.min(maxW, vw);
        const height = Math.max(1, Math.round(width / ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        finish(canvas);
      } catch {
        finish(null);
      }
    });
  });
}

async function captureVideoThumbnailBlobInner(file: File): Promise<Blob | null> {
  const probeUrl = URL.createObjectURL(file);
  const probe = document.createElement("video");
  probe.muted = true;
  probe.preload = "metadata";
  probe.src = probeUrl;

  const duration = await new Promise<number>((resolve) => {
    const done = (value: number) => {
      probe.removeAttribute("src");
      probe.load();
      URL.revokeObjectURL(probeUrl);
      resolve(value);
    };
    probe.addEventListener("loadedmetadata", () => done(probe.duration || 0));
    probe.addEventListener("error", () => done(0));
  });

  const primarySeek = chooseVideoPosterSeekSeconds(duration, "primary");
  let canvas = await captureFrameAtSeek(file, primarySeek);
  if (canvas && isUniformFrame(canvas)) {
    const fallbackSeek = chooseVideoPosterSeekSeconds(duration, "fallback");
    if (Math.abs(fallbackSeek - primarySeek) > 0.05) {
      const retry = await captureFrameAtSeek(file, fallbackSeek);
      if (retry && !isUniformFrame(retry)) canvas = retry;
    }
  }

  if (!canvas) return null;

  const raw = await new Promise<Blob | null>((resolve) =>
    canvas!.toBlob(resolve, "image/jpeg", 0.92)
  );
  if (!raw) return null;

  const compressed = await compressPhotoThumbnail(raw);
  return compressed?.blob ?? raw;
}

/** Capture a grid poster from a local video file. Never throws — returns null on failure. */
export async function captureVideoThumbnailBlob(
  file: File,
  _seekSeconds = 1,
  timeoutMs = THUMBNAIL_CAPTURE_TIMEOUT_MS
): Promise<Blob | null> {
  const result = await Promise.race([
    captureVideoThumbnailBlobInner(file),
    UPLOAD_DIAGNOSTIC_MODE
      ? new Promise<null>(() => {
          /* diagnostic: no timeout */
        })
      : new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

  if (result === null) {
    logUploadStep("warn", {
      step: "thumbnail_generate",
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "unknown",
      providerMessage: "Video poster capture failed — upload continues without thumbnail",
      details: { timeoutMs },
    });
  }

  return result;
}

export { buildThumbnailStoragePath };

/** Upload a grid poster alongside the video. Never blocks upload on failure. */
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
    fileType: file.type || "unknown",
    projectId: context?.projectId ?? undefined,
    filePath: context?.filePath ?? videoFilePath,
  });

  const blob = await captureVideoThumbnailBlob(file);
  if (!blob) {
    return null;
  }

  const ext: "webp" | "jpg" = blob.type === "image/webp" ? "webp" : "jpg";
  const thumbPath = buildThumbnailStoragePath(videoFilePath, ext);
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(thumbPath, blob, {
    contentType: blob.type || "image/jpeg",
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
    details: { bytes: blob.size, contentType: blob.type },
  });

  return thumbPath;
}
