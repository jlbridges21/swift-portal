import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { isClientVisibleMedia } from "@/lib/client-media";
import { assertMediaAssetProjectAccess } from "@/lib/media-asset-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { signMediaThumbnailUrl, type ThumbSignAsset } from "@/lib/media-signed-thumbs";

const BATCH_MAX = 48;

/**
 * Batch-sign thumbnail URLs for a page of visible assets.
 * POST { ids: string[] } → { urls: Record<id, string | null> }
 */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const body = await request.json().catch(() => ({}));
  const rawIds = Array.isArray(body.ids) ? (body.ids as unknown[]) : [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawIds) {
    if (typeof raw !== "string" || !raw || seen.has(raw)) continue;
    seen.add(raw);
    ids.push(raw);
    if (ids.length >= BATCH_MAX) break;
  }

  if (!ids.length) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);
  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  const { data: rows, error } = await db
    .from("media_assets")
    .select(
      "id, file_path, thumbnail_url, media_type, media_source, mime_type, file_name, file_size, business_id, project_id, visibility"
    )
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 });
  }

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));

  if (!isAdmin) {
    for (const id of ids) {
      const asset = byId.get(id);
      if (!asset) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const access = await assertMediaAssetProjectAccess(profile, tenant, asset);
      if (!access.ok || !isClientVisibleMedia(asset)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  } else {
    for (const id of ids) {
      const asset = byId.get(id);
      if (!asset || asset.business_id !== tenant.businessId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  // Storage signing uses service role after access checks — share viewers have no tenant storage JWT.
  const storageClient = db.raw;
  const urls: Record<string, string | null> = {};

  await Promise.all(
    ids.map(async (id) => {
      const asset = byId.get(id)!;
      const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
      urls[id] = await signMediaThumbnailUrl(
        storageClient,
        bucket,
        asset as ThumbSignAsset
      );
    })
  );

  return NextResponse.json({ urls });
}
