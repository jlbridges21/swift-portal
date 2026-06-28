import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canDownloadDeliverables } from "@/lib/deliverables";
import { canAccessProject } from "@/lib/project-access";
import { isClientVisibleMedia } from "@/lib/client-media";
import { logMediaEvent, trackMediaDownload } from "@/lib/media-library";
import { normalizeStatus } from "@/lib/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const thumb = searchParams.get("thumb") === "1";
  const asFile = searchParams.get("file") === "1";
  const inline = searchParams.get("inline") === "1";
  const preview = searchParams.get("preview") === "1";

  const supabase = await createClient();

  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (assetError || !asset) {
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
    const { data: project } = await supabase
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
  const storageClient = isAdmin ? await createServiceClient() : supabase;

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
      mediaAssetId: id,
      userId: profile.id,
      email: profile.email,
      ipAddress: ip,
    });
    void logMediaEvent({
      mediaAssetId: id,
      projectId: asset.project_id,
      userId: profile.id,
      eventType: "downloaded",
      description: `Downloaded ${asset.file_name}`,
      metadata: { by: profile.email },
    });

    const disposition = inline ? "inline" : "attachment";
    const mimeType = asset.mime_type || "application/octet-stream";

    return new NextResponse(fileData, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(asset.file_name)}"`,
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

  if (thumb && asset.thumbnail_url) {
    const { data: thumbData, error: thumbError } = await storageClient.storage
      .from(bucket)
      .createSignedUrl(asset.thumbnail_url, 3600);
    if (!thumbError && thumbData?.signedUrl) {
      return NextResponse.json({
        url: thumbData.signedUrl,
        preview: true,
        downloadsAllowed,
      });
    }
  }

  const options =
    thumb || forcePreview
      ? asset.media_type === "photo"
        ? { transform: { width: 1200, height: 1200, resize: "contain" as const } }
        : undefined
      : undefined;

  if (thumb && asset.media_type !== "photo") {
    return NextResponse.json({
      url: null,
      preview: true,
      downloadsAllowed,
      mediaType: asset.media_type,
    });
  }

  const { data, error } = await storageClient.storage
    .from(bucket)
    .createSignedUrl(asset.file_path, 3600, options);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate preview URL" }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    preview: forcePreview,
    downloadsAllowed,
  });
}
