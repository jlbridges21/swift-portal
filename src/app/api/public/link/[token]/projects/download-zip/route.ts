import { NextResponse } from "next/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { getAppSettings } from "@/lib/app-settings";
import {
  buildFolderZipFilename,
  buildZipFilename,
  contentDispositionAttachment,
  createProjectZipStream,
  filterDownloadableAssetsByFolder,
  pickDownloadableAssets,
  resolveFolderZipScope,
  zipErrorResponse,
  zipLog,
} from "@/lib/project-zip-download";
import {
  DOWNLOAD_GATE_API_MESSAGE,
  resolveProjectDownloadAllowed,
} from "@/lib/deliverables";
import { normalizeStatus } from "@/lib/constants";
import {
  filterMediaForVideoReviewDelivery,
  loadVideoReviewVersionMap,
} from "@/lib/video-review-media";
import { requirePublicLinkContext } from "@/lib/public-link-api";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { DOWNLOAD_QUALITY_PARAM, parseDownloadQuality } from "@/lib/download-quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(request.url);
  const folderParam = url.searchParams.get("folderId");
  const quality = parseDownloadQuality(url.searchParams.get(DOWNLOAD_QUALITY_PARAM));
  const host = await getPublicHostContext();
  const gate = await requirePublicLinkContext(request, token, host.businessId);
  if ("error" in gate && gate.error) return gate.error;
  const { ctx } = gate;

  const projectId = ctx.projectId;
  const logCtx = { projectId, folderId: folderParam ?? undefined, userId: "public-link" };

  try {
    zipLog("start", logCtx, { phase: "public_link" });
    const db = await createTenantServiceClient(ctx.businessId);
    const appSettings = await getAppSettings(ctx.businessId);

    const { data: project } = await db
      .from("projects")
      .select(
        "id, project_name, property_address, status, link_access_mode, deleted_at, client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
      )
      .eq("id", projectId)
      .maybeSingle();

    if (!project || project.deleted_at || project.link_access_mode !== "anyone_with_link") {
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "Not found.", "public link inactive", 404);
    }

    if (
      !resolveProjectDownloadAllowed({
        projectStatus: normalizeStatus(project.status ?? "new_request"),
        isAdmin: false,
        requireDeliveredForDownloads: appSettings.payments.requireDeliveredForDownloads,
      })
    ) {
      return zipErrorResponse(
        "ZIP_DOWNLOAD_FAILED",
        DOWNLOAD_GATE_API_MESSAGE,
        "unauthorized — download gate closed",
        403
      );
    }

    const folderScope = await resolveFolderZipScope(projectId, folderParam, db);
    if (!folderScope.ok) {
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", folderScope.error, folderScope.details, folderScope.status);
    }

    const { data: media, error: mediaError } = await db
      .from("media_assets")
      .select("*")
      .eq("project_id", projectId)
      .in("media_type", ["photo", "video"])
      .order("display_order", { ascending: true });

    if (mediaError) {
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "Could not load project media.", mediaError.message, 500);
    }

    const versionMap = await loadVideoReviewVersionMap(db, projectId);
    const deliveryMedia = filterMediaForVideoReviewDelivery(media ?? [], versionMap, false);
    const { mediaSectionsFromProject } = await import("@/lib/project-media-sections");
    const sections = mediaSectionsFromProject(project);
    let downloadable = pickDownloadableAssets(deliveryMedia, false, sections);
    if (folderScope.folderScope) {
      downloadable = filterDownloadableAssetsByFolder(downloadable, folderScope.folderScope);
    }

    if (!downloadable.length) {
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "No downloadable files.", "empty", 404);
    }

    const filename = folderScope.folderName
      ? buildFolderZipFilename(
          project.project_name,
          project.property_address,
          folderScope.folderName,
          quality
        )
      : buildZipFilename(project.project_name, project.property_address, quality);

    const zip = createProjectZipStream(db.raw, downloadable, logCtx, quality);
    return new NextResponse(zip.stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDispositionAttachment(filename),
        "Cache-Control": "private, no-store",
        "X-Download-Quality": quality,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    zipLog("error", logCtx, { message });
    return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "ZIP failed.", message, 500);
  }
}
