import type { PendingSavePayload } from "./pending-save";

export type UploadFailurePhase = "before_binary" | "during_binary" | "after_binary";

/** What went wrong during the binary transfer — drives retry policy and the user-facing message. */
export type UploadFailureKind =
  | "network"
  | "stalled"
  | "auth"
  | "upload_expired"
  | "too_large"
  | "already_exists"
  | "server"
  | "rejected"
  | "unknown";

export interface UploadTechnicalDetails {
  step: string;
  error: string;
  statusCode?: number;
  uploadMethod?: "tus" | "signed_put";
  bucket?: string;
  filePath?: string;
  projectId?: string | null;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  failurePhase?: UploadFailurePhase;
  failureKind?: UploadFailureKind;
  retryable?: boolean;
  supabaseError?: string;
  /** Bytes the server had acknowledged when the failure happened (TUS). */
  bytesUploaded?: number;
  rawDetails?: unknown;
}

export class UploadBinaryError extends Error {
  readonly step: string;
  readonly statusCode?: number;
  readonly uploadMethod: "tus" | "signed_put";
  readonly bucket?: string;
  readonly filePath?: string;
  readonly projectId?: string | null;
  readonly fileName: string;
  readonly fileSize: number;
  readonly fileType: string;
  readonly failurePhase: UploadFailurePhase;
  readonly retryable: boolean;
  readonly technical: UploadTechnicalDetails;

  constructor(message: string, technical: UploadTechnicalDetails) {
    super(message);
    this.name = "UploadBinaryError";
    this.step = technical.step;
    this.statusCode = technical.statusCode;
    this.uploadMethod = technical.uploadMethod ?? "tus";
    this.bucket = technical.bucket;
    this.filePath = technical.filePath;
    this.projectId = technical.projectId;
    this.fileName = technical.fileName ?? "unknown";
    this.fileSize = technical.fileSize ?? 0;
    this.fileType = technical.fileType ?? "unknown";
    this.failurePhase = technical.failurePhase ?? "during_binary";
    this.retryable = technical.retryable ?? true;
    this.technical = technical;
  }
}

export class UploadSaveError extends Error {
  readonly pendingSave: PendingSavePayload;
  readonly step?: string;
  readonly statusCode?: number;
  readonly failurePhase: UploadFailurePhase = "after_binary";
  readonly retryable = true;
  readonly technical: UploadTechnicalDetails;

  constructor(
    message: string,
    pendingSave: PendingSavePayload,
    meta?: { step?: string; statusCode?: number; rawDetails?: unknown }
  ) {
    super(message);
    this.name = "UploadSaveError";
    this.pendingSave = pendingSave;
    this.step = meta?.step;
    this.statusCode = meta?.statusCode;
    this.technical = {
      step: meta?.step ?? "saving_metadata",
      error: message,
      statusCode: meta?.statusCode,
      filePath: pendingSave.filePath,
      projectId: pendingSave.projectId,
      fileName: pendingSave.fileName,
      fileSize: pendingSave.fileSize,
      fileType: pendingSave.mimeType,
      failurePhase: "after_binary",
      retryable: true,
      rawDetails: meta?.rawDetails,
    };
  }
}

/** Extract HTTP status/body from tus-js-client DetailedError when available. */
export function parseTusClientError(error: unknown): {
  message: string;
  statusCode?: number;
  body?: string;
} {
  if (!(error instanceof Error)) {
    return { message: String(error ?? "Unknown TUS error") };
  }

  const detailed = error as Error & {
    originalResponse?: { getStatus: () => number; getBody: () => string | null };
  };

  if (detailed.originalResponse) {
    const statusCode = detailed.originalResponse.getStatus();
    const body = detailed.originalResponse.getBody() ?? undefined;
    const suffix = body ? ` — ${body.slice(0, 500)}` : "";
    return {
      message: `${error.message} (HTTP ${statusCode}${suffix})`,
      statusCode,
      body,
    };
  }

  return { message: error.message };
}

const AUTH_ERROR_RE = /jwt|exp"? claim|token.*expired|expired.*token|unauthori[sz]ed|invalid signature|session/i;

