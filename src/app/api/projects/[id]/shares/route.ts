import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { requireBusinessAdmin, requireTenantContext } from "@/lib/tenant";
import { listProjectShares } from "@/lib/project-shares";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getProfile();
    const tenant = await requireBusinessAdmin();
    const { id: projectId } = await params;
    const shares = await listProjectShares(tenant.businessId, projectId);
    return NextResponse.json({ shares });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenant = await requireBusinessAdmin();
    const { id: projectId } = await params;
    const body = (await request.json()) as {
      emails?: string[];
      email?: string;
      notify?: boolean;
    };
    const emails = Array.isArray(body.emails)
      ? body.emails
      : typeof body.email === "string"
        ? [body.email]
        : [];
    const notify = body.notify !== false;

    const { createServiceClient } = await import("@/lib/supabase/server");
    const raw = await createServiceClient();
    const { data: project } = await raw
      .from("projects")
      .select("id, project_name")
      .eq("id", projectId)
      .eq("business_id", tenant.businessId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const { addProjectShare } = await import("@/lib/project-shares");
    const results = [];
    for (const rawEmail of emails) {
      const result = await addProjectShare({
        businessId: tenant.businessId,
        projectId,
        email: rawEmail,
        invitedBy: profile.id,
        notify,
        projectName: project.project_name,
        inviterName: profile.full_name || profile.email,
      });
      results.push(result);
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add share.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
