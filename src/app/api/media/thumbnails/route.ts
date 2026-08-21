import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { isClientVisibleMedia } from "@/lib/client-media";
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
    return NextResponse.json({ urls: {} });
  }

  const db = await createTenantServiceClient(tenant.businessId);
  const cookieClient = await createClient();
  const isAdmin = profile.role === "admin";
  const storageClient = isAdmin ? db.raw : cookieClient;

  const { data: rows, error } = await db
    .from("media_assets")
    .select(
      "id, file_path, thumbnail_url, media_type, media_source, mime_type, file_name, file_size, business_id, project_id, visibility, client_visible"
    )
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 });
  }

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const urls: Record<string, string | null> = {};

  // Project access cache for clients
  const projectAccess = new Map<string, boolean>();

  await Promise.all(
    ids.map(async (id) => {
      const asset = byId.get(id);
      if (!asset || asset.business_id !== tenant.businessId) {
        urls[id] = null;
        return;
      }

      if (!isAdmin) {
        if (!asset.project_id) {
          urls[id] = null;
          return;
        }
        let allowed = projectAccess.get(asset.project_id);
        if (allowed === undefined) {
          allowed = await canAccessProject(profile, asset.project_id);
          projectAccess.set(asset.project_id, allowed);
        }
        if (!allowed || !isClientVisibleMedia(asset)) {
          urls[id] = null;
          return;
        }
      } else if (asset.project_id) {
        // Admin: still scoped by tenant client; no extra project check needed
      }

      const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
      const signed = await signMediaThumbnailUrl(
        storageClient,
        bucket,
        asset as ThumbSignAsset
      );
      urls[id] = signed;
    })
  );

  return NextResponse.json({ urls });
}
