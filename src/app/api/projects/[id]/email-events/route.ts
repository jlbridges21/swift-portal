import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getProjectEmailEvents, buildEmailCommunicationSummaries } from "@/lib/email-analytics";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const profile = await requireAdmin({ area: 'projects' });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { id } = await params;
    const { canAccessProject } = await import("@/lib/project-access");
    if (!(await canAccessProject(profile, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = await createTenantServiceClient(tenant.businessId);
    const { data: project } = await db.from("projects").select("id").eq("id", id).maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const events = await getProjectEmailEvents(id, tenant.businessId);
    return NextResponse.json({ groups: buildEmailCommunicationSummaries(events) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
