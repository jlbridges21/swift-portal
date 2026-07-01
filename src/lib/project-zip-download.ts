import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filterClientMedia, isClientVisibleMedia } from "@/lib/client-media";
import { canDownloadDeliverables } from "@/lib/deliverables";
import { sanitizeStorageFileName } from "@/lib/media-upload";
import { canAccessProject } from "@/lib/project-access";
import type { MediaAsset, Profile } from "@/lib/types";

const BUCKET = "project-media";
const ZIP_FOLDER = "deliverables";
const ERRORS_MANIFEST = `${ZIP_FOLDER}/_download_errors.txt`;
/** Skip individual files above 400MB to avoid serverless OOM. */
const MAX_SINGLE_FILE_BYTES = 400 * 1024 * 1024;

export type ZipLogStep =
  | "start"
  | "auth"
  | "project"
  | "access"
  | "media_query"
  | "media_filter"
  | "file_fetch"
  | "file_skip"
  | "zip_finalize"
  | "zip_ready"
  | "error";

export interface ZipLogContext {
  projectId: string;
  userId?: string;
  role?: string;
}

export function zipLog(step: ZipLogStep, ctx: ZipLogContext, details: Record<string, unknown> = {}): void {
  console.info(
    "[project-zip]",
    JSON.stringify({
      step,
      projectId: ctx.projectId,
      userId: ctx.userId,
      role: ctx.role,
      ...details,
    })
  );
}

export class ZipDownloadError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: string,
    public readonly status: number = 500
  ) {
    super(message);
    this.name = "ZipDownloadError";
  }
}

export interface DownloadableAsset {
  id: string;
  file_path: string;
  file_name: string;
  media_type: string;
  display_order: number | null;
}

export interface SkippedZipFile {
  assetId: string;
  fileName: string;
  storagePath: string;
  reason: string;
}

export function pickDownloadableAssets(
  media: MediaAsset[],
  isAdmin: boolean
): DownloadableAsset[] {
  const visible = isAdmin ? media : filterClientMedia(media);
  return visible
    .filter((a) => {
      if (a.media_type !== "photo" && a.media_type !== "video") return false;
      if (a.media_source === "youtube" || a.media_source === "kuula" || a.media_source === "external") {
        return false;
      }
      const path = normalizeStoragePath(a.file_path ?? "");
      return !!path;
    })
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((a) => ({
      id: a.id,
      file_path: normalizeStoragePath(a.file_path),
      file_name: a.file_name || `${a.id}.bin`,
      media_type: a.media_type,
      display_order: a.display_order,
    }));
}

/** Strip bucket prefixes or public/signed URLs down to a storage object path. */
export function normalizeStoragePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    const objectMatch = trimmed.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/project-media\/([^?]+)/
    );
    if (objectMatch?.[1]) {
      return decodeURIComponent(objectMatch[1]);
    }
    return "";
  }

  if (trimmed.startsWith("project-media/")) {
    return trimmed.slice("project-media/".length);
  }

  return trimmed.replace(/^\/+/, "");
}

function uniqueZipEntryName(rawName: string, used: Set<string>): string {
  const safe = sanitizeStorageFileName(rawName);
  if (!used.has(safe)) {
    used.add(safe);
    return safe;
  }
  const dot = safe.lastIndexOf(".");
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  let i = 2;
  while (used.has(`${base}-${i}${ext}`)) i++;
  const unique = `${base}-${i}${ext}`;
  used.add(unique);
  return unique;
}

interface FetchedFile {
  buffer: Buffer;
  byteLength: number;
  storagePath: string;
  source: "storage_download" | "signed_url";
}

