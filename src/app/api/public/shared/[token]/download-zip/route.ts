import { NextResponse } from "next/server";
import { recordEgress } from "@/lib/egress-metering";
import { DOWNLOAD_QUALITY_PARAM, parseDownloadQuality } from "@/lib/download-quality";
import { downloadFileName } from "@/lib/media-display-name";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { listSharedDownloadFiles } from "@/lib/library-folder-shares";
import { trackMediaDownload } from "@/lib/media-library";
import { shareDeny } from "@/lib/media-share-preview";
import { resolveMediaShareToken } from "@/lib/media-shares";
import {
  contentDispositionAttachment,
  createProjectZipStream,
  zipErrorResponse,
  zipLog,
  ZipDownloadError,
  type DownloadableAsset,
} from "@/lib/project-zip-download";
import { clientIp } from "@/lib/public-link-api";
import { allowPhotoShareAssetRequest, isPhotoShareLookupBlocked, recordPhotoShareMiss } from "@/lib/public-link-rate-limit";
import { SHARED_ZIP_FILES_PER_PART } from "@/lib/shared-media-types";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * "Download all" for a shared Media Library folder (or a subfolder of it):
 * GET ?folder=<id>&quality=print|mls&part=1&parts=N
 *
 * The ZIP keeps the folder structure beneath the folder being downloaded. Only files the
 * share may download right now are included (share setting AND each item's project download
 * rule) — the same check as single downloads. Large folders are split into parts of
 * SHARED_ZIP_FILES_PER_PART files so each request finishes inside the function time limit.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(request);
  const blocked = isPhotoShareLookupBlocked(ip);
  if (blocked.blocked) return shareDeny(429, "Too many requests. Please try again later.", blocked.retryAfterSec);
  const rate = allowPhotoShareAssetRequest(ip);
  if (!rate.allowed) return shareDeny(429, "Too many requests. Please try again later.", rate.retryAfterSec);

  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return shareDeny(404, "Not found.");
  const share = await resolveMediaShareToken(token, host.businessId);
  if (!share || share.subject.kind !== "library_folder") {
    recordPhotoShareMiss(ip);
    return shareDeny(404, "Not found.");
  }
  if (!share.allowDownload) return shareDeny(403, "Downloads aren't enabled for this link.");

  const url = new URL(request.url);
  const folderParam = url.searchParams.get("folder");
  const quality = parseDownloadQuality(url.searchParams.get(DOWNLOAD_QUALITY_PARAM));
  const listed = await listSharedDownloadFiles(share, folderParam || null);
  if (!listed) return shareDeny(404, "Not found.");
  const { files } = listed;
  if (!files.length) return shareDeny(404, "There's nothing to download in this folder yet.");

  const parts = Math.max(1, Math.ceil(files.length / SHARED_ZIP_FILES_PER_PART));
  const part = Math.min(parts, Math.max(1, Number(url.searchParams.get("part")) || 1));
  const slice = files.slice((part - 1) * SHARED_ZIP_FILES_PER_PART, part * SHARED_ZIP_FILES_PER_PART);

  const assets: DownloadableAsset[] = slice.map(({ src, dir }) => ({
    id: src.id,
    file_path: src.filePath as string,
    file_name: downloadFileName({ title: src.item.title, file_name: src.fileName }),
    media_type: src.mediaType,
    display_order: null,
    file_size: src.item.fileSize,
    title: src.item.title,
    bucket: src.mediaType === "document" ? "project-documents" : "project-media",
    zip_dir: dir,
  }));

  const ctx = { projectId: `shared-folder:${share.subject.libraryFolder.id}` };
  const db = await createTenantServiceClient(share.businessId);
  const folderName = listed.folderName.replace(/[^\w\- ]+/g, "").trim() || "shared-folder";
  const filename = parts > 1 ? `${folderName} (part ${part} of ${parts}).zip` : `${folderName}.zip`;

  let zip;
  try {
    zip = createProjectZipStream(db.raw, assets, ctx, quality);
  } catch (err) {
    if (err instanceof ZipDownloadError) return zipErrorResponse(err.code, err.message, err.details, err.status);
    throw err;
  }
  void zip.completion
    .then((result) => {
      recordEgress(share.businessId, "zip_download", result.totalBytes, { requests: 1 });
      for (const a of assets) {
        void trackMediaDownload({ businessId: share.businessId, mediaAssetId: a.id, email: share.email, ipAddress: ip });
      }
    })
    .catch((err) => zipLog("error", ctx, { phase: "zip_stream", message: err instanceof Error ? err.message : String(err) }));

  return new NextResponse(zip.stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDispositionAttachment(filename),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Zip-Expected-Files": String(assets.length),
    },
  });
}
