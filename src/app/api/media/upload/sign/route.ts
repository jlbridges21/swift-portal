import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { FILE_SIZE_LIMITS, formatFileSize } from "@/lib/brand";
import {
  buildMediaStoragePath,
  validateMediaFile,
} from "@/lib/media-upload";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { projectId, fileName, mimeType, fileSize, mediaType } = body;

  if (!projectId || !fileName || !mediaType || fileSize == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sizeLimit =
    mediaType === "photo"
      ? FILE_SIZE_LIMITS.photo
      : mediaType === "video"
        ? FILE_SIZE_LIMITS.video
        : FILE_SIZE_LIMITS.document;

  const validation = validateMediaFile(
    { name: fileName, type: mimeType || "", size: fileSize },
    mediaType,
    sizeLimit
  );

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const bucket = mediaType === "document" ? "project-documents" : "project-media";
  const filePath = buildMediaStoragePath(projectId, fileName);

  const { data: existing } = await supabase
    .from("media_assets")
    .select("display_order")
    .eq("project_id", projectId)
    .eq("media_type", mediaType)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayOrder = (existing?.display_order ?? -1) + 1;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create upload URL" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    filePath,
    bucket,
    displayOrder,
    mimeType: validation.mimeType,
  });
}
