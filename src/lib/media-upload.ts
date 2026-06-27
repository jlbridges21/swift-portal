import {
  ALLOWED_PHOTO_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_DOCUMENT_TYPES,
} from "@/lib/constants";

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  mp4: "video/mp4",
  pdf: "application/pdf",
  zip: "application/zip",
};

/** Resolve MIME when the browser leaves file.type empty (common on some OS builds). */
export function resolveMimeType(file: Pick<File, "name" | "type">): string {
  const declared = file.type?.trim().toLowerCase();
  if (declared && declared !== "application/octet-stream") {
    if (declared === "image/jpg") return "image/jpeg";
    return declared;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? declared ?? "application/octet-stream";
}

export function sanitizeStorageFileName(fileName: string): string {
  const trimmed = fileName.trim() || "file";
  const lastDot = trimmed.lastIndexOf(".");
  const ext = lastDot > 0 ? trimmed.slice(lastDot + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
  const base = (lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "file";
  return ext ? `${base}.${ext}` : base;
}

export function buildMediaStoragePath(projectId: string, fileName: string): string {
  const safeName = sanitizeStorageFileName(fileName);
  return `${projectId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
}

export function getAllowedTypes(mediaType: string): readonly string[] {
  if (mediaType === "photo") return ALLOWED_PHOTO_TYPES;
  if (mediaType === "video") return ALLOWED_VIDEO_TYPES;
  return ALLOWED_DOCUMENT_TYPES;
}

export function validateMediaFile(
  file: Pick<File, "name" | "type" | "size">,
  mediaType: string,
  sizeLimit: number
): { ok: true; mimeType: string } | { ok: false; error: string } {
  const mimeType = resolveMimeType(file);
  const allowed = getAllowedTypes(mediaType);

  if (!allowed.includes(mimeType)) {
    return {
      ok: false,
      error: `${file.name}: unsupported file type (${mimeType || "unknown"}). Allowed: ${allowed.join(", ")}`,
    };
  }

  if (file.size > sizeLimit) {
    return { ok: false, error: `${file.name}: file exceeds size limit` };
  }

  if (file.size <= 0) {
    return { ok: false, error: `${file.name}: file is empty` };
  }

  return { ok: true, mimeType };
}
