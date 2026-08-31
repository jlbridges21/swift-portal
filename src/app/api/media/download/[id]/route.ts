import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import {
  DOWNLOAD_GATE_API_MESSAGE,
  resolveProjectDownloadAllowed,
} from "@/lib/deliverables";
import { getAppSettings } from "@/lib/app-settings";
import { touchProjectShareAccess } from "@/lib/project-access";
import { isClientVisibleMedia } from "@/lib/client-media";
import { logMediaEvent, trackMediaDownload } from "@/lib/media-library";
import { normalizeStatus } from "@/lib/constants";
import { downloadFileName, mediaDisplayName } from "@/lib/media-display-name";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { assertMediaAssetProjectAccess } from "@/lib/media-asset-access";
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

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";
  const appSettings = await getAppSettings(tenant.businessId);
  const requireDeliveredForDownloads = appSettings.payments.requireDeliveredForDownloads;

  const mediaAccess = await assertMediaAssetProjectAccess(profile, tenant, asset);
  if (!mediaAccess.ok) {
    return NextResponse.json({ error: mediaAccess.message }, { status: mediaAccess.status });
  }
  const shareIdToTouch = mediaAccess.shareId;

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

  const downloadsAllowed = resolveProjectDownloadAllowed({
    projectStatus,
    isAdmin,
    requireDeliveredForDownloads,
  });

  if (asFile && !downloadsAllowed) {
    return NextResponse.json({ error: DOWNLOAD_GATE_API_MESSAGE }, { status: 403 });
  }

  if (asset.media_source === "youtube") {
    return NextResponse.json({ url: asset.embed_url });
  }

  const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
  // Storage signing uses service role after access checks — share viewers have no tenant storage JWT.
  const storageClient = db.raw;

  const recordShareAccess = () => {
    if (shareIdToTouch) void touchProjectShareAccess(shareIdToTouch);
  };

  if (asFile) {
    const { data: fileData, error: downloadError } = await storageClient.storage
      .from(bucket)
      .download(asset.file_path);

    if (downloadError || !fileData) {
      console.error("[media/download] storage download failed", {
        mediaId: id,
        bucket,
        path: asset.file_path,
        message: downloadError?.message,
      });
      return NextResponse.json({ error: "We couldn't download that file. Please try again or contact support." }, { status: 500 });
    }

    recordShareAccess();

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

  if (thumb) {
    if (asset.media_type === "document") {
      return NextResponse.json({
        url: null,
        preview: true,
        downloadsAllowed,
        mediaType: asset.media_type,
      });
    }

    const signed = await signMediaThumbnailUrl(storageClient, bucket, asset);
    if (!signed) {
      return NextResponse.json({
        url: null,
        preview: true,
        downloadsAllowed,
        mediaType: asset.media_type,
      });
    }
    recordShareAccess();
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
    console.error("[media/download] createSignedUrl failed", {
      mediaId: id,
      bucket,
      path: asset.file_path,
      message: error?.message,
    });
    return NextResponse.json({ error: "Failed to generate preview URL" }, { status: 500 });
  }

  recordShareAccess();
  return NextResponse.json({
    url: data.signedUrl,
    preview: forcePreview,
    downloadsAllowed,
  });
}
