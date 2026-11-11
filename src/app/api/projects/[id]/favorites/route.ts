import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { resolveAssignedClientId, resolveProjectAccess } from "@/lib/project-access";
import { canAccessProject, isOwnerAdmin } from "@/lib/staff-access";
import { isClientVisibleMedia } from "@/lib/client-media";
import { mediaSectionsFromProject } from "@/lib/project-media-sections";
import {
  listClientFavoriteIds,
  listProjectClientFavorites,
  setClientFavorite,
} from "@/lib/client-favorites";

/**
 * Client photo favorites for one project.
 *
 * GET   business (owner/admin/assigned staff): every client's likes, read-only.
 *       assigned client: their own liked photo ids.
 * POST  assigned client only — { media_asset_id, favorite: boolean }. Business users and
 *       share viewers can never add or remove a client's like.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const { id: projectId } = await params;

  if (isOwnerAdmin(profile) || profile.role === "staff") {
    if (profile.role === "staff" && !(await canAccessProject(tenant.businessId, profile, projectId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { available, rows } = await listProjectClientFavorites(tenant.businessId, projectId);
    return NextResponse.json({ available, favorites: rows });
  }

  const access = await resolveProjectAccess(profile, projectId, { tenantBusinessId: tenant.businessId });
  if (!access.allowed || access.kind !== "assigned_client") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const clientId = await resolveAssignedClientId(profile, projectId);
  if (!clientId) return NextResponse.json({ available: true, ids: [] });
  const { available, ids } = await listClientFavoriteIds(tenant.businessId, projectId, clientId);
  return NextResponse.json({ available, ids });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const { id: projectId } = await params;

  let body: { media_asset_id?: unknown; favorite?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const mediaAssetId = typeof body.media_asset_id === "string" ? body.media_asset_id : null;
  if (!mediaAssetId || typeof body.favorite !== "boolean") {
    return NextResponse.json({ error: "media_asset_id and favorite are required" }, { status: 400 });
  }

  // Only the project's own clients like photos — never the business, staff or share viewers.
  const access = await resolveProjectAccess(profile, projectId, { tenantBusinessId: tenant.businessId });
  if (!access.allowed || access.kind !== "assigned_client") {
    return NextResponse.json({ error: "Only the project's client can favorite photos." }, { status: 403 });
  }
  const clientId = await resolveAssignedClientId(profile, projectId);
  if (!clientId) {
    return NextResponse.json({ error: "Only the project's client can favorite photos." }, { status: 403 });
  }

  // The photo must belong to this project and be one the client can actually see.
  const db = await createTenantServiceClient(tenant.businessId);
  const [{ data: asset }, { data: project }] = await Promise.all([
    db.from("media_assets").select("id, project_id, media_type, visibility").eq("id", mediaAssetId).maybeSingle(),
    db.from("projects").select("id, client_section_photos").eq("id", projectId).maybeSingle(),
  ]);
  if (
    !asset ||
    !project ||
    asset.project_id !== projectId ||
    asset.media_type !== "photo" ||
    !isClientVisibleMedia(asset as Parameters<typeof isClientVisibleMedia>[0]) ||
    !mediaSectionsFromProject(project).photos
  ) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const result = await setClientFavorite({
    businessId: tenant.businessId,
    projectId,
    clientId,
    userId: profile.id,
    mediaAssetId,
    favorite: body.favorite,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, media_asset_id: mediaAssetId, favorite: body.favorite });
}
