import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import {
  COMPLETE_UPLOAD_TIMEOUT_MS,
  COMPLETE_UPLOAD_TIMEOUT_VIDEO_MS,
  DIRECT_UPLOAD_THRESHOLD_BYTES,
  TUS_SUCCESS_FALLBACK_MS,
  UPLOAD_CHUNK_SIZE_BYTES,
  type UploadPhase,
} from "./constants";
import { getUploadErrorMessage } from "./errors";
import { logUploadStep } from "./logger";
import { UploadSaveError, type PendingSavePayload } from "./pending-save";
import { validateMediaFileBeforeUpload } from "./validation";
import { uploadVideoThumbnail } from "./video-thumbnail";

export { captureVideoThumbnailBlob, uploadVideoThumbnail, buildThumbnailStoragePath } from "./video-thumbnail";

export interface UploadProgressUpdate {
  phase: UploadPhase;
  progress: number;
  bytesLoaded?: number;
  bytesTotal?: number;
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
  filePath?: string
) {
  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: mimeType,
    projectId: projectId ?? undefined,
    filePath,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const parentSignal = init.signal;
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted && !parentSignal?.aborted) {
      throw Object.assign(new Error(`Save request timed out after ${Math.round(timeoutMs / 1000)}s. Retry save.`), {
        step: "saving_metadata",
        timedOut: true,
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

async function fetchSign(
  projectId: string | null,
  file: File,
  mediaType: string,
  mimeType: string
): Promise<SignResponse> {
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
    throw Object.assign(new Error(data.error || "Failed to prepare upload"), { status: res.status });
  }

  logUploadStep("info", {
    step: "sign_response",
    ...uploadLogContext(file, mimeType, projectId, data.filePath),
    details: { bucket: data.bucket, resumable: data.resumable },
  });

  return data;
}

export async function completeUpload(payload: PendingSavePayload): Promise<Record<string, unknown>> {
  logUploadStep("info", {
    step: "saving_metadata",
    projectId: payload.projectId,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    fileType: payload.mimeType,
    filePath: payload.filePath,
    details: { skipStorageVerify: payload.skipStorageVerify ?? false },
  });

  const timeoutMs =
    payload.mediaType === "video" ? COMPLETE_UPLOAD_TIMEOUT_VIDEO_MS : COMPLETE_UPLOAD_TIMEOUT_MS;

  let res: Response;
  try {
    res = await fetchWithTimeout(
      "/api/media/upload/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      },
      timeoutMs
    );
  } catch (err) {
    const timedOut = (err as { timedOut?: boolean }).timedOut;
    logUploadStep("error", {
      step: timedOut ? "saving_metadata" : "complete_request",
      projectId: payload.projectId,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.mimeType,
      filePath: payload.filePath,
      providerMessage: err instanceof Error ? err.message : String(err),
    });
    if (timedOut) {
      throw new UploadSaveError(
        err instanceof Error ? err.message : "Save timed out. Retry save.",
        payload,
        { step: "saving_metadata" }
      );
    }
    throw err;
  }

  let data: CompleteApiResponse = {};
  try {
    data = (await res.json()) as CompleteApiResponse;
  } catch {
    logUploadStep("error", {
      step: "complete_parse",
      projectId: payload.projectId,
      fileName: payload.fileName,
      filePath: payload.filePath,
      statusCode: res.status,
    });
    throw new UploadSaveError("Invalid server response while saving upload.", payload, {
      step: "saving_metadata",
      statusCode: res.status,
    });
  }

  if (!res.ok || data.success === false) {
    logUploadStep("error", {
      step: data.step || "saving_metadata",
      projectId: payload.projectId,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.mimeType,
      filePath: payload.filePath,
      statusCode: res.status,
      providerMessage: data.error,
      details: data.details,
    });
    throw new UploadSaveError(
      data.error || "Failed to save upload",
      payload,
      { step: data.step, statusCode: res.status }
    );
  }

  const media = data.media ?? data;
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
        const pct = Math.min(90, Math.round((e.loaded / e.total) * 90));
        onProgress(pct, e.loaded, e.total);
        if (e.loaded >= e.total && !binaryCompleteFired) {
          binaryCompleteFired = true;
          logUploadStep("info", {
            step: "binary_upload_complete",
            ...uploadLogContext(file, mimeType, projectId),
          });
          onBinaryComplete();
        }
      }
    });
    xhr.addEventListener("load", () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!binaryCompleteFired) {
          binaryCompleteFired = true;
          logUploadStep("info", {
            step: "binary_upload_complete",
            ...uploadLogContext(file, mimeType, projectId),
          });
          onBinaryComplete();
        }
        resolve();
      } else {
        logUploadStep("error", {
          step: "uploading_binary",
          ...uploadLogContext(file, mimeType, projectId),
          statusCode: xhr.status,
        });
        reject(
          Object.assign(new Error(`Storage rejected upload (${xhr.status})`), {
            status: xhr.status,
          })
        );
      }
    });
    xhr.addEventListener("error", () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Network error during upload"));
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
  projectId: string,
  onProgress: (pct: number, loaded: number, total: number) => void,
  onBinaryComplete: () => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      reject(new Error("Session expired. Refresh and sign in again."));
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const endpoint = `${supabaseUrl}/storage/v1/upload/resumable`;

    let settled = false;
    let binaryCompleteFired = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (via: "onSuccess" | "fallback") => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      signal?.removeEventListener("abort", onAbort);
      logUploadStep("info", {
        step: "binary_upload_complete",
        projectId,
        fileName: file.name,
        fileSize: file.size,
        fileType: mimeType,
        filePath,
        details: { via },
      });
      if (!binaryCompleteFired) onBinaryComplete();
      resolve();
    };

    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      chunkSize: UPLOAD_CHUNK_SIZE_BYTES,
      headers: {
        authorization: `Bearer ${token}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: filePath,
        contentType: mimeType,
        cacheControl: "3600",
      },
      onError: (error) => {
        if (settled) return;
        settled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        signal?.removeEventListener("abort", onAbort);
        logUploadStep("error", {
          step: "uploading_binary",
          projectId,
          fileName: file.name,
          fileSize: file.size,
          fileType: mimeType,
          filePath,
          providerMessage: error.message,
        });
        reject(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct =
          bytesTotal > 0 && bytesUploaded >= bytesTotal
            ? 90
            : Math.min(90, Math.round((bytesUploaded / bytesTotal) * 90));
        onProgress(pct, bytesUploaded, bytesTotal);

        if (bytesTotal > 0 && bytesUploaded >= bytesTotal && !binaryCompleteFired) {
          binaryCompleteFired = true;
          logUploadStep("info", {
            step: "binary_upload_complete",
            projectId,
            fileName: file.name,
            fileSize: file.size,
            fileType: mimeType,
            filePath,
            details: { via: "onProgress", awaitingOnSuccess: true },
          });
          onBinaryComplete();

          fallbackTimer = setTimeout(() => {
            logUploadStep("warn", {
              step: "uploading_binary",
              projectId,
              fileName: file.name,
              filePath,
              providerMessage: "TUS onSuccess did not fire — continuing with fallback",
              details: { fallbackMs: TUS_SUCCESS_FALLBACK_MS },
            });
            finish("fallback");
          }, TUS_SUCCESS_FALLBACK_MS);
        }
      },
      onSuccess: () => finish("onSuccess"),
    });

    const onAbort = () => {
      upload.abort(true);
      reject(new Error("Upload cancelled"));
    };
    signal?.addEventListener("abort", onAbort);

    logUploadStep("info", {
      step: "uploading_binary",
      projectId,
      fileName: file.name,
      fileSize: file.size,
      fileType: mimeType,
      filePath,
      details: { bucket, endpoint: "tus" },
    });

    try {
      const previous = await upload.findPreviousUploads();
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    } catch (err) {
      if (!settled) {
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        reject(err);
      }
    }
  });
}

function markBinaryComplete(
  onProgress: UploadMediaOptions["onProgress"],
  file: File,
  mimeType: string
) {
  onProgress({
    phase: "finalizing",
    progress: 92,
    bytesLoaded: file.size,
    bytesTotal: file.size,
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
  logUploadStep("info", {
    step: "ui_marked_complete",
    fileName: pending.fileName,
    filePath: pending.filePath,
    projectId: pending.projectId,
  });
  return { asset };
}

/** Upload a media file directly to Supabase Storage with validation, progress, and finalize. */
export async function uploadMediaFile(options: UploadMediaOptions): Promise<UploadMediaResult> {
  const { projectId, file, mediaType, onProgress, signal, metadata } = options;

  logUploadStep("info", { step: "validating", ...uploadLogContext(file, file.type, projectId) });
  onProgress({ phase: "validating", progress: 0, bytesTotal: file.size });

  const validation = validateMediaFileBeforeUpload(file, mediaType);
  if (!validation.ok) {
    logUploadStep("error", {
      step: "validating",
      ...uploadLogContext(file, file.type, projectId),
      providerMessage: validation.error,
    });
    throw new Error(validation.error);
  }

  const { mimeType } = validation;

  if (mediaType === "video" && file.size > 100 * 1024 * 1024) {
    logUploadStep("info", {
      step: "large_file_warning",
      ...uploadLogContext(file, mimeType, projectId),
    });
  }

  logUploadStep("info", { step: "queued", ...uploadLogContext(file, mimeType, projectId) });
  onProgress({ phase: "queued", progress: 2, bytesTotal: file.size });

  let sign: SignResponse;
  try {
    sign = await fetchSign(projectId, file, mediaType, mimeType);
  } catch (err) {
    throw new Error(getUploadErrorMessage(err, { phase: "validating" }));
  }

  onProgress({ phase: "uploading", progress: 5, bytesLoaded: 0, bytesTotal: file.size });

  const useTus = mediaType === "video" || file.size > DIRECT_UPLOAD_THRESHOLD_BYTES;
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
    binaryUploaded: true,
  };

  const onBinaryComplete = () => markBinaryComplete(onProgress, file, mimeType);

  try {
    const report = (pct: number, loaded: number, total: number) => {
      onProgress({ phase: "uploading", progress: pct, bytesLoaded: loaded, bytesTotal: total });
    };

    if (useTus) {
      await uploadViaTus(
        file,
        sign.bucket,
        sign.filePath,
        mimeType,
        projectId ?? "",
        report,
        onBinaryComplete,
        signal
      );
    } else if (sign.signedUrl) {
      await uploadViaSignedPut(
        sign.signedUrl,
        file,
        mimeType,
        projectId,
        report,
        onBinaryComplete,
        signal
      );
    } else {
      throw new Error("No upload URL returned from server.");
    }
  } catch (err) {
    logUploadStep("error", {
      step: "failed",
      ...uploadLogContext(file, mimeType, projectId, sign.filePath),
      providerMessage: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof UploadSaveError) throw err;
    throw new Error(getUploadErrorMessage(err, { phase: "uploading" }));
  }

  // Brief settle for storage eventual consistency (UI already shows post-upload state).
  await new Promise((r) => setTimeout(r, mediaType === "video" ? 800 : 200));

  if (mediaType === "video") {
    onProgress({
      phase: "generating_thumbnail",
      progress: 94,
      bytesLoaded: file.size,
      bytesTotal: file.size,
    });
    try {
      const thumbnailPath = await uploadVideoThumbnail(sign.bucket, sign.filePath, file, {
        fileName: file.name,
        projectId,
        filePath: sign.filePath,
      });
      if (thumbnailPath) pendingSave.thumbnailPath = thumbnailPath;
    } catch (thumbErr) {
      logUploadStep("warn", {
        step: "generating_thumbnail",
        ...uploadLogContext(file, mimeType, projectId, sign.filePath),
        providerMessage: thumbErr instanceof Error ? thumbErr.message : String(thumbErr),
      });
    }
  }

  onProgress({ phase: "saving", progress: 96, bytesLoaded: file.size, bytesTotal: file.size });

  try {
    const asset = await completeUpload(pendingSave);
    onProgress({ phase: "uploaded", progress: 100, bytesLoaded: file.size, bytesTotal: file.size });
    logUploadStep("info", {
      step: "ui_marked_complete",
      ...uploadLogContext(file, mimeType, projectId, sign.filePath),
      details: { assetId: (asset as { id?: string }).id },
    });
    return { asset };
  } catch (err) {
    logUploadStep("error", {
      step: "failed",
      ...uploadLogContext(file, mimeType, projectId, sign.filePath),
      providerMessage: err instanceof Error ? err.message : String(err),
      details: err instanceof UploadSaveError ? { saveStep: err.step } : undefined,
    });
    if (err instanceof UploadSaveError) throw err;
    throw new Error(getUploadErrorMessage(err, { phase: "finalizing", status: (err as { status?: number }).status }));
  }
}

export { UploadSaveError, type PendingSavePayload };
