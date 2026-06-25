import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { FILE_SIZE_LIMITS, formatFileSize } from "@/lib/brand";
import {
  buildMediaStoragePath,
  validateMediaFile,
} from "@/lib/media-upload";
import { logActivity } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { notifyProjectClients } from "@/lib/notifications";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const projectId = formData.get("projectId") as string;
  const mediaType = formData.get("mediaType") as string;
  const files = formData.getAll("files") as File[];

  if (!projectId || !files.length) {
    return NextResponse.json({ error: "Missing project or files" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const uploaded: unknown[] = [];
  const errors: string[] = [];

  const sizeLimit =
    mediaType === "photo"
      ? FILE_SIZE_LIMITS.photo
      : mediaType === "video"
        ? FILE_SIZE_LIMITS.video
        : FILE_SIZE_LIMITS.document;

  const { data: existing } = await supabase
    .from("media_assets")
    .select("display_order")
    .eq("project_id", projectId)
    .eq("media_type", mediaType)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrder = (existing?.display_order ?? -1) + 1;

  for (const file of files) {
    const validation = validateMediaFile(file, mediaType, sizeLimit);
    if (!validation.ok) {
      errors.push(validation.error);
      continue;
    }

    const bucket = mediaType === "document" ? "project-documents" : "project-media";
    const filePath = buildMediaStoragePath(projectId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { contentType: validation.mimeType, upsert: false });

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    const { data: asset, error: dbError } = await supabase
      .from("media_assets")
      .insert({
        project_id: projectId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: validation.mimeType,
        media_type: mediaType,
        media_source: "upload",
        display_order: nextOrder++,
      })
      .select()
      .single();

    if (dbError) {
      errors.push(`${file.name}: failed to save record`);
      continue;
    }

    uploaded.push(asset);

    if (mediaType === "photo") {
      const { data: project } = await supabase
        .from("projects")
        .select("cover_image_id")
        .eq("id", projectId)
        .single();

      if (!project?.cover_image_id) {
        await supabase.from("projects").update({ cover_image_id: asset.id }).eq("id", projectId);
      }
    }
  }

  if (uploaded.length > 0) {
    const count = uploaded.length;
    const activityType =
      mediaType === "photo"
        ? "photos_uploaded"
        : mediaType === "video"
          ? "videos_uploaded"
          : "documents_uploaded";
    const label =
      mediaType === "photo"
        ? `${count} photo${count > 1 ? "s" : ""} uploaded`
        : mediaType === "video"
          ? `${count} video${count > 1 ? "s" : ""} uploaded`
          : `${count} document${count > 1 ? "s" : ""} uploaded`;

    await logProjectActivity(activityType, label, {
      projectId,
      metadata: { count, mediaType },
    });

    await notifyProjectClients({
      type: "deliverables_uploaded",
      title: "New deliverables available",
      body: label,
      link: `/dashboard/projects/${projectId}#deliverables`,
      projectId,
    });
  }

  if (uploaded.length === 0 && errors.length > 0) {
    return NextResponse.json(
      { error: errors.join("; "), errors, uploaded: [] },
      { status: 400 }
    );
  }

  return NextResponse.json({ uploaded, errors });
}
