/**
 * Client-side image optimization for website hero / photo uploads.
 *
 * The upload route (`/api/admin/settings/logo`) has to stay under Vercel's 4.5MB request
 * body cap, so it rejects anything over 4MB. Phone and camera photos are routinely
 * larger, so instead of rejecting them we decode in the browser, fix EXIF orientation,
 * downscale to a sane long edge and re-encode until the result fits. The server still
 * validates type and processed size — this only changes what we send it.
 *
 * Pure helpers (sizing, encode plan, validation) are exported separately so they can be
 * exercised without a DOM (scripts/verify-optimize-upload-image.ts).
 */

/** Largest original we attempt to process in the browser. */
export const IMAGE_UPLOAD_ORIGINAL_MAX_BYTES = 25 * 1024 * 1024;
/** Must match the upload route's MAX_BYTES (Vercel body cap). */
export const IMAGE_UPLOAD_PROCESSED_MAX_BYTES = 4 * 1024 * 1024;
/** Longest edge after optimization; aspect ratio is preserved. */
export const IMAGE_UPLOAD_MAX_EDGE = 2560;
/** Never shrink below this long edge while hunting for a smaller file. */
export const IMAGE_UPLOAD_MIN_EDGE = 1280;

export const IMAGE_UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp";
export const IMAGE_UPLOAD_HINT = "JPEG, PNG or WebP. Large images are automatically optimized.";

const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
/** Not advertised, but decoded when the browser can (e.g. Safari) and converted to JPEG. */
const BEST_EFFORT_TYPES = new Set(["image/heic", "image/heif"]);
const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export type ImageOptimizationErrorCode = "unsupported_type" | "too_large" | "decode_failed" | "encode_failed";

export class ImageOptimizationError extends Error {
  readonly code: ImageOptimizationErrorCode;
  constructor(code: ImageOptimizationErrorCode, message: string) {
    super(message);
    this.name = "ImageOptimizationError";
    this.code = code;
  }
}

const MESSAGES: Record<ImageOptimizationErrorCode, string> = {
  unsupported_type: "Choose a JPEG, PNG or WebP image.",
  too_large: "That image is over 25MB. Choose a smaller photo.",
  decode_failed:
    "This browser couldn’t read that image. It may be damaged or in a format like HEIC — try saving it as a JPEG and uploading again.",
  encode_failed: "We couldn’t shrink that image enough to upload. Try a smaller photo.",
};

function fail(code: ImageOptimizationErrorCode): never {
  throw new ImageOptimizationError(code, MESSAGES[code]);
}

/** Resolve a usable MIME type from `file.type`, falling back to the extension. */
export function resolveImageType(file: { name: string; type: string }): string | null {
  const type = file.type.toLowerCase();
  if (SUPPORTED_TYPES.has(type) || BEST_EFFORT_TYPES.has(type)) return type;
  if (type && type !== "application/octet-stream") return null;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? null;
}

/** Throws ImageOptimizationError for wrong types / oversized originals; returns the resolved type. */
export function validateImageForOptimization(file: { name: string; type: string; size: number }): string {
  const type = resolveImageType(file);
  if (!type) fail("unsupported_type");
  if (file.size > IMAGE_UPLOAD_ORIGINAL_MAX_BYTES) fail("too_large");
  if (file.size === 0) fail("decode_failed");
  return type;
}

/** Scale (w, h) so the longest edge is ≤ maxEdge, preserving aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** True when the original can be sent untouched (server still rotates/resizes it). */
export function canUploadOriginal(args: { type: string; size: number; width: number; height: number }): boolean {
  return (
    SUPPORTED_TYPES.has(args.type) &&
    args.size <= IMAGE_UPLOAD_PROCESSED_MAX_BYTES &&
    Math.max(args.width, args.height) <= IMAGE_UPLOAD_MAX_EDGE
  );
}

export type EncodeAttempt = { maxEdge: number; quality: number };

const QUALITY_STEPS = [0.9, 0.85, 0.8, 0.72, 0.65];
const EDGE_STEPS = [IMAGE_UPLOAD_MAX_EDGE, 2048, 1600, IMAGE_UPLOAD_MIN_EDGE];

/**
 * Ordered encode attempts: high quality at full size first, then lower quality, then
 * smaller dimensions. PNG ignores quality, so only the edge steps matter for it.
 */