async function fetchStorageFile(
  supabase: SupabaseClient,
  rawPath: string,
  ctx: ZipLogContext,
  asset: DownloadableAsset
): Promise<{ ok: true; file: FetchedFile } | { ok: false; reason: string; storagePath: string }> {
  const storagePath = normalizeStoragePath(rawPath);
  if (!storagePath) {
    return { ok: false, reason: "invalid or empty storage path", storagePath: rawPath };
  }

  zipLog("file_fetch", ctx, {
    assetId: asset.id,
    mediaType: asset.media_type,
    storagePath,
    bucket: BUCKET,
  });

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (!downloadError && blob) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    zipLog("file_fetch", ctx, {
      assetId: asset.id,
      storagePath,
      exists: true,
      bytes: buffer.length,
      method: "storage_download",
    });
    return {
      ok: true,
      file: { buffer, byteLength: buffer.length, storagePath, source: "storage_download" },
    };
  }

  zipLog("file_fetch", ctx, {
    assetId: asset.id,
    storagePath,
    downloadFailed: true,
    downloadError: downloadError?.message ?? "unknown",
  });

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300);

  if (signError || !signed?.signedUrl) {
    zipLog("file_skip", ctx, {
      assetId: asset.id,
      storagePath,
      signedUrlFailed: true,
      signError: signError?.message ?? "no signed url",
    });
    return {
      ok: false,
      reason: downloadError?.message ?? signError?.message ?? "storage download failed",
      storagePath,
    };
  }

  zipLog("file_fetch", ctx, {
    assetId: asset.id,
    storagePath,
    method: "signed_url",
    signedUrlOk: true,
  });

  const res = await fetch(signed.signedUrl, { cache: "no-store" });
  if (!res.ok) {
    zipLog("file_skip", ctx, {
      assetId: asset.id,
      storagePath,
      signedUrlFetchStatus: res.status,
    });
    return { ok: false, reason: `signed URL fetch returned ${res.status}`, storagePath };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  zipLog("file_fetch", ctx, {
    assetId: asset.id,
    storagePath,
    exists: true,
    bytes: buffer.length,
    method: "signed_url",
  });

  return {
    ok: true,
    file: { buffer, byteLength: buffer.length, storagePath, source: "signed_url" },
  };
}

export interface ZipBuildResult {
  buffer: Buffer;
  fileCount: number;
  totalBytes: number;
  skipped: SkippedZipFile[];
}

function buildErrorsManifest(skipped: SkippedZipFile[]): string {
  const lines = [
    "Some files could not be included in this ZIP.",
    "You can download them individually from the project gallery.",
    "",
    ...skipped.map(
      (s) =>
        `- ${s.fileName} (${s.assetId})\n  path: ${s.storagePath}\n  reason: ${s.reason}`
    ),
  ];
  return lines.join("\n");
}

