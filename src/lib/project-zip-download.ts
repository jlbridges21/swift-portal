import { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filterClientMedia, isClientVisibleMedia } from "@/lib/client-media";
import {
  DOWNLOAD_GATE_API_MESSAGE,
  resolveProjectDownloadAllowed,
} from "@/lib/deliverables";
import { sanitizeStorageFileName } from "@/lib/media-upload";
import { resolveProjectAccess, touchProjectShareAccess } from "@/lib/project-access";
import { downloadFileName } from "@/lib/media-display-name";
import type { MediaAsset, Profile } from "@/lib/types";

const BUCKET = "project-media";
const ZIP_FOLDER = "deliverables";
const ERRORS_MANIFEST = `${ZIP_FOLDER}/_download_errors.txt`;
/** Skip individual files above 400MB to avoid serverless OOM on a single object. */
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
  folder_id?: string | null;
}

export interface SkippedZipFile {
  assetId: string;
  fileName: string;
  storagePath: string;
  reason: string;
}

export interface ZipStreamResult {
  fileCount: number;
  totalBytes: number;
  skipped: SkippedZipFile[];
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
      file_name: downloadFileName(a),
      media_type: a.media_type,
      display_order: a.display_order,
      folder_id: a.folder_id ?? null,
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

interface OpenStreamResult {
  stream: Readable;
  byteLength?: number;
  storagePath: string;
  source: "storage_download" | "signed_url";
}

async function openStorageReadStream(
  supabase: SupabaseClient,
  rawPath: string,
  ctx: ZipLogContext,
  asset: DownloadableAsset
): Promise<{ ok: true; file: OpenStreamResult } | { ok: false; reason: string; storagePath: string }> {
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

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300);

  if (!signError && signed?.signedUrl) {
    const res = await fetch(signed.signedUrl, { cache: "no-store" });
    if (res.ok && res.body) {
      const contentLength = res.headers.get("content-length");
      const byteLength = contentLength ? Number.parseInt(contentLength, 10) : undefined;
      const stream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
      zipLog("file_fetch", ctx, {
        assetId: asset.id,
        storagePath,
        exists: true,
        bytes: byteLength,
        method: "signed_url",
      });
      return {
        ok: true,
        file: {
          stream,
          byteLength: Number.isFinite(byteLength) ? byteLength : undefined,
          storagePath,
          source: "signed_url",
        },
      };
    }
    zipLog("file_fetch", ctx, {
      assetId: asset.id,
      storagePath,
      signedUrlFetchStatus: res.status,
    });
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (!downloadError && blob) {
    const stream = Readable.fromWeb(blob.stream() as import("stream/web").ReadableStream);
    zipLog("file_fetch", ctx, {
      assetId: asset.id,
      storagePath,
      exists: true,
      bytes: blob.size,
      method: "storage_download",
    });
    return {
      ok: true,
      file: {
        stream,
        byteLength: blob.size,
        storagePath,
        source: "storage_download",
      },
    };
  }

  zipLog("file_skip", ctx, {
    assetId: asset.id,
    storagePath,
    signError: signError?.message ?? "no signed url",
    downloadError: downloadError?.message ?? "unknown",
  });

  return {
    ok: false,
    reason: signError?.message ?? downloadError?.message ?? "storage download failed",
    storagePath,
  };
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

function appendStreamToArchive(
  archive: import("archiver").ZipArchive,
  stream: Readable,
  name: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once("error", reject);
    archive.append(stream, { name });
    finished(stream).then(() => resolve()).catch(reject);
  });
}

/**
 * Stream a project ZIP to the client as each storage object is read.
 * Memory stays bounded — only one file + compression buffers at a time.
 */
