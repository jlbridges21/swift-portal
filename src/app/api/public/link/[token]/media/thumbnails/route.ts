import { NextResponse } from "next/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { isClientVisibleMedia } from "@/lib/client-media";
import { PUBLIC_LINK_CACHE_HEADERS, requirePublicLinkContext } from "@/lib/public-link-api";
import { PUBLIC_LINK_SIGNED_TTL_SECONDS } from "@/lib/project-link-access";
import { signMediaThumbnailUrl, type ThumbSignAsset } from "@/lib/media-signed-thumbs";
import type { MediaAsset } from "@/lib/types";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const host = await getPublicHostContext();
  const gate = await requirePublicLinkContext(request, token, host.businessId);
  if ("error" in gate && gate.error) return gate.error;
  const { ctx } = gate;

  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 48) : [];
  if (!ids.length) {
    return NextResponse.json({ urls: {} }, { headers: PUBLIC_LINK_CACHE_HEADERS });
  }

  const db = await createTenantServiceClient(ctx.businessId);
  const { data: assets } = await db
    .from("media_assets")
    .select("id, file_path, thumbnail_url, media_type, media_source, mime_type, file_name, file_size, business_id, project_id")
    .eq("project_id", ctx.projectId)
    .in("id", ids);

  const urls: Record<string, string | null> = {};
  for (const id of ids) {
    const asset = assets?.find((a) => a.id === id);
    if (!asset || asset.project_id !== ctx.projectId || !isClientVisibleMedia(asset as MediaAsset)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
    urls[id] = await signMediaThumbnailUrl(
      db.raw,
      bucket,
      asset as ThumbSignAsset,
      PUBLIC_LINK_SIGNED_TTL_SECONDS
    );
  }

  return NextResponse.json({ urls }, { headers: PUBLIC_LINK_CACHE_HEADERS });
}
