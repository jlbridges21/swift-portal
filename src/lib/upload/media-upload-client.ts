import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import {
  TUS_RETRY_DELAYS_MS,
  TUS_SUCCESS_FALLBACK_MS,
  UPLOAD_CHUNK_SIZE_BYTES,
  shouldUseTusUpload,
  type UploadPhase,
} from "./constants";
import { UPLOAD_DIAGNOSTIC_MODE } from "./diagnostic";
import { normalizeUploadFailure } from "./errors";
import {
  dumpUploadTimeline,
  logUploadBinaryTiming,
  logUploadFailure,
  logUploadStep,
  logUploadTimeline,
  resetUploadTimeline,
} from "./logger";
import {
  UploadBinaryError,
  UploadSaveError,
  parseTusClientError,
  type UploadTechnicalDetails,
} from "./upload-errors";
import type { PendingSavePayload } from "./pending-save";
import { getTusUploadEndpoint, getTusUploadHeaders } from "./tus-config";
import { validateMediaFileBeforeUpload } from "./validation";

export interface UploadProgressUpdate {
  phase: UploadPhase;
  progress: number;
  bytesLoaded?: number;
  bytesTotal?: number;
  /** True when a prior incomplete TUS upload is being resumed. */
  resuming?: boolean;
}

export interface UploadMediaMetadata {
  title?: string;
  description?: string;
  tags?: string[];
}

export interface UploadMediaOptions {
  projectId: string | null;
  file: File;
  mediaType: "photo" | "video" | "document";
  onProgress: (update: UploadProgressUpdate) => void;
  signal?: AbortSignal;
  metadata?: UploadMediaMetadata;
}

export interface UploadMediaResult {
  asset: Record<string, unknown>;
}

interface SignResponse {
  signedUrl?: string;
  token?: string;
  filePath: string;
  bucket: string;
  displayOrder: number;
  mimeType: string;
  resumable?: boolean;
  error?: string;
}

interface CompleteApiResponse {
  success?: boolean;
  media?: Record<string, unknown>;
  error?: string;
  step?: string;
  details?: unknown;
}

function uploadLogContext(
  file: File,
  mimeType: string,
  projectId: string | null | undefined,
  filePath?: string,
  extra?: Partial<UploadTechnicalDetails>
) {
  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: mimeType,
    projectId: projectId ?? null,
    filePath,
    ...extra,
  };
}

function binaryUploadProgressPct(bytesLoaded: number, bytesTotal: number): number {
  if (bytesTotal <= 0) return 5;
  // Reserve 90% of the bar for binary transfer; post-upload steps use 92–100.
  return Math.min(90, Math.max(5, Math.round((bytesLoaded / bytesTotal) * 90)));
}

function binaryError(
  message: string,
  ctx: ReturnType<typeof uploadLogContext> & {
    step: string;
    uploadMethod: "tus" | "signed_put";
    bucket?: string;
    statusCode?: number;
    rawDetails?: unknown;
    failurePhase?: UploadTechnicalDetails["failurePhase"];
  }
): UploadBinaryError {
  const technical: UploadTechnicalDetails = {
    step: ctx.step,
    error: message,
    statusCode: ctx.statusCode,
    uploadMethod: ctx.uploadMethod,
    bucket: ctx.bucket,
    filePath: ctx.filePath,
    projectId: ctx.projectId,
    fileName: ctx.fileName,
    fileSize: ctx.fileSize,
    fileType: ctx.fileType,
    failurePhase: ctx.failurePhase ?? "during_binary",
    retryable: ctx.failurePhase !== "before_binary",
    rawDetails: ctx.rawDetails,
  };
  return new UploadBinaryError(message, technical);
}

