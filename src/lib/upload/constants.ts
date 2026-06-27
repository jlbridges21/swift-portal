/** Supabase Storage global limit is configurable; 5GB is the platform max per object on Pro. */
export const MAX_VIDEO_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB
export const MAX_PHOTO_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

/** TUS chunk size — Supabase recommends 6MB for resumable uploads. */
export const UPLOAD_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

/** Files above this size must use direct-to-storage (never Vercel API route). */
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/m4v",
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "m4v"] as const;

export type UploadPhase =
  | "queued"
  | "validating"
  | "uploading"
  | "generating_thumbnail"
  | "finalizing"
  | "saving"
  | "uploaded"
  | "failed";

/** Max time to wait for client-side video frame capture (iPhone MP4 can hang without this). */
export const THUMBNAIL_CAPTURE_TIMEOUT_MS = 12_000;

/** Client fetch timeout for complete/save API (storage verify can retry server-side). */
export const COMPLETE_UPLOAD_TIMEOUT_MS = 120_000;
export const COMPLETE_UPLOAD_TIMEOUT_VIDEO_MS = 180_000;

/** If TUS reports all bytes sent but onSuccess never fires (mobile Safari), resolve after this. */
export const TUS_SUCCESS_FALLBACK_MS = 45_000;
