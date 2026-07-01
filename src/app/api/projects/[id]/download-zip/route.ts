import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import {
  authorizeProjectZipDownload,
  buildProjectZipBuffer,
  buildZipFilename,
  contentDispositionAttachment,
  pickDownloadableAssets,
  zipErrorResponse,
  zipLog,
  ZipDownloadError,
} from "@/lib/project-zip-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const logCtx = { projectId };

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

    const ctx = { ...logCtx, userId: profile.id, role: profile.role };
    zipLog("auth", ctx, { email: profile.email });

    let supabase;
    try {
      supabase = await createServiceClient();
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

    const auth = await authorizeProjectZipDownload(profile, projectId, supabase);
    if (!auth.ok) {
      zipLog("access", ctx, { result: "denied", status: auth.status, details: auth.details });
      return zipErrorResponse("ZIP_DOWNLOAD_FAILED", auth.error, auth.details, auth.status);
    }

    const { project, isAdmin } = auth;
    zipLog("project", ctx, { found: true, status: project.status, isAdmin });

    const { data: media, error: mediaError } = await supabase
      .from("media_assets")
      .select("*")
      .eq("project_id", projectId)
      .in("media_type", ["photo", "video"])
      .order("display_order");

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

    const downloadable = pickDownloadableAssets(media ?? [], isAdmin);
    zipLog("media_filter", ctx, {
      downloadableCount: downloadable.length,
      paths: downloadable.map((a) => ({ id: a.id, path: a.file_path, name: a.file_name })),
    });

    if (!downloadable.length) {
      return zipErrorResponse(
        "ZIP_DOWNLOAD_FAILED",
        "No downloadable files for this project.",
        "no media with valid storage paths",
        404
      );
    }

    let zipResult;
    try {
      zipResult = await buildProjectZipBuffer(supabase, downloadable, ctx);
    } catch (err) {
      if (err instanceof ZipDownloadError) {
        zipLog("error", ctx, {
          phase: "zip_build",
          code: err.code,
          message: err.message,
          details: err.details,
        });
        return zipErrorResponse(err.code, err.message, err.details, err.status);
      }
      throw err;
    }

    const filename = buildZipFilename(project.project_name, project.property_address);

    return new NextResponse(new Uint8Array(zipResult.buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDispositionAttachment(filename),
        "Content-Length": String(zipResult.buffer.length),
        "Cache-Control": "no-store",
        "X-Zip-File-Count": String(zipResult.fileCount),
        "X-Zip-Bytes": String(zipResult.buffer.length),
        "X-Zip-Skipped-Count": String(zipResult.skipped.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    zipLog("error", logCtx, { phase: "unhandled", message, stack });
    console.error("[project-zip] unhandled error", err);

    return zipErrorResponse(
      "ZIP_DOWNLOAD_FAILED",
      "We couldn't prepare your ZIP download. Please try again, or download files individually from the gallery.",
      message,
      500
    );
  }
}
