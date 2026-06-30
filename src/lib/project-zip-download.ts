import { PassThrough, Readable } from "node:stream";
import type { Archiver } from "archiver";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filterClientMedia, isClientVisibleMedia } from "@/lib/client-media";
import { canDownloadDeliverables } from "@/lib/deliverables";
import { sanitizeStorageFileName } from "@/lib/media-upload";
import { canAccessProject } from "@/lib/project-access";
import type { MediaAsset, Profile } from "@/lib/types";

const archiver = require("archiver") as (
  format: string,
  options?: { zlib?: { level?: number } }
) => Archiver;

const BUCKET = "project-media";
const ZIP_FOLDER = "deliverables";

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

export interface DownloadableAsset {
  id: string;
  file_path: string;
  file_name: string;
  media_type: string;
  display_order: number | null;
}

export function pickDownloadableAssets(
  media: MediaAsset[],
  isAdmin: boolean
): DownloadableAsset[] {
  const visible = isAdmin ? media : filterClientMedia(media);
  return visible
    .filter(
      (a) =>
        a.media_source === "upload" &&
        !!a.file_path?.trim() &&
        (a.media_type === "photo" || a.media_type === "video")
    )
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((a) => ({
      id: a.id,
      file_path: a.file_path!,
      file_name: a.file_name || `${a.id}.bin`,
      media_type: a.media_type,
      display_order: a.display_order,
    }));
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

async function streamStorageFile(
  supabase: SupabaseClient,
  filePath: string
): Promise<{ stream: Readable; byteLength?: number } | null> {
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(filePath);
  if (!error && blob) {
    const byteLength = blob.size > 0 ? blob.size : undefined;
    return {
      stream: Readable.fromWeb(blob.stream() as never),
      byteLength,
    };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 300);

  if (signError || !signed?.signedUrl) {
    return null;
  }

  const res = await fetch(signed.signedUrl, { cache: "no-store" });
  if (!res.ok || !res.body) {
    return null;
  }

  const contentLength = res.headers.get("content-length");
  return {
    stream: Readable.fromWeb(res.body as never),
    byteLength: contentLength ? Number.parseInt(contentLength, 10) : undefined,
  };
}

export interface ZipBuildResult {
  stream: PassThrough;
  fileCount: number;
  totalBytes: number;
  skipped: { assetId: string; reason: string }[];
}

interface ZipStreamEntry {
  stream: Readable;
  name: string;
  byteLength?: number;
}

async function collectZipStreamEntries(
  supabase: SupabaseClient,
  assets: DownloadableAsset[],
  ctx: ZipLogContext
): Promise<{ entries: ZipStreamEntry[]; skipped: { assetId: string; reason: string }[] }> {
  const usedNames = new Set<string>();
  const entries: ZipStreamEntry[] = [];
  const skipped: { assetId: string; reason: string }[] = [];

  for (const asset of assets) {
    zipLog("file_fetch", ctx, {
      assetId: asset.id,
      mediaType: asset.media_type,
      filePath: asset.file_path,
      bucket: BUCKET,
    });

    try {
      const fetched = await streamStorageFile(supabase, asset.file_path);
      if (!fetched) {
        const reason = "storage download and signed URL fetch both failed";
        skipped.push({ assetId: asset.id, reason });
        zipLog("file_skip", ctx, { assetId: asset.id, reason });
        continue;
      }

      const entryName = uniqueZipEntryName(asset.file_name, usedNames);
      entries.push({
        stream: fetched.stream,
        name: `${ZIP_FOLDER}/${entryName}`,
        byteLength: fetched.byteLength,
      });

      zipLog("file_fetch", ctx, {
        assetId: asset.id,
        status: "ready",
        entryName,
        bytes: fetched.byteLength ?? null,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown fetch error";
      skipped.push({ assetId: asset.id, reason });
      zipLog("file_skip", ctx, { assetId: asset.id, reason });
    }
  }

  return { entries, skipped };
}

export async function buildProjectZipStream(
  supabase: SupabaseClient,
  assets: DownloadableAsset[],
  ctx: ZipLogContext
): Promise<ZipBuildResult> {
  const { entries, skipped } = await collectZipStreamEntries(supabase, assets, ctx);

  if (!entries.length) {
    throw new Error("NO_FILES_ADDED");
  }

  const archive = archiver("zip", { zlib: { level: 1 } });
  const output = new PassThrough();
  archive.pipe(output);

  const fileCount = entries.length;
  const totalBytes = entries.reduce((sum, e) => sum + (e.byteLength ?? 0), 0);

  archive.on("error", (err: Error) => {
    zipLog("error", ctx, { phase: "archive", message: err.message });
    output.destroy(err);
  });

  void (async () => {
    try {
      for (const entry of entries) {
        archive.append(entry.stream, { name: entry.name });
      }
      zipLog("zip_finalize", ctx, { fileCount, totalBytes, skippedCount: skipped.length });
      await archive.finalize();
      zipLog("zip_ready", ctx, { fileCount, totalBytes });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      zipLog("error", ctx, { phase: "zip_finalize", message });
      archive.abort();
      output.destroy(err instanceof Error ? err : new Error(message));
    }
  })();

  return { stream: output, fileCount, totalBytes, skipped };
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
  | { ok: true; isAdmin: boolean; project: { id: string; project_name: string | null; property_address: string | null; status: string; client_id: string | null } }
  | { ok: false; status: number; error: string }
> {
  const isAdmin = profile.role === "admin";

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, project_name, property_address, status, client_id, deleted_at")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return { ok: false, status: 500, error: "Could not load project." };
  }

  if (!project || project.deleted_at) {
    return { ok: false, status: 404, error: "Project not found." };
  }

  if (!isAdmin && !canDownloadDeliverables(project.status)) {
    return {
      ok: false,
      status: 403,
      error: "Downloads unlock after your final payment is complete.",
    };
  }

  if (!isAdmin) {
    const hasAccess = await canAccessProject(profile, projectId);
    if (!hasAccess) {
      return { ok: false, status: 403, error: "You don't have access to this project." };
    }
  }

  return { ok: true, isAdmin, project };
}

export function clientCanSeeAsset(asset: MediaAsset, isAdmin: boolean): boolean {
  return isAdmin || isClientVisibleMedia(asset);
}
