import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getProjectLinkAccessState, rotateProjectLinkToken } from "@/lib/project-link-access";
import { canAccessProject } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getProfile();
    if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.anyone_with_link"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { id: projectId } = await params;
    if (!(await canAccessProject(profile, projectId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const result = await rotateProjectLinkToken(tenant.businessId, projectId, profile);
    const state = await getProjectLinkAccessState(tenant.businessId, projectId);
    return NextResponse.json({ ...result, ...state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not rotate link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