async function fetchSign(
  projectId: string | null,
  file: File,
  mediaType: string,
  mimeType: string
): Promise<SignResponse> {
  logUploadTimeline("sign_request");
  logUploadStep("info", { step: "sign_request", ...uploadLogContext(file, mimeType, projectId) });

  const res = await fetch("/api/media/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      projectId: projectId ?? undefined,
      fileName: file.name,
      mimeType,
      fileSize: file.size,
      mediaType,
    }),
  });
  const data = (await res.json()) as SignResponse & CompleteApiResponse;
  if (!res.ok) {
    logUploadStep("error", {
      step: "sign_request",
      ...uploadLogContext(file, mimeType, projectId),
      statusCode: res.status,
      providerMessage: data.error,
    });
    throw binaryError(data.error || "Failed to prepare upload", {
      ...uploadLogContext(file, mimeType, projectId),
      step: "sign_request",
      uploadMethod: "tus",
      statusCode: res.status,
      failurePhase: "before_binary",
    });
  }

  logUploadTimeline("sign_response", `${data.bucket} resumable=${data.resumable}`);
  logUploadStep("info", {
    step: "sign_response",
    ...uploadLogContext(file, mimeType, projectId, data.filePath),
    uploadMethod: data.resumable ? "tus" : "signed_put",
    bucket: data.bucket,
    details: { resumable: data.resumable },
  });

  return data;
}

export async function completeUpload(payload: PendingSavePayload): Promise<Record<string, unknown>> {
  logUploadTimeline("metadata_save_started");
  logUploadStep("info", {
    step: "saving_metadata",
    projectId: payload.projectId,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    fileType: payload.mimeType,
    filePath: payload.filePath,
    details: { skipStorageVerify: payload.skipStorageVerify ?? false, diagnostic: UPLOAD_DIAGNOSTIC_MODE },
  });

  let res: Response;
  try {
    res = await fetch("/api/media/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
      signal: UPLOAD_DIAGNOSTIC_MODE ? undefined : AbortSignal.timeout(
        payload.mediaType === "video" ? 180_000 : 120_000
      ),
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    const message = isAbort
      ? "Save request timed out. Retry save."
      : err instanceof Error
        ? err.message
        : "Save request failed";
    logUploadStep("error", {
      step: "saving_metadata",
      projectId: payload.projectId,
      fileName: payload.fileName,
      filePath: payload.filePath,
      providerMessage: message,
    });
    throw new UploadSaveError(message, payload, { step: "saving_metadata", rawDetails: err });
  }

  let data: CompleteApiResponse = {};
  try {
    data = (await res.json()) as CompleteApiResponse;
  } catch {
    throw new UploadSaveError("Invalid server response while saving upload.", payload, {
      step: "saving_metadata",
      statusCode: res.status,
    });
  }

  if (!res.ok || data.success === false) {
    throw new UploadSaveError(
      data.error || "Failed to save upload",
      payload,
      { step: data.step, statusCode: res.status, rawDetails: data.details }
    );
  }

  const media = data.media ?? data;
  logUploadTimeline("metadata_save_finished");
  logUploadStep("info", {
    step: "save_complete",
    projectId: payload.projectId,
    fileName: payload.fileName,
    filePath: payload.filePath,
    details: { assetId: (media as { id?: string }).id },
  });

  return media as Record<string, unknown>;
}

function uploadViaSignedPut(
  signedUrl: string,
  file: File,
  mimeType: string,
  projectId: string | null,
  bucket: string,
  filePath: string,
  onProgress: (pct: number, loaded: number, total: number) => void,
  onBinaryComplete: () => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let binaryCompleteFired = false;

    const onAbort = () => {
      xhr.abort();
      reject(new Error("Upload cancelled"));
    };
    signal?.addEventListener("abort", onAbort);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = binaryUploadProgressPct(e.loaded, e.total);
        onProgress(pct, e.loaded, e.total);
        if (e.loaded >= e.total && !binaryCompleteFired) {
          binaryCompleteFired = true;
          onBinaryComplete();
        }
      }
    });
    xhr.addEventListener("load", () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        logUploadTimeline("storage_upload_finished", "signed_put");
        if (!binaryCompleteFired) onBinaryComplete();
        resolve();
      } else {
        reject(
          binaryError(`Storage rejected upload (HTTP ${xhr.status})`, {
            ...uploadLogContext(file, mimeType, projectId, filePath),
            step: "uploading_binary",
            uploadMethod: "signed_put",
            bucket,
            statusCode: xhr.status,
          })
        );
      }
    });
    xhr.addEventListener("error", () => {
      signal?.removeEventListener("abort", onAbort);
      reject(
        binaryError("Network error during signed PUT upload", {
          ...uploadLogContext(file, mimeType, projectId, filePath),
          step: "uploading_binary",
          uploadMethod: "signed_put",
          bucket,
        })
      );
    });
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.send(file);
  });
}

