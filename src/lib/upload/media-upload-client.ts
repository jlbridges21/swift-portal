import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import {
  DIRECT_UPLOAD_THRESHOLD_BYTES,
  UPLOAD_CHUNK_SIZE_BYTES,
  type UploadPhase,
} from "./constants";
import { getUploadErrorMessage } from "./errors";
import { validateMediaFileBeforeUpload } from "./validation";

export interface UploadProgressUpdate {
  phase: UploadPhase;
  progress: number; // 0-100
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

async function fetchSign(
  projectId: string,
  file: File,
  mediaType: string,
  mimeType: string
): Promise<SignResponse> {
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
  const data = (await res.json()) as SignResponse;
  if (!res.ok) {
    throw Object.assign(new Error(data.error || "Failed to prepare upload"), { status: res.status });
  }
  return data;
}

async function completeUpload(payload: {
  projectId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  mediaType: string;
  displayOrder: number;
}): Promise<Record<string, unknown>> {
  const res = await fetch("/api/media/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.error || "Failed to save upload"), {
      status: res.status,
      phase: "finalizing",
    });
  }
  return data;
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
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = Math.min(90, Math.round((bytesUploaded / bytesTotal) * 90));
        onProgress(pct, bytesUploaded, bytesTotal);
      },
      onSuccess: () => resolve(),
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

/** Upload a media file directly to Supabase Storage with validation, progress, and finalize. */
export async function uploadMediaFile(options: UploadMediaOptions): Promise<UploadMediaResult> {
  const { projectId, file, mediaType, onProgress, signal } = options;

  onProgress({ phase: "validating", progress: 0, bytesTotal: file.size });

  const validation = validateMediaFileBeforeUpload(file, mediaType);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const { mimeType } = validation;

  onProgress({ phase: "queued", progress: 2, bytesTotal: file.size });

  let sign: SignResponse;
  try {
    sign = await fetchSign(projectId, file, mediaType, mimeType);
  } catch (err) {
    throw new Error(getUploadErrorMessage(err, { phase: "validating" }));
  }

  onProgress({ phase: "uploading", progress: 5, bytesLoaded: 0, bytesTotal: file.size });

  const useTus = mediaType === "video" || file.size > DIRECT_UPLOAD_THRESHOLD_BYTES;

  try {
    const report = (pct: number, loaded: number, total: number) => {
      onProgress({ phase: "uploading", progress: pct, bytesLoaded: loaded, bytesTotal: total });
    };

    if (useTus) {
      await uploadViaTus(file, sign.bucket, sign.filePath, mimeType, report, signal);
    } else if (sign.signedUrl) {
      await uploadViaSignedPut(sign.signedUrl, file, mimeType, report, signal);
    } else {
      throw new Error("No upload URL returned from server.");
    }
  } catch (err) {
    throw new Error(getUploadErrorMessage(err, { phase: "uploading" }));
  }

  onProgress({ phase: "finalizing", progress: 95, bytesLoaded: file.size, bytesTotal: file.size });

  let asset: Record<string, unknown>;
  try {
    asset = await completeUpload({
      projectId,
      filePath: sign.filePath,
      fileName: file.name,
      mimeType,
      fileSize: file.size,
      mediaType,
      displayOrder: sign.displayOrder,
    });
  } catch (err) {
    throw new Error(getUploadErrorMessage(err, { phase: "finalizing", status: (err as { status?: number }).status }));
  }

  onProgress({ phase: "uploaded", progress: 100, bytesLoaded: file.size, bytesTotal: file.size });
  return { asset };
}
