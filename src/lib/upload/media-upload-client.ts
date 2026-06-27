import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import {
  DIRECT_UPLOAD_THRESHOLD_BYTES,
  MAX_VIDEO_FILE_SIZE_BYTES,
  UPLOAD_CHUNK_SIZE_BYTES,
  type UploadPhase,
} from "./constants";
import { getUploadErrorMessage } from "./errors";
import { logUploadStep } from "./logger";
import { UploadSaveError, type PendingSavePayload } from "./pending-save";
import { validateMediaFileBeforeUpload } from "./validation";

export interface UploadProgressUpdate {
  phase: UploadPhase;
  progress: number;
  bytesLoaded?: number;
  bytesTotal?: number;
}

export interface UploadMediaOptions {
  projectId: string;
  file: File;
  mediaType: "photo" | "video" | "document";
  onProgress: (update: UploadProgressUpdate) => void;
  signal?: AbortSignal;
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

async function fetchSign(
  projectId: string,
  file: File,
  mediaType: string,
  mimeType: string
): Promise<SignResponse> {
  logUploadStep("info", {
    step: "sign_request",
    projectId,
    fileName: file.name,
    fileSize: file.size,
    fileType: mimeType,
  });

  const res = await fetch("/api/media/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      projectId,
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
      projectId,
      fileName: file.name,
      fileSize: file.size,
      fileType: mimeType,
      statusCode: res.status,
      providerMessage: data.error,
    });
    throw Object.assign(new Error(data.error || "Failed to prepare upload"), { status: res.status });
  }

  logUploadStep("info", {
    step: "sign_response",
    projectId,
    fileName: file.name,
    filePath: data.filePath,
    details: { bucket: data.bucket, resumable: data.resumable },
  });

  return data;
}

export async function completeUpload(payload: PendingSavePayload): Promise<Record<string, unknown>> {
  logUploadStep("info", {
    step: "complete_request",
    projectId: payload.projectId,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    fileType: payload.mimeType,
    filePath: payload.filePath,
  });

  const res = await fetch("/api/media/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

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
    throw Object.assign(new Error("Invalid server response while saving upload."), {
      status: res.status,
      phase: "finalizing",
    });
  }

  if (!res.ok || data.success === false) {
    logUploadStep("error", {
      step: data.step || "complete_request",
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
    step: "complete_success",
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
  onProgress: (pct: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => {
      xhr.abort();
      reject(new Error("Upload cancelled"));
    };
    signal?.addEventListener("abort", onAbort);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.min(90, Math.round((e.loaded / e.total) * 90));
        onProgress(pct, e.loaded, e.total);
      }
    });
    xhr.addEventListener("load", () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        logUploadStep("error", {
          step: "storage_put",
          fileName: file.name,
          fileSize: file.size,
          fileType: mimeType,
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
        logUploadStep("error", {
          step: "storage_tus",
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
        const pct = Math.min(90, Math.round((bytesUploaded / bytesTotal) * 90));
        onProgress(pct, bytesUploaded, bytesTotal);
      },
      onSuccess: () => {
        logUploadStep("info", {
          step: "storage_tus_complete",
          projectId,
          fileName: file.name,
          filePath,
          fileSize: file.size,
        });
        resolve();
      },
    });

    const onAbort = () => {
      upload.abort(true);
      reject(new Error("Upload cancelled"));
    };
    signal?.addEventListener("abort", onAbort);

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
}

/** Retry metadata/database save only — does not re-upload the binary. */
export async function retryMediaSave(
  pending: PendingSavePayload,
  onProgress?: (update: UploadProgressUpdate) => void
): Promise<UploadMediaResult> {
  onProgress?.({ phase: "finalizing", progress: 95, bytesLoaded: pending.fileSize, bytesTotal: pending.fileSize });
  const asset = await completeUpload(pending);
  onProgress?.({ phase: "uploaded", progress: 100, bytesLoaded: pending.fileSize, bytesTotal: pending.fileSize });
  return { asset };
}

/** Upload a media file directly to Supabase Storage with validation, progress, and finalize. */
export async function uploadMediaFile(options: UploadMediaOptions): Promise<UploadMediaResult> {
  const { projectId, file, mediaType, onProgress, signal } = options;

  onProgress({ phase: "validating", progress: 0, bytesTotal: file.size });

  const validation = validateMediaFileBeforeUpload(file, mediaType);
  if (!validation.ok) {
    logUploadStep("error", {
      step: "client_validation",
      projectId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      providerMessage: validation.error,
    });
    throw new Error(validation.error);
  }

  const { mimeType } = validation;

  if (mediaType === "video" && file.size > 100 * 1024 * 1024) {
    logUploadStep("info", {
      step: "large_file_warning",
      projectId,
      fileName: file.name,
      fileSize: file.size,
      fileType: mimeType,
    });
  }

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
  };

  try {
    const report = (pct: number, loaded: number, total: number) => {
      onProgress({ phase: "uploading", progress: pct, bytesLoaded: loaded, bytesTotal: total });
    };

    if (useTus) {
      await uploadViaTus(file, sign.bucket, sign.filePath, mimeType, projectId, report, signal);
    } else if (sign.signedUrl) {
      await uploadViaSignedPut(sign.signedUrl, file, mimeType, report, signal);
    } else {
      throw new Error("No upload URL returned from server.");
    }
  } catch (err) {
    if (err instanceof UploadSaveError) throw err;
    throw new Error(getUploadErrorMessage(err, { phase: "uploading" }));
  }

  onProgress({ phase: "finalizing", progress: 95, bytesLoaded: file.size, bytesTotal: file.size });

  try {
    const asset = await completeUpload(pendingSave);
    onProgress({ phase: "uploaded", progress: 100, bytesLoaded: file.size, bytesTotal: file.size });
    return { asset };
  } catch (err) {
    if (err instanceof UploadSaveError) throw err;
    throw new Error(getUploadErrorMessage(err, { phase: "finalizing", status: (err as { status?: number }).status }));
  }
}

export { UploadSaveError, type PendingSavePayload };
