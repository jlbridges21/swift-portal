import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { canDownloadDeliverables } from "@/lib/deliverables";
import { canAccessProject } from "@/lib/project-access";
import { isClientVisibleMedia } from "@/lib/client-media";
import { logMediaEvent, trackMediaDownload } from "@/lib/media-library";
import { normalizeStatus } from "@/lib/constants";
import { downloadFileName, mediaDisplayName } from "@/lib/media-display-name";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  signMediaThumbnailUrl,
  THUMB_SIGNED_TTL_SECONDS,
} from "@/lib/media-signed-thumbs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const thumb = searchParams.get("thumb") === "1";
  const asFile = searchParams.get("file") === "1";
  const inline = searchParams.get("inline") === "1";
  const preview = searchParams.get("preview") === "1";

  const db = await createTenantServiceClient(tenant.businessId);
  const cookieClient = await createClient();

  const { data: asset, error: assetError } = await db
    .from("media_assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (assetError || !asset) {
    return NextResponse.json({ error: "Media not found or access denied" }, { status: 404 });
  }

  // Signed URLs are bearer capabilities: refuse before minting if the row's
  // business does not match the caller (tenant client already filters; this is
  // the explicit ownership check).
  if (asset.business_id !== tenant.businessId) {
    return NextResponse.json({ error: "Media not found or access denied" }, { status: 404 });
  }

  const isAdmin = profile.role === "admin";

  if (!asset.project_id) {
    if (!isAdmin) {
      return NextResponse.json({ error: "Media not found or access denied" }, { status: 404 });
    }
  } else {
    const hasAccess = await canAccessProject(profile, asset.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Media not found or access denied" }, { status: 404 });
    }
  }

  let projectStatus = "new_request";
  if (asset.project_id) {
    const { data: project } = await db
      .from("projects")
      .select("status")
      .eq("id", asset.project_id)
      .maybeSingle();
    projectStatus = normalizeStatus(project?.status ?? "new_request");
  }
  if (!isAdmin && !isClientVisibleMedia(asset)) {
    return NextResponse.json({ error: "This file is not available." }, { status: 404 });
  }

  const downloadsAllowed = isAdmin || canDownloadDeliverables(projectStatus);

  if (asset.media_source === "youtube") {
    return NextResponse.json({ url: asset.embed_url });
  }

  const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
  const storageClient = isAdmin ? db.raw : cookieClient;

  if (asFile && !downloadsAllowed) {
    return NextResponse.json(
      { error: "Downloads unlock after your final payment is complete." },
      { status: 403 }
    );
  }

  if (asFile) {
    const { data: fileData, error: downloadError } = await storageClient.storage
      .from(bucket)
      .download(asset.file_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "We couldn't download that file. Please try again or contact support." }, { status: 500 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    void trackMediaDownload({
      businessId: tenant.businessId,
      mediaAssetId: id,
      userId: profile.id,
      email: profile.email,
      ipAddress: ip,
    });
    void logMediaEvent({
      businessId: tenant.businessId,
      mediaAssetId: id,
      projectId: asset.project_id,
      userId: profile.id,
      eventType: "downloaded",
      description: `Downloaded ${mediaDisplayName(asset)}`,
      metadata: { by: profile.email },
    });

    const disposition = inline ? "inline" : "attachment";
    const mimeType = asset.mime_type || "application/octet-stream";
    const filename = downloadFileName(asset);

    return new NextResponse(fileData, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const forcePreview = preview || (!downloadsAllowed && !isAdmin);

  if (thumb && asset.media_type === "video") {
    return NextResponse.json({
      url: null,
      preview: true,
      downloadsAllowed,
      mediaType: "video",
    });
  }

  if (thumb) {
    if (asset.media_type !== "photo") {
      return NextResponse.json({
        url: null,
        preview: true,
        downloadsAllowed,
        mediaType: asset.media_type,
      });
    }

    const signed = await signMediaThumbnailUrl(storageClient, bucket, asset);
    if (!signed) {
      return NextResponse.json({ error: "Failed to generate preview URL" }, { status: 500 });
    }
    return NextResponse.json({
      url: signed,
      preview: true,
      downloadsAllowed,
    });
  }

  // Full / preview (non-thumb): keep a moderate transform only for locked client preview.
  const options = forcePreview
    ? asset.media_type === "photo"
      ? { transform: { width: 1200, height: 1200, resize: "contain" as const } }
      : undefined
    : undefined;

  const { data, error } = await storageClient.storage
    .from(bucket)
    .createSignedUrl(asset.file_path, THUMB_SIGNED_TTL_SECONDS, options);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate preview URL" }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    preview: forcePreview,
    downloadsAllowed,
  });
}