/**
 * Classify a storage upload failure. Supabase reports an expired access token on TUS
 * PATCH as a 4xx (400/401/403 depending on version) with a JWT message in the body.
 */
export function classifyUploadFailure(statusCode: number | undefined, text: string | undefined): UploadFailureKind {
  const body = text ?? "";
  if (!statusCode) {
    if (/stall/i.test(body)) return "stalled";
    if (/session expired/i.test(body)) return "auth";
    return "network";
  }
  if (statusCode === 413 || /too large|payload too large|exceeds/i.test(body)) return "too_large";
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (statusCode === 400 && AUTH_ERROR_RE.test(body)) return "auth";
  if (statusCode === 404 || statusCode === 410) return "upload_expired";
  if (statusCode === 409 && /already exists|duplicate/i.test(body)) return "already_exists";
  if (statusCode === 409 || statusCode === 423 || statusCode === 429 || statusCode >= 500) return "server";
  if (statusCode >= 400) return "rejected";
  return "unknown";
}

/** Failures worth retrying automatically (the next attempt resumes TUS uploads where possible). */
export function isTransientUploadFailure(kind: UploadFailureKind | undefined): boolean {
  return (
    kind === undefined ||
    kind === "network" ||
    kind === "stalled" ||
    kind === "auth" ||
    kind === "upload_expired" ||
    kind === "server" ||
    kind === "unknown"
  );
}

function mediaLabel(fileType: string | undefined): string {
  if (fileType?.startsWith("video/")) return "Video";
  if (fileType?.startsWith("image/")) return "Photo";
  return "File";
}

export function userFacingUploadError(technical: UploadTechnicalDetails): string {
  const step = technical.step;
  const status = technical.statusCode;

  if (step === "sign_request" && technical.failureKind === "network") {
    return "Couldn't reach the server to start this upload. Check your connection and tap Retry upload.";
  }
  if (step === "validating" || step === "sign_request") {
    return technical.error;
  }
  const label = mediaLabel(technical.fileType);
  const kind =
    technical.failurePhase === "during_binary"
      ? technical.failureKind ?? classifyUploadFailure(status, technical.error)
      : undefined;

  if (kind === "too_large" || status === 413 || /too large|payload too large|exceeds/i.test(technical.error)) {
    return `${label} exceeds the storage size limit for this bucket.`;
  }
  if (kind === "auth" || status === 401 || status === 403 || /unauthorized|forbidden|jwt/i.test(technical.error)) {
    return "Your sign-in session expired or storage denied access mid-upload. Refresh the page, sign in, then tap Retry upload.";
  }
  if (technical.failurePhase === "after_binary" || step === "storage_verify" || step === "saving_metadata") {
    // Surface the real cause (e.g. object missing) — never mask as a generic "save failed".
    const detail = technical.error?.trim();
    if (detail && !/^save request failed$/i.test(detail) && !/^failed to save upload$/i.test(detail)) {
      return detail.length > 220 ? `${detail.slice(0, 217)}…` : detail;
    }
    return "Upload reached storage but metadata save failed. Tap Retry save.";
  }
  if (technical.failurePhase === "during_binary") {
    const resumeHint = technical.uploadMethod === "tus" ? " Tap Retry upload to resume." : " Tap Retry upload.";
    switch (kind) {
      case "stalled":
        return `${label} upload stalled — storage stopped acknowledging data after several attempts.${resumeHint}`;
      case "upload_expired":
        return `${label} upload session expired on the storage server. Tap Retry upload to start it again.`;
      case "server":
        return `Storage server error${status ? ` (HTTP ${status})` : ""} while uploading ${label.toLowerCase()}.${resumeHint}`;
      case "rejected":
        return `Storage rejected the ${label.toLowerCase()} upload (HTTP ${status}): ${technical.error.slice(0, 120)}`;
      case "network":
        return `${label} upload lost its connection to storage and could not reconnect after several retries.${resumeHint}`;
      default:
        return `${label} upload failed during storage upload: ${technical.error.slice(0, 120)}.${resumeHint}`;
    }
  }
  return technical.error.length > 160 ? `${technical.error.slice(0, 157)}…` : technical.error;
}