export function createProjectZipStream(
  supabase: SupabaseClient,
  assets: DownloadableAsset[],
  ctx: ZipLogContext
): { stream: ReadableStream<Uint8Array>; completion: Promise<ZipStreamResult> } {
  const passThrough = new PassThrough();
  const webStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

  const completion = (async (): Promise<ZipStreamResult> => {
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
    let fileCount = 0;
    let totalBytes = 0;

    const archive = new ZipArchive({ zlib: { level: 1 } });
    archive.pipe(passThrough);

    const archiveError = new Promise<never>((_, reject) => {
      archive.on("error", (err: Error) => {
        zipLog("error", ctx, { phase: "archive", message: err.message, stack: err.stack });
        reject(
          new ZipDownloadError(
            "ZIP_DOWNLOAD_FAILED",
            "ZIP compression failed while building your download.",
            err.message,
            500
          )
        );
      });
    });

    for (const asset of assets) {
      try {
        const result = await openStorageReadStream(supabase, asset.file_path, ctx, asset);
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

        const byteLength = result.file.byteLength ?? 0;
        if (byteLength > MAX_SINGLE_FILE_BYTES) {
          result.file.stream.destroy();
          const reason = `file too large (${byteLength} bytes, max ${MAX_SINGLE_FILE_BYTES})`;
          skipped.push({
            assetId: asset.id,
            fileName: asset.file_name,
            storagePath: result.file.storagePath,
            reason,
          });
          zipLog("file_skip", ctx, { assetId: asset.id, reason, bytes: byteLength });
          continue;
        }

        const entryName = uniqueZipEntryName(asset.file_name, usedNames);
        await Promise.race([
          appendStreamToArchive(archive, result.file.stream, `${ZIP_FOLDER}/${entryName}`),
          archiveError,
        ]);
        fileCount++;
        if (byteLength > 0) totalBytes += byteLength;
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

    if (!fileCount) {
      archive.abort();
      throw new ZipDownloadError(
        "ZIP_DOWNLOAD_FAILED",
        skipped.length
          ? "No files could be downloaded for this project."
          : "No downloadable files for this project.",
        skipped.length
          ? `all ${skipped.length} file(s) failed — ${skipped.map((s) => `${s.fileName}: ${s.reason}`).join("; ")}`
          : "no media files available",
        404
      );
    }

    if (skipped.length > 0) {
      archive.append(buildErrorsManifest(skipped), { name: ERRORS_MANIFEST });
    }

    zipLog("zip_finalize", ctx, {
      fileCount,
      skippedCount: skipped.length,
      totalBytes,
    });

    try {
      await Promise.race([archive.finalize(), archiveError]);
      await finished(passThrough);
    } catch (err) {
      if (err instanceof ZipDownloadError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      zipLog("error", ctx, { phase: "zip_finalize", message });
      throw new ZipDownloadError(
        "ZIP_DOWNLOAD_FAILED",
        "ZIP compression failed while finishing your download.",
        message,
        500
      );
    }

    zipLog("zip_ready", ctx, {
      fileCount,
      skippedCount: skipped.length,
      totalBytes,
    });

    return { fileCount, totalBytes, skipped };
  })().catch((err) => {
    passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
    throw err;
  });

  return { stream: webStream, completion };
}

export function buildZipFilename(projectName: string | null, propertyAddress: string | null): string {
  const label = projectZipBaseLabel(projectName, propertyAddress);
  return `${label}-deliverables.zip`;
}

function projectZipBaseLabel(projectName: string | null, propertyAddress: string | null): string {
  return sanitizeStorageFileName(
    projectName?.trim() ||
      propertyAddress?.split(",")[0]?.trim() ||
      "project"
  );
}

/** "{Project Name} - {Folder Name}.zip" */
export function buildFolderZipFilename(
  projectName: string | null,
  propertyAddress: string | null,
  folderName: string
): string {
  const projectLabel = projectZipBaseLabel(projectName, propertyAddress);
  const folderLabel = sanitizeStorageFileName(folderName.trim() || "Folder");
  return `${projectLabel} - ${folderLabel}.zip`;
}

export function filterDownloadableAssetsByFolder(
  assets: DownloadableAsset[],
  folderScope: string | null
): DownloadableAsset[] {
  if (folderScope === null) return assets;
  if (folderScope === "unfiled") {
    return assets.filter((a) => !a.folder_id);
  }
  return assets.filter((a) => a.folder_id === folderScope);
}

export async function resolveFolderZipScope(
  projectId: string,
  folderParam: string | null,
  supabase: { from: SupabaseClient["from"] }
): Promise<
  | { ok: true; folderScope: string | null; folderName: string | null }
  | { ok: false; status: number; error: string; details: string }
> {
  if (!folderParam) {
    return { ok: true, folderScope: null, folderName: null };
  }

  if (folderParam === "unfiled") {
    return { ok: true, folderScope: "unfiled", folderName: "General Photos" };
  }

  const { data: folder, error } = await supabase
    .from("media_folders")
    .select("id, name, project_id")
    .eq("id", folderParam)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Could not load folder.",
      details: error.message,
    };
  }

  if (!folder || folder.project_id !== projectId) {
    return {
      ok: false,
      status: 404,
      error: "Folder not found.",
      details: "folder missing or does not belong to this project",
    };
  }

  return { ok: true, folderScope: folder.id, folderName: folder.name };
}

export function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function authorizeProjectZipDownload(
  profile: Profile,
  projectId: string,
  supabase: { from: SupabaseClient["from"] },
  requireDeliveredForDownloads: boolean
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
  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, project_name, property_address, status, client_id, business_id, deleted_at")
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

  if (
    !resolveProjectDownloadAllowed({
      projectStatus: project.status,
      isAdmin,
      requireDeliveredForDownloads,
    })
  ) {
    return {
      ok: false,
      status: 403,
      error: DOWNLOAD_GATE_API_MESSAGE,
      details: "unauthorized — download gate closed",
    };
  }

  if (!isAdmin) {
    const access = await resolveProjectAccess(profile, projectId, {
      tenantBusinessId: project.business_id,
    });
    if (!access.allowed) {
      return {
        ok: false,
        status: 403,
        error: "You don't have access to this project.",
        details: "unauthorized — not project client or share",
      };
    }
    if (access.kind === "share" && access.shareId) {
      void touchProjectShareAccess(access.shareId);
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
