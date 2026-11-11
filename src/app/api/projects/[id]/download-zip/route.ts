import { NextResponse } from "next/server";
import { recordEgress } from "@/lib/egress-metering";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import {
  authorizeProjectZipDownload,
  buildFolderZipFilename,
  buildZipFilename,
  contentDispositionAttachment,
  createProjectZipStream,
  filterDownloadableAssetsByFolder,
  pickDownloadableAssets,
  resolveFolderZipScope,
  zipErrorResponse,
  zipLog,
  ZipDownloadError,
} from "@/lib/project-zip-download";
import { touchProjectShareAccess } from "@/lib/project-access";
import { getAppSettings } from "@/lib/app-settings";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  filterMediaForVideoReviewDelivery,
  loadVideoReviewVersionMap,
} from "@/lib/video-review-media";
import { DOWNLOAD_QUALITY_PARAM, parseDownloadQuality } from "@/lib/download-quality";
import { resolveAssignedClientId } from "@/lib/project-access";
import { listClientFavoriteIds } from "@/lib/client-favorites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const url = new URL(request.url);
  const folderParam = url.searchParams.get("folderId");
  // favorites=1: only the signed-in client's hearted photos (after every normal filter below).
  const favoritesOnly = url.searchParams.get("favorites") === "1";
  const quality = parseDownloadQuality(url.searchParams.get(DOWNLOAD_QUALITY_PARAM));
  const logCtx = { projectId, folderId: folderParam ?? undefined };

  try {
    zipLog("start", logCtx, { phase: "request_received" });

    let profile;
    try {
      profile = await getProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      zipLog("error", logCtx, { phase: "get_profile", message });
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "Authentication failed.", message, 401);
    }

    if (!profile) {
      zipLog("auth", logCtx, { result: "unauthorized" });
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "Unauthorized.", "no profile", 401);
    }

    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const ctx = { ...logCtx, userId: profile.id, role: profile.role };
    zipLog("auth", ctx, { email: profile.email });

    let db;
    try {
      db = await createTenantServiceClient(tenant.businessId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      zipLog("error", ctx, { phase: "create_service_client", message });
      return zipErrorResponse(
        "ZIP_DOWNLOAD_FAILED",
        "Storage service unavailable.",
        message,
        500
      );
    }

    const appSettings = await getAppSettings(tenant.businessId);

    const auth = await authorizeProjectZipDownload(
      profile,
      projectId,
      db,
      appSettings.payments.requireDeliveredForDownloads,
      {
        isSharedViewer: tenant.isSharedViewer,
        sharedProjectIds: tenant.sharedProjectIds,
      }
    );
    if (!auth.ok) {
      zipLog("access", ctx, { result: "denied", status: auth.status, details: auth.details });
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", auth.error, auth.details, auth.status);
    }

    const { project, isAdmin } = auth;
    zipLog("project", ctx, { found: true, status: project.status, isAdmin });

    const folderScope = await resolveFolderZipScope(projectId, folderParam, db);
    if (!folderScope.ok) {
      zipLog("access", ctx, {
        result: "folder_denied",
        status: folderScope.status,
        details: folderScope.details,
      });
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", folderScope.error, folderScope.details, folderScope.status);
    }

    const { data: media, error: mediaError } = await db
      .from("media_assets")
      .select("*")
      .eq("project_id", projectId)
      .in("media_type", ["photo", "video"])
      .order("display_order", { ascending: true });

    if (mediaError) {
      zipLog("error", ctx, { phase: "media_query", message: mediaError.message });
      return zipErrorResponse(
        "ZIP_DOWNLOAD_FAILED",
        "Could not load project media.",
        mediaError.message,
        500
      );
    }

    zipLog("media_query", ctx, { totalAssets: media?.length ?? 0 });

    const { data: projectRow } = await db
      .from("projects")
      .select(
        "client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
      )
      .eq("id", projectId)
      .maybeSingle();
    const { mediaSectionsFromProject } = await import("@/lib/project-media-sections");
    const sections = mediaSectionsFromProject(projectRow);

    const versionMap = await loadVideoReviewVersionMap(db, projectId);
    const deliveryMedia = filterMediaForVideoReviewDelivery(media ?? [], versionMap, isAdmin);
    let downloadable = pickDownloadableAssets(deliveryMedia, isAdmin, sections);
    if (folderScope.folderScope) {
      downloadable = filterDownloadableAssetsByFolder(downloadable, folderScope.folderScope);
    }
    if (favoritesOnly) {
      const clientId = await resolveAssignedClientId(profile, projectId);
      const favoriteIds = clientId
        ? new Set((await listClientFavoriteIds(tenant.businessId, projectId, clientId)).ids)
        : new Set<string>();
      downloadable = downloadable.filter((a) => a.media_type === "photo" && favoriteIds.has(a.id));
      if (!downloadable.length) {
        return zipErrorResponse("ZIP_DOWNLOAD_FAILED", "You haven't favorited any downloadable photos yet.", "favorites scope empty", 404);
      }
    }
    zipLog("media_filter", ctx, {
      downloadableCount: downloadable.length,
      folderScope: folderScope.folderScope,
      folderName: folderScope.folderName,
      paths: downloadable.map((a) => ({ id: a.id, path: a.file_path, name: a.file_name })),
    });

    if (!downloadable.length) {
      const emptyMessage = folderScope.folderScope
        ? folderScope.folderName
          ? `No downloadable files in “${folderScope.folderName}”.`
          : "No downloadable files in this folder."
        : "No downloadable files for this project.";
      return zipErrorResponse(
        "ZIP_DOWNLOAD_FAILED",
        emptyMessage,
        folderScope.folderScope
          ? "no downloadable media in folder scope after visibility filter"
          : "no media with valid storage paths",
        404
      );
    }

    const filename = favoritesOnly
      ? buildFolderZipFilename(project.project_name, project.property_address, "Favorites", quality)
      : folderScope.folderName
      ? buildFolderZipFilename(
          project.project_name,
          project.property_address,
          folderScope.folderName,
          quality
        )
      : buildZipFilename(project.project_name, project.property_address, quality);

    let zipStream;
    try {
      zipStream = createProjectZipStream(db.raw, downloadable, ctx, quality);
    } catch (err) {
      if (err instanceof ZipDownloadError) {
        return zipErrorResponse(err.code, err.message, err.details, err.status);
      }
      throw err;
    }

    void zipStream.completion
      .then((result) => {
        if (auth.shareId) void touchProjectShareAccess(auth.shareId);
        recordEgress(tenant.businessId, "zip_download", result.totalBytes, { requests: 1 });
        zipLog("zip_ready", ctx, {
          fileCount: result.fileCount,
          skippedCount: result.skipped.length,
          totalBytes: result.totalBytes,
        });
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
        "X-Download-Quality": quality,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    zipLog("error", logCtx, { phase: "unhandled", message, stack });
    console.error("[project-zip] unhandled error", err);

    const userMessage =
      /heap|memory|ENOMEM/i.test(message)
        ? "This gallery is too large to download in one request. Try downloading files individually from the gallery."
        : /timeout|timed out|ETIMEDOUT/i.test(message)
          ? "The download timed out before the archive finished. Try again on a stable connection, or download files individually."
          : "We couldn't prepare your ZIP download. Please try again, or download files individually from the gallery.";

    return zipErrorResponse("ZIP_DOWNLOAD_FAILED", userMessage, message, 500);
  }
}
