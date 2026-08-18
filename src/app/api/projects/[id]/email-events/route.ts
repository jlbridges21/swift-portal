import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getProjectEmailEvents, buildEmailCommunicationSummaries } from "@/lib/email-analytics";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { id } = await params;
    const events = await getProjectEmailEvents(id, tenant.businessId);
    return NextResponse.json({ groups: buildEmailCommunicationSummaries(events) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
