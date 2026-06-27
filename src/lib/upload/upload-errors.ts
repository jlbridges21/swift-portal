import type { PendingSavePayload } from "./pending-save";

export type UploadFailurePhase = "before_binary" | "during_binary" | "after_binary";

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
  retryable?: boolean;
  supabaseError?: string;
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

export function userFacingUploadError(technical: UploadTechnicalDetails): string {
  const step = technical.step;
  const status = technical.statusCode;

  if (step === "validating" || step === "sign_request") {
    return technical.error;
  }
  if (status === 413 || /too large|payload too large|exceeds/i.test(technical.error)) {
    return "Video exceeds storage size limit. Check Supabase bucket file_size_limit.";
  }
  if (status === 401 || status === 403 || /unauthorized|forbidden|jwt|session/i.test(technical.error)) {
    return "Session expired or storage permission denied. Refresh and sign in again.";
  }
  if (technical.failurePhase === "after_binary" || step === "storage_verify" || step === "saving_metadata") {
    return "Upload complete, save failed. Tap Retry save.";
  }
  if (technical.failurePhase === "during_binary") {
    return "Video upload failed during storage upload. Check connection and tap Retry upload.";
  }
  return technical.error.length > 160 ? `${technical.error.slice(0, 157)}…` : technical.error;
}