function uploadViaTus(
  file: File,
  bucket: string,
  filePath: string,
  mimeType: string,
  projectId: string | null,
  onProgress: (pct: number, loaded: number, total: number, resuming?: boolean) => void,
  onBinaryComplete: () => void,
  signal?: AbortSignal
): Promise<{ resumed: boolean }> {
  return new Promise(async (resolve, reject) => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      reject(
        binaryError("Session expired. Refresh and sign in again.", {
          ...uploadLogContext(file, mimeType, projectId, filePath),
          step: "uploading_binary",
          uploadMethod: "tus",
          bucket,
          statusCode: 401,
        })
      );
      return;
    }

    let endpoint: string;
    let tusHeaders: Record<string, string>;
    try {
      endpoint = getTusUploadEndpoint();
      tusHeaders = getTusUploadHeaders(token);
    } catch (configErr) {
      reject(
        binaryError(configErr instanceof Error ? configErr.message : "TUS configuration error", {
          ...uploadLogContext(file, mimeType, projectId, filePath),
          step: "uploading_binary",
          uploadMethod: "tus",
          bucket,
        })
      );
      return;
    }

    let settled = false;
    let binaryCompleteFired = false;
    let waitLogInterval: ReturnType<typeof setInterval> | null = null;
    let successFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let resumed = false;
    const uploadStartedAt = Date.now();

    const clearSuccessFallback = () => {
      if (successFallbackTimer) {
        clearTimeout(successFallbackTimer);
        successFallbackTimer = null;
      }
    };

    const finish = (via: "onSuccess" | "onProgress" | "success_fallback") => {
      if (settled) return;
      settled = true;
      if (waitLogInterval) clearInterval(waitLogInterval);
      clearSuccessFallback();
      signal?.removeEventListener("abort", onAbort);
      logUploadTimeline("storage_upload_finished", `tus via=${via}`);
      logUploadStep("info", {
        step: "binary_upload_complete",
        ...uploadLogContext(file, mimeType, projectId, filePath),
        uploadMethod: "tus",
        bucket,
        details: { via, elapsedMs: Date.now() - uploadStartedAt, resumed },
      });
      if (!binaryCompleteFired) onBinaryComplete();
      resolve({ resumed });
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      if (waitLogInterval) clearInterval(waitLogInterval);
      clearSuccessFallback();
      signal?.removeEventListener("abort", onAbort);
      const parsed = parseTusClientError(error);
      logUploadStep("error", {
        step: "uploading_binary",
        ...uploadLogContext(file, mimeType, projectId, filePath),
        uploadMethod: "tus",
        bucket,
        statusCode: parsed.statusCode,
        providerMessage: parsed.message,
        details: { endpoint, body: parsed.body?.slice(0, 300) },
      });
      reject(
        binaryError(parsed.message, {
          ...uploadLogContext(file, mimeType, projectId, filePath),
          step: "uploading_binary",
          uploadMethod: "tus",
          bucket,
          statusCode: parsed.statusCode,
          rawDetails: { endpoint, body: parsed.body },
        })
      );
    };

    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [...TUS_RETRY_DELAYS_MS],
      chunkSize: UPLOAD_CHUNK_SIZE_BYTES,
      headers: tusHeaders,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: filePath,
        contentType: mimeType,
        cacheControl: "3600",
      },
      onError: fail,
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = binaryUploadProgressPct(bytesUploaded, bytesTotal);
        onProgress(pct, bytesUploaded, bytesTotal, resumed);

        if (bytesTotal > 0 && bytesUploaded >= bytesTotal && !binaryCompleteFired) {
          binaryCompleteFired = true;
          onBinaryComplete();
          logUploadTimeline("storage_upload_bytes_complete", "awaiting TUS onSuccess");

          successFallbackTimer = setTimeout(() => {
            logUploadTimeline("tus_success_fallback");
            logUploadStep("warn", {
              step: "uploading_binary",
              ...uploadLogContext(file, mimeType, projectId, filePath),
              uploadMethod: "tus",
              bucket,
              details: {
                waitingFor: "onSuccess",
                elapsedMs: Date.now() - uploadStartedAt,
                fallbackMs: TUS_SUCCESS_FALLBACK_MS,
              },
            });
            finish("success_fallback");
          }, TUS_SUCCESS_FALLBACK_MS);

          if (UPLOAD_DIAGNOSTIC_MODE) {
            waitLogInterval = setInterval(() => {
              logUploadStep("warn", {
                step: "uploading_binary",
                ...uploadLogContext(file, mimeType, projectId, filePath),
                uploadMethod: "tus",
                bucket,
                details: {
                  waitingFor: "onSuccess",
                  elapsedMs: Date.now() - uploadStartedAt,
                },
              });
            }, 15_000);
          }
        }
      },
      onSuccess: () => finish("onSuccess"),
    });

    const onAbort = () => {
      upload.abort(true);
      reject(new Error("Upload cancelled"));
    };
    signal?.addEventListener("abort", onAbort);

    logUploadTimeline("storage_upload_started", `tus endpoint=${endpoint}`);
    logUploadStep("info", {
      step: "uploading_binary",
      ...uploadLogContext(file, mimeType, projectId, filePath),
      uploadMethod: "tus",
      bucket,
      details: { endpoint, chunkSize: UPLOAD_CHUNK_SIZE_BYTES, diagnostic: UPLOAD_DIAGNOSTIC_MODE },
    });

    try {
      const previous = await upload.findPreviousUploads();
      if (previous.length) {
        resumed = true;
        logUploadTimeline("tus_resume_previous");
        onProgress(5, 0, file.size, true);
        upload.resumeFromPreviousUpload(previous[0]);
      }
      upload.start();
    } catch (err) {
      fail(err);
    }
  });
}

