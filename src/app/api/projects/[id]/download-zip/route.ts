import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import {
  authorizeProjectZipDownload,
  buildProjectZipStream,
  buildZipFilename,
  contentDispositionAttachment,
  pickDownloadableAssets,
  zipLog,
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
    const profile = await getProfile();
    if (!profile) {
      zipLog("auth", logCtx, { result: "unauthorized" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ctx = { ...logCtx, userId: profile.id, role: profile.role };
    zipLog("start", ctx, { email: profile.email });

    const supabase = await createServiceClient();
    const auth = await authorizeProjectZipDownload(profile, projectId, supabase);

    if (!auth.ok) {
      zipLog("access", ctx, { result: "denied", status: auth.status, reason: auth.error });
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { project, isAdmin } = auth;
    zipLog("project", ctx, {
      found: true,
      status: project.status,
      isAdmin,
    });

    const { data: media, error: mediaError } = await supabase
      .from("media_assets")
      .select("*")
      .eq("project_id", projectId)
      .in("media_type", ["photo", "video"])
      .order("display_order");

    if (mediaError) {
      zipLog("error", ctx, { phase: "media_query", message: mediaError.message });
      return NextResponse.json({ error: "Could not load project media." }, { status: 500 });
    }

    zipLog("media_query", ctx, { totalAssets: media?.length ?? 0 });

    const downloadable = pickDownloadableAssets(media ?? [], isAdmin);
    zipLog("media_filter", ctx, {
      downloadableCount: downloadable.length,
      assetIds: downloadable.map((a) => a.id),
    });

    if (!downloadable.length) {
      return NextResponse.json({ error: "No downloadable files for this project." }, { status: 404 });
    }

    const { stream, fileCount, totalBytes, skipped } = await buildProjectZipStream(
      supabase,
      downloadable,
      ctx
    );

    const filename = buildZipFilename(project.project_name, project.property_address);

    const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDispositionAttachment(filename),
        "Cache-Control": "no-store",
        "X-Zip-File-Count": String(fileCount),
        "X-Zip-Bytes-Estimate": String(totalBytes),
        "X-Zip-Skipped-Count": String(skipped.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === "NO_FILES_ADDED") {
      zipLog("error", logCtx, {
        phase: "zip_build",
        message: "no files could be fetched from storage",
      });
      return NextResponse.json(
        {
          error:
            "No files could be downloaded. Your deliverables may still be processing — try again shortly, or download files individually.",
        },
        { status: 404 }
      );
    }

    zipLog("error", logCtx, { phase: "unhandled", message });
    console.error("[project-zip] unhandled error", err);

    return NextResponse.json(
      {
        error:
          "We couldn't prepare your ZIP download. Please try again, or download files individually from the gallery.",
      },
      { status: 500 }
    );
  }
}
