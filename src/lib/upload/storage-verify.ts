import type { SupabaseClient } from "@supabase/supabase-js";
import { UPLOAD_DIAGNOSTIC_MODE } from "./diagnostic";
import { logUploadStep } from "./logger";

const BASE_ATTEMPTS = 6;
const VIDEO_ATTEMPTS = 10;
const BASE_DELAY_MS = 1200;
/** Hard 404s do not need the full retry budget — two confirmations are enough. */
const HARD_MISSING_CONFIRMATIONS = 2;
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

type FetchProbe = "exists" | "missing" | "uncertain";

/**
 * Prove the object actually exists by fetching bytes.
 * createSignedUrl alone is NOT sufficient — Supabase can mint URLs for missing paths.
 */
async function verifyViaObjectFetch(
  supabase: SupabaseClient,
  bucket: string,
  filePath: string
): Promise<FetchProbe> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60);
  if (error || !data?.signedUrl) {
    const msg = (error?.message || "").toLowerCase();
    if (/not found|does not exist|no such|404/.test(msg)) return "missing";
    return "uncertain";
  }

  try {
    const head = await fetch(data.signedUrl, { method: "HEAD", cache: "no-store" });
    if (head.ok) return "exists";
    if (head.status === 400 || head.status === 404) {
      // Confirm with ranged GET before calling it a hard miss.
      const get = await fetch(data.signedUrl, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        cache: "no-store",
      });
      if (get.ok || get.status === 206) return "exists";
      if (get.status === 400 || get.status === 404) return "missing";
      return "uncertain";
    }

    const get = await fetch(data.signedUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
    });
    if (get.ok || get.status === 206) return "exists";
    if (get.status === 400 || get.status === 404) return "missing";
    return "uncertain";
  } catch {
    return "uncertain";
  }
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
  let hardMissingStreak = 0;

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

    // Byte fetch is authoritative. Signed-URL mint alone must never pass.
    const fetched = await verifyViaObjectFetch(supabase, bucket, filePath);
    if (fetched === "exists") {
      logUploadStep("info", {
        step: "verifying_storage_path",
        ...context,
        filePath,
        details: { attempt, bucket, method: "object_fetch", elapsedMs: Date.now() - startedAt },
      });
      return { ok: true };
    }

    if (fetched === "missing") {
      hardMissingStreak += 1;
      const listed = await verifyViaList(supabase, bucket, filePath);
      if (listed) {
        // List/index lag — treat as uncertain and keep retrying.
        hardMissingStreak = 0;
      } else if (hardMissingStreak >= HARD_MISSING_CONFIRMATIONS) {
        logUploadStep("error", {
          step: "storage_verify",
          ...context,
          filePath,
          providerMessage: "Object confirmed missing via byte fetch",
          details: { attempt, bucket, hardMissingStreak, elapsedMs: Date.now() - startedAt },
        });
        break;
      }
    } else {
      hardMissingStreak = 0;
    }

    logUploadStep("warn", {
      step: "storage_verify_retry",
      ...context,
      filePath,
      details: {
        attempt,
        bucket,
        fetched,
        hardMissingStreak,
        maxAttempts,
        elapsedMs: Date.now() - startedAt,
      },
    });

    if (
      attempt < maxAttempts &&
      hardMissingStreak < HARD_MISSING_CONFIRMATIONS &&
      (UPLOAD_DIAGNOSTIC_MODE || Date.now() - startedAt < MAX_VERIFY_DURATION_MS)
    ) {
      const delay = BASE_DELAY_MS * Math.min(attempt, 5);
      await new Promise((r) => setTimeout(r, delay));
    }

    if (hardMissingStreak >= HARD_MISSING_CONFIRMATIONS) break;
  }

  return {
    ok: false,
    error:
      "File is missing from storage (or not readable yet). Re-upload the file — saving without the object would create a broken gallery entry.",
    details: { bucket, filePath, attempts: maxAttempts, mediaType: context.mediaType },
  };
}
