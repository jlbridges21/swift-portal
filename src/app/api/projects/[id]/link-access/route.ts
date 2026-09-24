import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getProjectLinkAccessState, setProjectLinkAccessMode, type ProjectLinkAccessMode } from "@/lib/project-link-access";
import { canAccessProject } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getProfile();
    if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.anyone_with_link"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { id: projectId } = await params;
    if (!(await canAccessProject(profile, projectId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const state = await getProjectLinkAccessState(tenant.businessId, projectId);
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
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
    const body = (await request.json()) as { mode?: ProjectLinkAccessMode };
    if (body.mode !== "restricted" && body.mode !== "anyone_with_link") {
      return NextResponse.json({ error: "mode must be restricted or anyone_with_link" }, { status: 400 });
    }
    const result = await setProjectLinkAccessMode(tenant.businessId, projectId, body.mode, profile);
    const state = await getProjectLinkAccessState(tenant.businessId, projectId);
    return NextResponse.json({ ...result, ...state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update link access.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
