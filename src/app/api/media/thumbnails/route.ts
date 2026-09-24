import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { isClientVisibleMedia } from "@/lib/client-media";
import { assertMediaAssetProjectAccess } from "@/lib/media-asset-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { signMediaThumbnailUrl, type ThumbSignAsset } from "@/lib/media-signed-thumbs";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";

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
  const isTeam = isOwnerAdmin(profile) || staffCan(profile, "area.media");

  const projectIds = [
    ...new Set(
      [...byId.values()]
        .map((a) => a.project_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const sectionByProject = new Map<
    string,
    ReturnType<typeof import("@/lib/project-media-sections").mediaSectionsFromProject>
  >();
  if (projectIds.length && !isTeam) {
    const { data: projects } = await db
      .from("projects")
      .select(
        "id, client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
      )
      .in("id", projectIds);
    const { mediaSectionsFromProject } = await import("@/lib/project-media-sections");
    for (const p of projects ?? []) {
      sectionByProject.set(p.id as string, mediaSectionsFromProject(p));
    }
  }
  const { clientMayAccessMediaSection, DEFAULT_PROJECT_MEDIA_SECTIONS } = await import(
    "@/lib/project-media-sections"
  );

  for (const id of ids) {
    const asset = byId.get(id);
    if (!asset || asset.business_id !== tenant.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const access = await assertMediaAssetProjectAccess(profile, tenant, asset);
    if (!access.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isTeam) {
      if (!isClientVisibleMedia(asset)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const sections =
        (asset.project_id && sectionByProject.get(asset.project_id as string)) ||
        DEFAULT_PROJECT_MEDIA_SECTIONS;
      if (!clientMayAccessMediaSection(sections, asset.media_type, false)) {
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
