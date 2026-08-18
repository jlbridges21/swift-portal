import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdminApi } from "@/lib/api-auth";
import { formatFileSize } from "@/lib/brand";
import { buildMediaStoragePath } from "@/lib/media-upload";
import { validateMediaFileBeforeUpload } from "@/lib/upload/validation";
import { MAX_VIDEO_FILE_SIZE_BYTES, shouldUseTusUpload } from "@/lib/upload/constants";
import { logUploadStep } from "@/lib/upload/logger";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  try {
    const body = await request.json();
    const { projectId, fileName, mimeType, fileSize, mediaType } = body;

    if (!fileName || !mediaType || fileSize == null) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const validation = validateMediaFileBeforeUpload(
      { name: fileName, type: mimeType || "", size: fileSize } as File,
      mediaType as "photo" | "video" | "document"
    );

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const db = await createTenantServiceClient(tenant.businessId);

    // Signed URLs are bearer capabilities: verify the project belongs to this
    // business before minting. Unassigned library uploads have no project —
    // tenant context is the ownership check.
    if (projectId) {
      const { data: project } = await db
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .maybeSingle();
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const bucket = mediaType === "document" ? "project-documents" : "project-media";
    const storageProjectId = projectId || null;
    const filePath = buildMediaStoragePath(storageProjectId, fileName);

    let displayOrder = 0;
    if (projectId) {
      const { data: existing } = await db
        .from("media_assets")
        .select("display_order")
        .eq("project_id", projectId)
        .eq("media_type", mediaType)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      displayOrder = (existing?.display_order ?? -1) + 1;
    } else {
      const { count } = await db
        .from("media_assets")
        .select("id", { count: "exact", head: true })
        .is("project_id", null);
      displayOrder = count ?? 0;
    }

    const useTus = shouldUseTusUpload(fileSize);

    // TUS resumable uploads must NOT call createSignedUploadUrl — it can reserve the path
    // and break large video uploads. Only sign a PUT URL for smaller direct uploads.
    let signedUrl: string | undefined;
    let token: string | undefined;

    if (!useTus) {
      const { data, error } = await db.raw.storage.from(bucket).createSignedUploadUrl(filePath);
      if (error || !data) {
        console.error("[upload/sign]", error?.message);
        return NextResponse.json(
          { error: "Could not prepare storage upload. Check bucket configuration." },
          { status: 500 }
        );
      }
      signedUrl = data.signedUrl;
      token = data.token;
    }

    logUploadStep("info", {
      step: "sign_prepared",
      projectId: projectId ?? undefined,
      fileName,
      fileSize,
      fileType: validation.mimeType,
      filePath,
      details: { resumable: useTus, unassigned: !projectId, bucket },
    });

    return NextResponse.json({
      signedUrl,
      token,
      filePath,
      bucket,
      displayOrder,
      mimeType: validation.mimeType,
      resumable: useTus,
      maxSizeLabel: mediaType === "video" ? formatFileSize(MAX_VIDEO_FILE_SIZE_BYTES) : undefined,
    });
  } catch (err) {
    console.error("[upload/sign]", err);
    return NextResponse.json({ error: "Failed to prepare upload." }, { status: 500 });
  }
}
