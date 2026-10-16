import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { canAccessProject } from "@/lib/staff-access";
import { photoSharePermissions } from "@/lib/media-share-api";
import { getProjectPhotoShareSummary } from "@/lib/media-shares";

export const dynamic = "force-dynamic";

/** Live individual-photo share counts for a project's photos (grid badges). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = photoSharePermissions(profile);
  if (!perms.email && !perms.link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const { id: projectId } = await params;
  if (!(await canAccessProject(tenant.businessId, profile, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const summary = await getProjectPhotoShareSummary(tenant.businessId, projectId);
  return NextResponse.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
}