export async function buildProjectZipBuffer(
  supabase: SupabaseClient,
  assets: DownloadableAsset[],
  ctx: ZipLogContext
): Promise<ZipBuildResult> {
  let ZipArchive: typeof import("archiver").ZipArchive;
  try {
    ({ ZipArchive } = await import("archiver"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    zipLog("error", ctx, { phase: "import_archiver", message });
    throw new ZipDownloadError(
      "ZIP_DOWNLOAD_FAILED",
      "ZIP library failed to load.",
      `archiver import failed: ${message}`,
      500
    );
  }

  const usedNames = new Set<string>();
  const skipped: SkippedZipFile[] = [];
  const fileBuffers: { name: string; buffer: Buffer; byteLength: number }[] = [];

  for (const asset of assets) {
    try {
      const result = await fetchStorageFile(supabase, asset.file_path, ctx, asset);
      if (!result.ok) {
        skipped.push({
          assetId: asset.id,
          fileName: asset.file_name,
          storagePath: result.storagePath,
          reason: result.reason,
        });
        zipLog("file_skip", ctx, {
          assetId: asset.id,
          fileName: asset.file_name,
          reason: result.reason,
        });
        continue;
      }

      if (result.file.byteLength > MAX_SINGLE_FILE_BYTES) {
        const reason = `file too large (${result.file.byteLength} bytes, max ${MAX_SINGLE_FILE_BYTES})`;
        skipped.push({
          assetId: asset.id,
          fileName: asset.file_name,
          storagePath: result.file.storagePath,
          reason,
        });
        zipLog("file_skip", ctx, { assetId: asset.id, reason, bytes: result.file.byteLength });
        continue;
      }

      const entryName = uniqueZipEntryName(asset.file_name, usedNames);
      fileBuffers.push({
        name: `${ZIP_FOLDER}/${entryName}`,
        buffer: result.file.buffer,
        byteLength: result.file.byteLength,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown fetch error";
      skipped.push({
        assetId: asset.id,
        fileName: asset.file_name,
        storagePath: asset.file_path,
        reason,
      });
      zipLog("file_skip", ctx, { assetId: asset.id, reason });
    }
  }

  if (!fileBuffers.length) {
    throw new ZipDownloadError(
      "ZIP_DOWNLOAD_FAILED",
      "No files could be downloaded for this project.",
      skipped.length
        ? `all ${skipped.length} file(s) failed — ${skipped.map((s) => s.reason).join("; ")}`
        : "no media files available",
      404
    );
  }

  const archive = new ZipArchive({ zlib: { level: 1 } });
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk: Buffer) => chunks.push(chunk));

  const archiveError = new Promise<never>((_, reject) => {
    archive.on("error", (err: Error) => {
      zipLog("error", ctx, { phase: "archive", message: err.message, stack: err.stack });
      reject(
        new ZipDownloadError(
          "ZIP_DOWNLOAD_FAILED",
          "ZIP compression failed.",
          err.message,
          500
        )
      );
    });
  });

  archive.pipe(output);

  for (const file of fileBuffers) {
    archive.append(file.buffer, { name: file.name });
  }

  if (skipped.length > 0) {
    archive.append(buildErrorsManifest(skipped), { name: ERRORS_MANIFEST });
  }

  zipLog("zip_finalize", ctx, {
    fileCount: fileBuffers.length,
    skippedCount: skipped.length,
    totalBytes: fileBuffers.reduce((sum, f) => sum + f.byteLength, 0),
  });

  try {
    await Promise.race([archive.finalize(), archiveError]);
    await finished(output);
  } catch (err) {
    if (err instanceof ZipDownloadError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    zipLog("error", ctx, { phase: "zip_finalize", message });
    throw new ZipDownloadError(
      "ZIP_DOWNLOAD_FAILED",
      "ZIP compression failed.",
      message,
      500
    );
  }

  const buffer = Buffer.concat(chunks);
  zipLog("zip_ready", ctx, {
    fileCount: fileBuffers.length,
    zipBytes: buffer.length,
    skippedCount: skipped.length,
  });

  return {
    buffer,
    fileCount: fileBuffers.length,
    totalBytes: fileBuffers.reduce((sum, f) => sum + f.byteLength, 0),
    skipped,
  };
}

export function buildZipFilename(projectName: string | null, propertyAddress: string | null): string {
  const label = sanitizeStorageFileName(
    projectName?.trim() ||
      propertyAddress?.split(",")[0]?.trim() ||
      "project"
  );
  return `${label}-deliverables.zip`;
}

export function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function authorizeProjectZipDownload(
  profile: Profile,
  projectId: string,
  supabase: SupabaseClient
): Promise<
  | {
      ok: true;
      isAdmin: boolean;
      project: {
        id: string;
        project_name: string | null;
        property_address: string | null;
        status: string;
        client_id: string | null;
      };
    }
  | { ok: false; status: number; error: string; details: string }
> {
  const isAdmin = profile.role === "admin";

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, project_name, property_address, status, client_id, deleted_at")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return {
      ok: false,
      status: 500,
      error: "Could not load project.",
      details: projectError.message,
    };
  }

  if (!project || project.deleted_at) {
    return { ok: false, status: 404, error: "Project not found.", details: "project missing or deleted" };
  }

  if (!isAdmin && !canDownloadDeliverables(project.status)) {
    return {
      ok: false,
      status: 403,
      error: "Downloads unlock after your final payment is complete.",
      details: "unauthorized — payment required",
    };
  }

  if (!isAdmin) {
    const hasAccess = await canAccessProject(profile, projectId);
    if (!hasAccess) {
      return {
        ok: false,
        status: 403,
        error: "You don't have access to this project.",
        details: "unauthorized — not project client",
      };
    }
  }

  return { ok: true, isAdmin, project };
}

export function clientCanSeeAsset(asset: MediaAsset, isAdmin: boolean): boolean {
  return isAdmin || isClientVisibleMedia(asset);
}

export function zipErrorResponse(
  code: string,
  message: string,
  details: string,
  status: number
): Response {
  return Response.json({ error: code, message, details }, { status });
}