/** Retry metadata/database save only — does not re-upload the binary. */
export async function retryMediaSave(
  pending: PendingSavePayload,
  onProgress?: (update: UploadProgressUpdate) => void
): Promise<UploadMediaResult> {
  onProgress?.({
    phase: "saving",
    progress: 96,
    bytesLoaded: pending.fileSize,
    bytesTotal: pending.fileSize,
  });
  const asset = await completeUpload(pending);
  onProgress?.({ phase: "uploaded", progress: 100, bytesLoaded: pending.fileSize, bytesTotal: pending.fileSize });
  logUploadTimeline("ui_complete");
  return { asset };
}

/** Upload a media file directly to Supabase Storage with validation, progress, and finalize. */
export async function uploadMediaFile(options: UploadMediaOptions): Promise<UploadMediaResult> {
  const { projectId, file, mediaType, onProgress, signal, metadata } = options;

  resetUploadTimeline();
  logUploadTimeline("started", file.name);
  logUploadTimeline("validated");
  logUploadStep("info", { step: "validating", ...uploadLogContext(file, file.type, projectId) });
  onProgress({ phase: "validating", progress: 0, bytesTotal: file.size });

  const validation = validateMediaFileBeforeUpload(file, mediaType);
  if (!validation.ok) {
    logUploadFailure({
      step: "validating",
      error: validation.error,
      failurePhase: "before_binary",
      retryable: false,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      projectId,
    });
    throw new Error(validation.error);
  }

  const { mimeType } = validation;
  logUploadTimeline("upload_method_select", mimeType);
  onProgress({ phase: "queued", progress: 2, bytesTotal: file.size });

  const sign = await fetchSign(projectId, file, mediaType, mimeType).catch((err) => {
    if (err instanceof UploadBinaryError) {
      logUploadFailure(err.technical);
      throw err;
    }
    throw err;
  });
  const useTus = shouldUseTusUpload(file.size);
  logUploadTimeline("upload_method_selected", useTus ? "tus" : "signed_put");

  onProgress({ phase: "uploading", progress: 5, bytesLoaded: 0, bytesTotal: file.size });

  const pendingSave: PendingSavePayload = {
    projectId,
    filePath: sign.filePath,
    fileName: file.name,
    mimeType,
    fileSize: file.size,
    mediaType,
    displayOrder: sign.displayOrder,
    title: metadata?.title,
    description: metadata?.description,
    tags: metadata?.tags,
    binaryUploaded: false,
  };

  const onBinaryComplete = () => {
    pendingSave.binaryUploaded = true;
    onProgress({
      phase: "finalizing",
      progress: 92,
      bytesLoaded: file.size,
      bytesTotal: file.size,
    });
  };

  const binaryUploadStartedAt = Date.now();
  let tusResumed = false;

  try {
    const report = (pct: number, loaded: number, total: number, resuming?: boolean) => {
      if (resuming) tusResumed = true;
      onProgress({
        phase: "uploading",
        progress: pct,
        bytesLoaded: loaded,
        bytesTotal: total,
        resuming: resuming ?? tusResumed,
      });
    };

    if (useTus) {
      const tusResult = await uploadViaTus(
        file,
        sign.bucket,
        sign.filePath,
        mimeType,
        projectId,
        report,
        onBinaryComplete,
        signal
      );
      tusResumed = tusResult.resumed;
      logUploadBinaryTiming({
        fileName: file.name,
        fileSize: file.size,
        startedAtMs: binaryUploadStartedAt,
        uploadMethod: "tus",
        resumed: tusResumed,
      });
    } else if (sign.signedUrl) {
      await uploadViaSignedPut(
        sign.signedUrl,
        file,
        mimeType,
        projectId,
        sign.bucket,
        sign.filePath,
        report,
        onBinaryComplete,
        signal
      );
      logUploadBinaryTiming({
        fileName: file.name,
        fileSize: file.size,
        startedAtMs: binaryUploadStartedAt,
        uploadMethod: "signed_put",
      });
    } else {
      throw binaryError("No upload URL returned from server.", {
        ...uploadLogContext(file, mimeType, projectId, sign.filePath),
        step: "sign_request",
        uploadMethod: "tus",
        bucket: sign.bucket,
      });
    }
  } catch (err) {
    if (err instanceof UploadBinaryError) {
      logUploadFailure(err.technical);
      throw err;
    }
    if (err instanceof UploadSaveError) throw err;
    const wrapped = binaryError(err instanceof Error ? err.message : "Upload failed", {
      ...uploadLogContext(file, mimeType, projectId, sign.filePath),
      step: "uploading_binary",
      uploadMethod: useTus ? "tus" : "signed_put",
      bucket: sign.bucket,
    });
    logUploadFailure(wrapped.technical);
    throw wrapped;
  }

  if (!UPLOAD_DIAGNOSTIC_MODE) {
    await new Promise((r) => setTimeout(r, mediaType === "video" ? 800 : 200));
  }

  onProgress({ phase: "saving", progress: 96, bytesLoaded: file.size, bytesTotal: file.size });

  try {
    const asset = await completeUpload(pendingSave);
    onProgress({ phase: "uploaded", progress: 100, bytesLoaded: file.size, bytesTotal: file.size });
    logUploadTimeline("ui_complete");
    dumpUploadTimeline();
    return { asset };
  } catch (err) {
    if (err instanceof UploadSaveError) {
      logUploadFailure(err.technical);
      throw err;
    }
    const wrapped = new UploadSaveError(
      err instanceof Error ? err.message : "Save failed",
      pendingSave,
      { step: "saving_metadata" }
    );
    logUploadFailure(wrapped.technical);
    throw wrapped;
  }
}

export {
  UploadSaveError,
  UploadBinaryError,
  type PendingSavePayload,
  type UploadTechnicalDetails,
} from "./pending-save";
