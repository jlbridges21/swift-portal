import type { SupabaseClient } from "@supabase/supabase-js";
import { UPLOAD_DIAGNOSTIC_MODE } from "./diagnostic";
import { logUploadStep } from "./logger";

const BASE_ATTEMPTS = 6;
const VIDEO_ATTEMPTS = 10;
const BASE_DELAY_MS = 1200;
/** Hard cap so the complete API always returns within Vercel limits. */
const MAX_VERIFY_DURATION_MS = 55_000;

function splitStoragePath(filePath: string): { folder: string; fileName: string } {
  const idx = filePath.lastIndexOf("/");
  if (idx === -1) return { folder: "", fileName: filePath };
  return { folder: filePath.slice(0, idx), fileName: filePath.slice(idx + 1) };
}

async function verifyViaList(
  supabase: SupabaseClient,
  bucket: string,
  filePath: string
): Promise<boolean> {
  const { folder, fileName } = splitStoragePath(filePath);
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    search: fileName.length > 24 ? fileName.slice(0, 24) : fileName,
  });

  if (error || !data?.length) return false;

  return data.some((item) => {
    const full = folder ? `${folder}/${item.name}` : item.name;
    return full === filePath || item.name === fileName;
  });
}

async function verifyViaSignedUrl(
  supabase: SupabaseClient,
  bucket: string,
  filePath: string
): Promise<boolean> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60);
  return !error && !!data?.signedUrl;
}

export async function verifyStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  filePath: string,
  context: {
    projectId?: string | null;
    fileName: string;
    fileSize?: number;
    fileType?: string;
    mediaType?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string; details?: unknown }> {
  const isVideo = context.mediaType === "video";
  const maxAttempts = isVideo ? VIDEO_ATTEMPTS : BASE_ATTEMPTS;
  const startedAt = Date.now();

  logUploadStep("info", {
    step: "verifying_storage_path",
    ...context,
    filePath,
    details: { bucket, maxAttempts },
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (
      !UPLOAD_DIAGNOSTIC_MODE &&
      Date.now() - startedAt > MAX_VERIFY_DURATION_MS
    ) {
      logUploadStep("warn", {
        step: "verifying_storage_path",
        ...context,
        filePath,
        providerMessage: "Storage verification time limit reached",
        details: { attempt, elapsedMs: Date.now() - startedAt },
      });
      break;
    }

    const listed = await verifyViaList(supabase, bucket, filePath);
    if (listed) {
      logUploadStep("info", {
        step: "verifying_storage_path",
        ...context,
        filePath,
        details: { attempt, bucket, method: "list", elapsedMs: Date.now() - startedAt },
      });
      return { ok: true };
    }

    const signed = await verifyViaSignedUrl(supabase, bucket, filePath);
    if (signed) {
      logUploadStep("info", {
        step: "verifying_storage_path",
        ...context,
        filePath,
        details: { attempt, bucket, method: "signed_url", elapsedMs: Date.now() - startedAt },
      });
      return { ok: true };
    }

    logUploadStep("warn", {
      step: "storage_verify_retry",
      ...context,
      filePath,
      details: { attempt, bucket, maxAttempts, elapsedMs: Date.now() - startedAt },
    });

    if (
      attempt < maxAttempts &&
      (UPLOAD_DIAGNOSTIC_MODE || Date.now() - startedAt < MAX_VERIFY_DURATION_MS)
    ) {
      const delay = BASE_DELAY_MS * Math.min(attempt, 5);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return {
    ok: false,
    error: "Video uploaded to storage but is not visible yet. Tap Retry save — do not re-upload.",
    details: { bucket, filePath, attempts: maxAttempts, mediaType: context.mediaType },
  };
}
