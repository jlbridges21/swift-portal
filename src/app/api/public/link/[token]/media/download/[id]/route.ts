import { NextResponse } from "next/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import {
  DOWNLOAD_GATE_API_MESSAGE,
  resolveProjectDownloadAllowed,
} from "@/lib/deliverables";
import { getAppSettings } from "@/lib/app-settings";
import { isClientVisibleMedia } from "@/lib/client-media";
import { loadPublicLinkMediaAsset } from "@/lib/load-public-project-view";
import { normalizeStatus } from "@/lib/constants";
import {
  PUBLIC_LINK_CACHE_HEADERS,
  requirePublicLinkContext,
} from "@/lib/public-link-api";
import { PUBLIC_LINK_SIGNED_TTL_SECONDS } from "@/lib/project-link-access";
import { signMediaThumbnailUrl } from "@/lib/media-signed-thumbs";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { serveMediaFileDownload } from "@/lib/serve-media-file-download";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const host = await getPublicHostContext();
  const gate = await requirePublicLinkContext(request, token, host.businessId);
  if ("error" in gate && gate.error) return gate.error;
  const { ctx } = gate;

  const asset = await loadPublicLinkMediaAsset(ctx, id);
  if (!asset || !isClientVisibleMedia(asset)) {
    return NextResponse.json({ error: "Media not found or access denied" }, { status: 404 });
  }

  const db = await createTenantServiceClient(ctx.businessId);
  const { data: project } = await db
    .from("projects")
    .select(
      "status, link_access_mode, client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
    )
    .eq("id", ctx.projectId)
    .maybeSingle();

  if (!project || project.link_access_mode !== "anyone_with_link") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { clientMayAccessMediaSection, mediaSectionsFromProject } = await import(
    "@/lib/project-media-sections"
  );
  if (
    !clientMayAccessMediaSection(
      mediaSectionsFromProject(project),
      asset.media_type,
      false
    )
  ) {
    return NextResponse.json({ error: "Media not found or access denied" }, { status: 404 });
  }

  const appSettings = await getAppSettings(ctx.businessId);
  const projectStatus = normalizeStatus(project.status ?? "new_request");
  const downloadsAllowed = resolveProjectDownloadAllowed({
    projectStatus,
    isAdmin: false,
    requireDeliveredForDownloads: appSettings.payments.requireDeliveredForDownloads,
  });

  const { searchParams } = new URL(request.url);
  const thumb = searchParams.get("thumb") === "1";
  const asFile = searchParams.get("file") === "1";
  const preview = searchParams.get("preview") === "1";

  if (asFile && !downloadsAllowed) {
    return NextResponse.json({ error: DOWNLOAD_GATE_API_MESSAGE }, { status: 403 });
  }

  if (asset.media_source === "youtube") {
    return NextResponse.json({ url: asset.embed_url }, { headers: PUBLIC_LINK_CACHE_HEADERS });
  }

  const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
  const storage = db.raw;

  if (asFile) {
    return serveMediaFileDownload({
      storage,
      bucket,
      asset,
      searchParams,
      extraHeaders: PUBLIC_LINK_CACHE_HEADERS,
    });
  }

  const forcePreview = preview || !downloadsAllowed;

  if (thumb) {
    if (asset.media_type === "document") {
      return NextResponse.json(
        { url: null, preview: true, downloadsAllowed, mediaType: asset.media_type },
        { headers: PUBLIC_LINK_CACHE_HEADERS }
      );
    }

    const signed = await signMediaThumbnailUrl(storage, bucket, asset);
    if (!signed) {
      return NextResponse.json(
        { url: null, preview: true, downloadsAllowed, mediaType: asset.media_type },
        { headers: PUBLIC_LINK_CACHE_HEADERS }
      );
    }
    return NextResponse.json(
      { url: signed, preview: true, downloadsAllowed },
      { headers: PUBLIC_LINK_CACHE_HEADERS }
    );
  }

  const options = forcePreview
    ? asset.media_type === "photo"
      ? { transform: { width: 1200, height: 1200, resize: "contain" as const } }
      : undefined
    : undefined;

  const { data, error } = await storage.storage
    .from(bucket)
    .createSignedUrl(asset.file_path, PUBLIC_LINK_SIGNED_TTL_SECONDS, options);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate preview URL" }, { status: 500 });
  }

  return NextResponse.json(
    { url: data.signedUrl, preview: forcePreview, downloadsAllowed },
    { headers: PUBLIC_LINK_CACHE_HEADERS }
  );
}
