import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { logProjectActivity } from "@/lib/activity";
import { notifyProjectClients } from "@/lib/notifications";
import { logUploadStep } from "@/lib/upload/logger";
import { verifyStorageObject } from "@/lib/upload/storage-verify";
import { setMediaTags } from "@/lib/media-library";

export async function POST(request: Request) {
  try {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (parseErr) {
    logUploadStep("error", {
      step: "validate_request",
      providerMessage: "Invalid JSON body",
      details: String(parseErr),
    });
    return NextResponse.json(
      { success: false, error: "Invalid request body.", step: "validate_request" },
      { status: 400 }
    );
  }

  const {
    projectId,
    filePath,
    fileName,
    mimeType,
    fileSize,
    mediaType,
    displayOrder,
    title,
    description,
    tags,
    thumbnailPath,
    skipStorageVerify,
  } = body as {
    projectId?: string | null;
    filePath?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    mediaType?: string;
    displayOrder?: number;
    title?: string;
    description?: string;
    tags?: string[];
    thumbnailPath?: string | null;
    skipStorageVerify?: boolean;
  };

  const logContext = {
    projectId: projectId ?? null,
    fileName,
    fileSize,
    fileType: mimeType,
    filePath,
  };

  if (!filePath || !fileName || !mimeType || !mediaType) {
    logUploadStep("error", { step: "validate_request", ...logContext, details: body });
    return NextResponse.json(
      { success: false, error: "Missing required fields.", step: "validate_request" },
      { status: 400 }
    );
  }

  const validated = {
    projectId: projectId ?? null,
    filePath,
    fileName,
    mimeType,
    fileSize,
    mediaType,
    displayOrder,
    title,
    description,
    tags,
    thumbnailPath,
    skipStorageVerify,
  };

  const logContextValidated = {
    projectId: validated.projectId,
    fileName: validated.fileName,
    fileSize: validated.fileSize,
    fileType: validated.mimeType,
    filePath: validated.filePath,
  };

  const supabase = await createServiceClient();
  const bucket = validated.mediaType === "document" ? "project-documents" : "project-media";

  const { data: existingAsset, error: existingError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("file_path", validated.filePath)
    .maybeSingle();

  if (existingError) {
    logUploadStep("error", {
      step: "database_lookup",
      ...logContextValidated,
      providerMessage: existingError.message,
    });
    return NextResponse.json(
      { success: false, error: existingError.message, step: "database_lookup" },
      { status: 500 }
    );
  }

  if (existingAsset) {
    logUploadStep("info", {
      step: "database_idempotent_hit",
      ...logContextValidated,
      details: { assetId: existingAsset.id },
    });
    return NextResponse.json({ success: true, media: existingAsset });
  }

  if (!validated.skipStorageVerify) {
    const verify = await verifyStorageObject(supabase, bucket, validated.filePath, {
      ...logContextValidated,
      mediaType: validated.mediaType,
    });
    if (!verify.ok) {
      logUploadStep("error", {
        step: "storage_verify",
        ...logContextValidated,
        providerMessage: verify.error,
        details: verify.details,
      });
      return NextResponse.json(
        { success: false, error: verify.error, step: "storage_verify", details: verify.details },
        { status: 400 }
      );
    }
  }

  const { data: asset, error: dbError } = await supabase
    .from("media_assets")
    .insert({
      project_id: validated.projectId,
      file_name: validated.fileName,
      file_path: validated.filePath,
      storage_path: validated.filePath,
      file_size: validated.fileSize || null,
      mime_type: validated.mimeType,
      media_type: validated.mediaType,
      media_source: "upload",
      display_order: validated.displayOrder ?? 0,
      title: validated.title?.trim() || validated.fileName,
      description: validated.description?.trim() || null,
      thumbnail_url: validated.thumbnailPath || null,
    })
    .select()
    .single();

  if (dbError) {
    if (dbError.code === "23505") {
      const { data: raced } = await supabase
        .from("media_assets")
        .select("*")
        .eq("file_path", validated.filePath)
        .maybeSingle();
      if (raced) {
        return NextResponse.json({ success: true, media: raced });
      }
    }

    logUploadStep("error", {
      step: "database_insert",
      ...logContextValidated,
      providerMessage: dbError.message,
      details: { code: dbError.code, hint: dbError.hint },
    });
    return NextResponse.json(
      {
        success: false,
        error: dbError.message,
        step: "database_insert",
        details: { code: dbError.code, hint: dbError.hint },
      },
      { status: 500 }
    );
  }

  if (Array.isArray(validated.tags) && validated.tags.length) {
    try {
      await setMediaTags(asset.id, validated.tags);
    } catch (tagErr) {
      logUploadStep("warn", {
        step: "tags_save",
        ...logContextValidated,
        details: { assetId: asset.id, error: String(tagErr) },
      });
    }
  }

  logUploadStep("info", { step: "save_complete", ...logContextValidated, details: { assetId: asset.id } });

  try {
    if (validated.projectId && validated.mediaType === "photo") {
      const { data: project } = await supabase
        .from("projects")
        .select("cover_image_id")
        .eq("id", validated.projectId)
        .single();

      if (!project?.cover_image_id) {
        await supabase.from("projects").update({ cover_image_id: asset.id }).eq("id", validated.projectId);
      }
    }

    if (validated.projectId) {
      const activityType =
        validated.mediaType === "photo"
          ? "photos_uploaded"
          : validated.mediaType === "video"
            ? "videos_uploaded"
            : "documents_uploaded";
      const label =
        validated.mediaType === "photo"
          ? "Photo uploaded"
          : validated.mediaType === "video"
            ? "Video uploaded"
            : "Document uploaded";

      await logProjectActivity(activityType, label, {
        projectId: validated.projectId,
        metadata: { mediaType: validated.mediaType, assetId: asset.id },
      });

      if (validated.mediaType !== "document") {
        await notifyProjectClients({
          type: "deliverables_uploaded",
          eventKey: "deliverables_ready",
          title: "Media in Production",
          body:
            validated.mediaType === "video"
              ? "A new video has been added to your project."
              : "New photos have been added to your project.",
          link: `/dashboard/projects/${validated.projectId}#deliverables`,
          projectId: validated.projectId,
        });
      }
    }
  } catch (postErr) {
    logUploadStep("warn", {
      step: "post_insert_side_effects",
      ...logContextValidated,
      details: { assetId: asset.id, error: String(postErr) },
    });
  }

  return NextResponse.json({ success: true, media: asset });
  } catch (err) {
    logUploadStep("error", {
      step: "saving_metadata",
      providerMessage: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unexpected error while saving upload.",
        step: "saving_metadata",
      },
      { status: 500 }
    );
  }
}