export function buildEncodePlan(sourceLongEdge: number, lossless: boolean): EncodeAttempt[] {
  const edges = EDGE_STEPS.map((e) => Math.min(e, sourceLongEdge)).filter((e, i, all) => all.indexOf(e) === i);
  const plan: EncodeAttempt[] = [];
  for (const maxEdge of edges) {
    if (lossless) plan.push({ maxEdge, quality: 1 });
    else for (const quality of QUALITY_STEPS) plan.push({ maxEdge, quality });
  }
  return plan;
}

export function outputFileName(originalName: string, mime: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, "").trim() || "image";
  const ext = mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";
  return `${base}.${ext}`;
}

/* ------------------------------------------------------------------ */
/* Browser-only below                                                  */
/* ------------------------------------------------------------------ */

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decodeImage(file: Blob): Promise<Decoded> {
  // createImageBitmap applies EXIF orientation ("from-image") in all current browsers.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to <img>, which some browsers decode more formats with (e.g. HEIC in Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("empty");
    // <img> honours EXIF orientation by default (CSS image-orientation: from-image).
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    fail("decode_failed");
  }
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function draw(decoded: Decoded, width: number, height: number): HTMLCanvasElement {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) fail("encode_failed");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(decoded.source, 0, 0, width, height);
  return canvas;
}

/** Any pixel with alpha < 255? Sampled on a small copy to stay cheap for big photos. */
function hasTransparency(decoded: Decoded): boolean {
  const { width, height } = fitWithin(decoded.width, decoded.height, 512);
  const canvas = draw(decoded, width, height);
  try {
    const data = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    return false;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

export type OptimizeResult = {
  file: File;
  /** False when the original already fit and was passed through untouched. */
  optimized: boolean;
  width: number;
  height: number;
};

/**
 * Validate, orient, downscale and compress an image so it fits the 4MB upload cap.
 * Throws ImageOptimizationError with a user-facing message when it can't.
 *
 * Opaque images → JPEG (universal, incl. social link previews). Images with transparency
 * → WebP; if the browser can't encode WebP, PNG with progressively smaller dimensions.
 */
export async function optimizeImageForUpload(file: File): Promise<OptimizeResult> {
  const type = validateImageForOptimization(file);
  const decoded = await decodeImage(file);
  try {
    if (canUploadOriginal({ type, size: file.size, width: decoded.width, height: decoded.height })) {
      return { file, optimized: false, width: decoded.width, height: decoded.height };
    }

    const mayHaveAlpha = type === "image/png" || type === "image/webp";
    const alpha = mayHaveAlpha && hasTransparency(decoded);
    const longEdge = Math.max(decoded.width, decoded.height);

    const formats: { mime: string; lossless: boolean }[] = alpha
      ? [
          { mime: "image/webp", lossless: false },
          { mime: "image/png", lossless: true },
        ]
      : [{ mime: "image/jpeg", lossless: false }];

    for (const format of formats) {
      let canvas: HTMLCanvasElement | null = null;
      let canvasEdge = 0;
      try {
        for (const attempt of buildEncodePlan(longEdge, format.lossless)) {
          if (attempt.maxEdge !== canvasEdge) {
            if (canvas) canvas.width = canvas.height = 0;
            const size = fitWithin(decoded.width, decoded.height, attempt.maxEdge);
            canvas = draw(decoded, size.width, size.height);
            canvasEdge = attempt.maxEdge;
          }
          const blob = await toBlob(canvas!, format.mime, attempt.quality);
          // Browsers that can't encode the requested type silently return PNG — move on.
          if (!blob || blob.type !== format.mime) break;
          if (blob.size <= IMAGE_UPLOAD_PROCESSED_MAX_BYTES) {
            return {
              file: new File([blob], outputFileName(file.name, format.mime), {
                type: format.mime,
                lastModified: Date.now(),
              }),
              optimized: true,
              width: canvas!.width,
              height: canvas!.height,
            };
          }
        }
      } finally {
        if (canvas) canvas.width = canvas.height = 0;
      }
    }
    fail("encode_failed");
  } finally {
    decoded.release();
  }
}

/** Message for any error thrown by optimizeImageForUpload. */
export function imageOptimizationErrorMessage(error: unknown): string {
  return error instanceof ImageOptimizationError ? error.message : MESSAGES.decode_failed;
}
