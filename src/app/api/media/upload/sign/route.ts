import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import {
  ALLOWED_PHOTO_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_DOCUMENT_TYPES,
} from "@/lib/constants";
import { FILE_SIZE_LIMITS, formatFileSize } from "@/lib/brand";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { projectId, fileName, mimeType, fileSize, mediaType } = body;

  if (!projectId || !fileName || !mimeType || !mediaType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const allowedTypes =
    mediaType === "photo"
      ? ALLOWED_PHOTO_TYPES
      : mediaType === "video"
        ? ALLOWED_VIDEO_TYPES
        : ALLOWED_DOCUMENT_TYPES;

  if (!allowedTypes.includes(mimeType)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const sizeLimit =
    mediaType === "photo"
      ? FILE_SIZE_LIMITS.photo
      : mediaType === "video"
        ? FILE_SIZE_LIMITS.video
        : FILE_SIZE_LIMITS.document;

  if (fileSize > sizeLimit) {
    return NextResponse.json(
      { error: `File exceeds ${formatFileSize(sizeLimit)} limit` },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();
  const bucket = mediaType === "document" ? "project-documents" : "project-media";
  const filePath = `${projectId}/${Date.now()}-${fileName}`;

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
  });
}
