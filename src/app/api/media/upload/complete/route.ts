import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { logProjectActivity } from "@/lib/activity";
import { notifyProjectClients } from "@/lib/notifications";
import { logUploadStep } from "@/lib/upload/logger";
import { setMediaTags } from "@/lib/media-library";

const STORAGE_VERIFY_ATTEMPTS = 6;
const STORAGE_VERIFY_DELAY_MS = 1500;

async function verifyStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  filePath: string,
  context: { projectId?: string | null; fileName: string; fileSize?: number; fileType?: string }
): Promise<{ ok: true } | { ok: false; error: string; details?: unknown }> {
  for (let attempt = 1; attempt <= STORAGE_VERIFY_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60);

    if (!error && data?.signedUrl) {
      logUploadStep("info", {
        step: "storage_verify",
        ...context,
        filePath,
        details: { attempt, bucket },
      });
      return { ok: true };
    }

    logUploadStep("warn", {
      step: "storage_verify_retry",
      ...context,
      filePath,
      providerMessage: error?.message,
      details: { attempt, bucket },
    });

    if (attempt < STORAGE_VERIFY_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, STORAGE_VERIFY_DELAY_MS * attempt));
    }
  }

  return {
    ok: false,
    error: "Upload completed but could not be saved — file not found in storage yet. Try saving again.",
    details: { bucket, filePath, attempts: STORAGE_VERIFY_ATTEMPTS },
  };
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();
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
  } = body;

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

  const supabase = await createServiceClient();
  const bucket = mediaType === "document" ? "project-documents" : "project-media";

  const { data: existingAsset, error: existingError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("file_path", filePath)
    .maybeSingle();

  if (existingError) {
    logUploadStep("error", {
      step: "database_lookup",
      ...logContext,
      providerMessage: existingError.message,
    });
    return NextResponse.json(
      { success: false, error: existingError.message, step: "database_lookup" },
      { status: 500 }
    );
  }

  if (existingAsset) {
    logUploadStep("info", { step: "database_idempotent_hit", ...logContext, details: { assetId: existingAsset.id } });
    return NextResponse.json({ success: true, media: existingAsset });
  }

  const verify = await verifyStorageObject(supabase, bucket, filePath, logContext);
  if (!verify.ok) {
    logUploadStep("error", {
      step: "storage_verify",
      ...logContext,
      providerMessage: verify.error,
      details: verify.details,
    });
    return NextResponse.json(
      { success: false, error: verify.error, step: "storage_verify", details: verify.details },
      { status: 400 }
    );
  }

  const { data: asset, error: dbError } = await supabase
    .from("media_assets")
    .insert({
      project_id: projectId || null,
      file_name: fileName,
      file_path: filePath,
      storage_path: filePath,
      file_size: fileSize || null,
      mime_type: mimeType,
      media_type: mediaType,
      media_source: "upload",
      display_order: displayOrder ?? 0,
      title: title?.trim() || fileName,
      description: description?.trim() || null,
      thumbnail_url: thumbnailPath || null,
    })
    .select()
    .single();

  if (dbError) {
    if (dbError.code === "23505") {
      const { data: raced } = await supabase
        .from("media_assets")
        .select("*")
        .eq("file_path", filePath)
        .maybeSingle();
      if (raced) {
        return NextResponse.json({ success: true, media: raced });
      }
    }

    logUploadStep("error", {
      step: "database_insert",
      ...logContext,
      providerMessage: dbError.message,
      details: { code: dbError.code },
    });
    return NextResponse.json(
      { success: false, error: dbError.message, step: "database_insert", details: { code: dbError.code } },
      { status: 500 }
    );
  }

  if (Array.isArray(tags) && tags.length) {
    await setMediaTags(asset.id, tags);
  }

  logUploadStep("info", { step: "database_insert", ...logContext, details: { assetId: asset.id } });

  if (projectId && mediaType === "photo") {
    const { data: project } = await supabase
      .from("projects")
      .select("cover_image_id")
      .eq("id", projectId)
      .single();

    if (!project?.cover_image_id) {
      await supabase.from("projects").update({ cover_image_id: asset.id }).eq("id", projectId);
    }
  }

  if (projectId) {
    const activityType =
      mediaType === "photo" ? "photos_uploaded" : mediaType === "video" ? "videos_uploaded" : "documents_uploaded";
    const label =
      mediaType === "photo" ? "Photo uploaded" : mediaType === "video" ? "Video uploaded" : "Document uploaded";

    await logProjectActivity(activityType, label, {
      projectId,
      metadata: { mediaType, assetId: asset.id },
    });

    if (mediaType !== "document") {
      await notifyProjectClients({
        type: "deliverables_uploaded",
        eventKey: "deliverables_ready",
        title: "Media in Production",
        body:
          mediaType === "video"
            ? "A new video has been added to your project."
            : "New photos have been added to your project.",
        link: `/dashboard/projects/${projectId}#deliverables`,
        projectId,
      });
    }
  }

  return NextResponse.json({ success: true, media: asset });
}
