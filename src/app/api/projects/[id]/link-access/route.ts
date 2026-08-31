import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { requireBusinessAdmin, requireTenantContext } from "@/lib/tenant";
import { getProjectLinkAccessState, setProjectLinkAccessMode, type ProjectLinkAccessMode } from "@/lib/project-link-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getProfile();
    const tenant = await requireBusinessAdmin();
    const { id: projectId } = await params;
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
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await requireBusinessAdmin();
    const { id: projectId } = await params;
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
