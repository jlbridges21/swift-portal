import { resolveMimeType, sanitizeStorageFileName } from "@/lib/media-upload";
import { formatFileSize } from "@/lib/brand";
import {
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  MAX_PHOTO_FILE_SIZE_BYTES,
  MAX_VIDEO_FILE_SIZE_BYTES,
} from "./constants";

export type ValidationResult =
  | { ok: true; mimeType: string; safeFileName: string }
  | { ok: false; error: string };

function extensionAllowed(fileName: string, allowed: readonly string[]): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return allowed.includes(ext);
}

export function validateVideoFile(file: File): ValidationResult {
  const mimeType = resolveMimeType(file);
  const safeFileName = sanitizeStorageFileName(file.name);

  if (!safeFileName || safeFileName === "file") {
    return { ok: false, error: "Invalid filename." };
  }

  const mimeOk = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType);
  const extOk = extensionAllowed(file.name, ALLOWED_VIDEO_EXTENSIONS);

  if (!mimeOk && !extOk) {
    return {
      ok: false,
      error: `Unsupported video format (${mimeType || "unknown"}). Use MP4, MOV, or M4V.`,
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: "File is empty." };
  }

  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File exceeds maximum size of ${formatFileSize(MAX_VIDEO_FILE_SIZE_BYTES)}.`,
    };
  }

  return { ok: true, mimeType, safeFileName };
}

export function validateMediaFileBeforeUpload(
  file: File,
  mediaType: "photo" | "video" | "document"
): ValidationResult {
  if (mediaType === "video") {
    return validateVideoFile(file);
  }

  const mimeType = resolveMimeType(file);
  const safeFileName = sanitizeStorageFileName(file.name);
  const limit =
    mediaType === "photo" ? MAX_PHOTO_FILE_SIZE_BYTES : MAX_DOCUMENT_FILE_SIZE_BYTES;

  if (file.size <= 0) {
    return { ok: false, error: `${file.name}: file is empty.` };
  }
  if (file.size > limit) {
    return {
      ok: false,
      error: `${file.name} exceeds maximum size of ${formatFileSize(limit)}.`,
    };
  }

  return { ok: true, mimeType, safeFileName };
}

export { formatFileSize };
