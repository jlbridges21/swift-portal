import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recordEgress } from "@/lib/egress-metering";
import { downloadFileName } from "@/lib/media-display-name";
import {
  contentDispositionAttachment,
  createProjectZipStream,
  zipErrorResponse,
  zipLog,
  ZipDownloadError,
  type DownloadableAsset,
} from "@/lib/project-zip-download";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin, staffCan, visibleProjectIdsFor } from "@/lib/staff-access";
import type { MediaAsset } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Hard cap per request — the client splits larger selections into parts. */
const MAX_IDS_PER_ZIP = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readIds(request: Request): Promise<{ ids: string[]; part: number; parts: number }> {
  const type = request.headers.get("content-type") ?? "";
  let raw: unknown;
  let part: unknown;
  let parts: unknown;
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    raw = body?.ids;
    part = body?.part;
    parts = body?.parts;
  } else {
    const form = await request.formData();
    raw = String(form.get("ids") ?? "").split(",");
    part = form.get("part");
    parts = form.get("parts");
  }
  const ids = Array.isArray(raw)
    ? [...new Set(raw.map((v) => String(v).trim()).filter((v) => UUID_RE.test(v)))]
    : [];
  return { ids, part: Number(part) || 1, parts: Number(parts) || 1 };
}

/**
 * ZIP of selected Media Library files across projects (photos, videos, documents).
 * Links (360° tours, 3D models, YouTube) have no stored file and are skipped by the
 * caller; any id without a stored file is skipped here too.
 */
export async function POST(request: Request) {
  const logCtx = { projectId: "media-library" };
  try {
    let profile;
    try {
      profile = await requireAdmin({ area: "media" });
    } catch {
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "Unauthorized.", "not an admin", 401);
    }
    if (!staffCan(profile, "media.download_originals")) {
      return zipErrorResponse(
        "ZIP_DOWNLOAD_FAILED",
        "You don't have permission to download original files.",
        "missing media.download_originals",
        403
      );
    }
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const ctx = { ...logCtx, userId: profile.id, role: profile.role };

    const { ids, part, parts } = await readIds(request);
    if (!ids.length) {
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "No files selected.", "empty ids", 400);
    }
    if (ids.length > MAX_IDS_PER_ZIP) {
      return zipErrorResponse(
        "ZIP_DOWNLOAD_FAILED",
        `Too many files in one ZIP (max ${MAX_IDS_PER_ZIP}).`,
        `${ids.length} ids`,
        400
      );
    }

    const db = await createTenantServiceClient(tenant.businessId);
    const scope = isOwnerAdmin(profile)
      ? ("all" as const)
      : await visibleProjectIdsFor(tenant.businessId, profile);
    const scopeSet = scope === "all" ? null : new Set(scope);

    const rows: MediaAsset[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await db
        .from("media_assets")
        .select("*")
        .in("id", ids.slice(i, i + 100));
      if (error) {
        return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "Could not load media.", error.message, 500);
      }
      rows.push(...((data ?? []) as MediaAsset[]));
    }

    const order = new Map(ids.map((id, i) => [id, i]));
    const downloadable: DownloadableAsset[] = rows
      .filter((row) => {
        if (scopeSet && (!row.project_id || !scopeSet.has(row.project_id))) return false;
        if (!row.file_path) return false;
        return !["youtube", "kuula", "external"].includes(row.media_source);
      })
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((row) => ({
        id: row.id,
        file_path: row.file_path!,
        file_name: downloadFileName(row),
        media_type: row.media_type,
        display_order: row.display_order ?? null,
        folder_id: row.folder_id ?? null,
        file_size: row.file_size,
        title: row.title,
        bucket: row.media_type === "document" ? "project-documents" : "project-media",
      }));

    zipLog("media_filter", ctx, { requested: ids.length, downloadableCount: downloadable.length });

    if (!downloadable.length) {
      return zipErrorResponse(
        "ZIP_DOWNLOAD_FAILED",
        "None of the selected items have downloadable files.",
        "no stored files in selection",
        404
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename =
      parts > 1
        ? `media-library-${date}-part-${part}-of-${parts}.zip`
        : `media-library-${date}.zip`;

    let zipStream;
    try {
      zipStream = createProjectZipStream(db.raw, downloadable, ctx);
    } catch (err) {
      if (err instanceof ZipDownloadError) {
        return zipErrorResponse(err.code, err.message, err.details, err.status);
      }
      throw err;
    }

    void zipStream.completion
      .then((result) => {
        recordEgress(tenant.businessId, "zip_download", result.totalBytes, { requests: 1 });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        zipLog("error", ctx, { phase: "zip_stream", message });
      });

    return new NextResponse(zipStream.stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDispositionAttachment(filename),
        "Cache-Control": "no-store",
        "X-Zip-Expected-Files": String(downloadable.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    zipLog("error", logCtx, { phase: "unhandled", message });
    return NextResponse.json(
      {
        error: "ZIP_DOWNLOAD_FAILED",
        message: "We couldn't prepare your ZIP download. Please try again.",
        details: message,
      },
      { status: 500 }
    );
  }
}
