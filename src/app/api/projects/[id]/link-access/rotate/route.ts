import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { requireBusinessAdmin, requireTenantContext } from "@/lib/tenant";
import { getProjectLinkAccessState, rotateProjectLinkToken } from "@/lib/project-link-access";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await requireBusinessAdmin();
    const { id: projectId } = await params;
    const result = await rotateProjectLinkToken(tenant.businessId, projectId, profile);
    const state = await getProjectLinkAccessState(tenant.businessId, projectId);
    return NextResponse.json({ ...result, ...state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not rotate link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
