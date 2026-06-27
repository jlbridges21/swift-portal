import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { logProjectActivity } from "@/lib/activity";
import { notifyProjectClients } from "@/lib/notifications";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { projectId, filePath, fileName, mimeType, fileSize, mediaType, displayOrder } = body;

  if (!projectId || !filePath || !fileName || !mimeType || !mediaType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const bucket = mediaType === "document" ? "project-documents" : "project-media";

  const { data: stored, error: storageError } = await supabase.storage.from(bucket).download(filePath);
  if (storageError || !stored) {
    console.error("[upload/complete] storage verify failed:", storageError?.message, filePath);
    return NextResponse.json(
      { error: "Upload completed but could not be saved — file not found in storage." },
      { status: 400 }
    );
  }

  const { data: asset, error: dbError } = await supabase
    .from("media_assets")
    .insert({
      project_id: projectId,
      file_name: fileName,
      file_path: filePath,
      file_size: fileSize || null,
      mime_type: mimeType,
      media_type: mediaType,
      media_source: "upload",
      display_order: displayOrder ?? 0,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

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

  return NextResponse.json(asset);
}
