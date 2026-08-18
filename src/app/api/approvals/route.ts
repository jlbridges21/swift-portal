import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";
import { notifyAdmins } from "@/lib/notifications";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !profile.client_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const businessId = tenant.businessId;

  const body = await request.json();
  if (!body.project_id) {
    return NextResponse.json({ error: "Project required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("deliverables_approved_at")
    .eq("id", body.project_id)
    .eq("business_id", businessId)
    .single();

  if (project?.deliverables_approved_at) {
    return NextResponse.json({ success: true, alreadyApproved: true });
  }

  const { error } = await supabase
    .from("projects")
    .update({
      deliverables_approved_at: new Date().toISOString(),
      deliverables_approved_by: profile.id,
    })
    .eq("id", body.project_id)
    .eq("business_id", businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logProjectActivity("deliverables_approved", "Deliverables approved by client", {
    businessId,
    projectId: body.project_id,
    userId: profile.id,
    idempotencyKey: idempotencyKey("project", body.project_id, "deliverables_approved"),
  });

  await notifyAdmins({
    businessId,
    type: "status_changed",
    title: "Deliverables Approved",
    body: "A client approved their deliverables.",
    link: `/admin/projects/${body.project_id}`,
    projectId: body.project_id,
  });

  return NextResponse.json({ success: true });
}
