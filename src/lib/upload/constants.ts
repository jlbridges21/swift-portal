/** Supabase Storage global limit is configurable; 5GB is the platform max per object on Pro. */
export const MAX_VIDEO_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB
export const MAX_PHOTO_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

/**
 * Max files uploading binary/signing/saving at once.
 * Tune here: higher splits bandwidth across more files, so each upload takes longer
 * and is more exposed to stalls and token expiry; lower is gentler on browser/Supabase.
 */
export const MAX_CONCURRENT_UPLOADS = 3;

/** Max resumable (TUS) uploads at once — large videos go one at a time, photos fill the other slots. */
export const MAX_CONCURRENT_RESUMABLE_UPLOADS = 1;

/**
 * Transient failures (network, stall, server, expired token) retry in place — the file
 * keeps its slot and resumes. Only give up after this many attempts in a row that moved
 * no new bytes; any forward progress resets the count. Offline time doesn't count.
 */
export const UPLOAD_MAX_ATTEMPTS_WITHOUT_PROGRESS = 8;
export const UPLOAD_RETRY_BASE_MS = 2000;
export const UPLOAD_RETRY_MAX_DELAY_MS = 30_000;
/** Metadata save retries after the bytes are in storage (complete is idempotent per file_path). */
export const UPLOAD_SAVE_AUTO_RETRIES = 4;

/** TUS chunk size — Supabase recommends 6MB for resumable uploads. */
export const UPLOAD_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

/** Files above this size use Supabase TUS resumable uploads. */
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;

/**
 * Supabase TUS per-chunk retry schedule (ms). tus-js resets the attempt counter whenever
 * a chunk makes progress, so this is the budget for one stuck chunk, not the whole file.
 */
export const TUS_RETRY_DELAYS_MS = [0, 1000, 3000, 5000, 10000, 20000, 30000] as const;

/** Abort and resume a TUS chunk when no bytes have been acknowledged for this long. */
export const TUS_STALL_TIMEOUT_MS = 60_000;
/** Give up on the attempt (auto-retry takes over) after this many stall-resumes in a row. */
export const TUS_MAX_STALL_RESUMES = 3;
/** Refresh the Supabase access token before a TUS request if it expires within this window. */
export const TUS_TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

export function shouldUseTusUpload(fileSize: number): boolean {
  return fileSize > DIRECT_UPLOAD_THRESHOLD_BYTES;
}

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
