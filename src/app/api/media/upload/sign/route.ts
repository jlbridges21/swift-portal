import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { formatFileSize } from "@/lib/brand";
import { buildMediaStoragePath } from "@/lib/media-upload";
import { validateMediaFileBeforeUpload } from "@/lib/upload/validation";
import { MAX_VIDEO_FILE_SIZE_BYTES } from "@/lib/upload/constants";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { projectId, fileName, mimeType, fileSize, mediaType } = body;

    if (!projectId || !fileName || !mediaType || fileSize == null) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const validation = validateMediaFileBeforeUpload(
      { name: fileName, type: mimeType || "", size: fileSize } as File,
      mediaType as "photo" | "video" | "document"
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

    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error("[upload/sign]", error?.message);
      return NextResponse.json(
        { error: "Could not prepare storage upload. Check bucket configuration." },
        { status: 500 }
      );
    }

    const resumable = mediaType === "video" || fileSize > MAX_VIDEO_FILE_SIZE_BYTES / 10;

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      filePath,
      bucket,
      displayOrder,
      mimeType: validation.mimeType,
      resumable,
      maxSizeLabel: mediaType === "video" ? formatFileSize(MAX_VIDEO_FILE_SIZE_BYTES) : undefined,
    });
  } catch (err) {
    console.error("[upload/sign]", err);
    return NextResponse.json({ error: "Failed to prepare upload." }, { status: 500 });
  }
}
