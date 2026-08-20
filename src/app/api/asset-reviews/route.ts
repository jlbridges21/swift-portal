import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";
import { setProjectStatus } from "@/lib/status-automation";
import { notifyAdmins } from "@/lib/notifications";
import { getAppSettings } from "@/lib/app-settings";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { portalLink, resolveProjectMessageTemplate } from "@/lib/workflow";
import { canAccessProject } from "@/lib/project-access";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("project_id");
  if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const supabase = await createClient();
  let query = supabase
    .from("asset_reviews")
    .select("*")
    .eq("project_id", projectId);
  if (profile.business_id) {
    query = query.eq("business_id", profile.business_id);
  }
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

async function checkAllApproved(businessId: string, projectId: string) {
  const db = await createTenantServiceClient(businessId);

  const [{ data: media }, { data: tours }, { data: reviews }] = await Promise.all([
    db.from("media_assets").select("id, media_type").eq("project_id", projectId),
    db.from("tours").select("id").eq("project_id", projectId),
    db.from("asset_reviews").select("*").eq("project_id", projectId),
  ]);

  const assets: { type: string; id: string }[] = [];
  media?.forEach((m) => assets.push({ type: m.media_type, id: m.id }));
  tours?.forEach((t) => assets.push({ type: "tour", id: t.id }));

  if (assets.length === 0) return false;

  const reviewMap = new Map(reviews?.map((r) => [`${r.asset_type}:${r.asset_id}`, r.status]));

  return assets.every((a) => reviewMap.get(`${a.type}:${a.id}`) === "approved");
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !profile.client_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const body = await request.json();
  const { project_id, asset_type, asset_id, status, feedback } = body;

  if (!project_id || !asset_type || !asset_id || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const hasAccess = await canAccessProject(profile, project_id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  const { data: review, error } = await db
    .from("asset_reviews")
    .upsert(
      {
        project_id,
        asset_type,
        asset_id,
        status,
        feedback: feedback || null,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "project_id,asset_type,asset_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actionLabel = status === "approved" ? "approved" : "flagged for changes";
  await logProjectActivity("asset_reviewed", `Deliverable ${actionLabel}`, {
    businessId: tenant.businessId,
    projectId: project_id,
    userId: profile.id,
    idempotencyKey: idempotencyKey("asset_review", project_id, asset_type, asset_id, status),
    metadata: { asset_type, asset_id, status },
  });

  if (status === "rejected") {
    await setProjectStatus({
      projectId: project_id,
      status: "ready_for_review",
      userId: profile.id,
      activityDescription: "Deliverable feedback submitted — returned to review",
      skipIfSame: true,
    });

    await notifyAdmins({
      businessId: tenant.businessId,
      type: "revision_requested",
      eventKey: "revision_requested",
      title: "Deliverable feedback",
      body: feedback || "A client flagged a deliverable for changes.",
      link: `/admin/projects/${project_id}`,
      projectId: project_id,
    });
  } else {
    const allApproved = await checkAllApproved(tenant.businessId, project_id);
    if (allApproved) {
      const { data: project } = await db
        .from("projects")
        .select("deliverables_approved_at")
        .eq("id", project_id)
        .single();

      if (!project?.deliverables_approved_at) {
        await setProjectStatus({
          projectId: project_id,
          status: "awaiting_payment",
          userId: profile.id,
          activityType: "deliverables_approved",
          activityDescription: "All deliverables approved",
          notifyAdmin: true,
          notifyClient: true,
          clientTitle: "Final Payment",
          clientBody: "Thank you! Complete your final payment to unlock all downloads.",
          link: `/dashboard/projects/${project_id}#payments`,
          idempotencyKey: idempotencyKey("project", project_id, "deliverables_approved"),
        });

        await db
          .from("projects")
          .update({
            deliverables_approved_at: new Date().toISOString(),
            deliverables_approved_by: profile.id,
          })
          .eq("id", project_id);
      }
    }
  }

  return NextResponse.json(review);
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, action } = body;

  if (!project_id || action !== "send_for_review") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const db = await createTenantServiceClient(tenant.businessId);
  const appSettings = await getAppSettings(tenant.businessId);
  const { data: project } = await db
    .from("projects")
    .select("status")
    .eq("id", project_id)
    .single();

  if (project?.status === "ready_for_review") {
    return NextResponse.json({ success: true, alreadySent: true });
  }

  await setProjectStatus({
    projectId: project_id,
    status: "ready_for_review",
    userId: profile.id,
    activityType: "sent_for_review",
    activityDescription: "Deliverables sent for client review",
    notifyClient: appSettings.workflow.deliverables.notifyClientWhenReady,
    clientTitle: "Review Your Deliverables",
    clientBody: await resolveProjectMessageTemplate(
      appSettings.workflow,
      "deliverables_ready",
      project_id,
      { portal_link: await portalLink(`/dashboard/projects/${project_id}#deliverables`, tenant.businessId) },
      "Preview your photos, videos, and tours. Approve each item when you're satisfied."
    ),
    link: `/dashboard/projects/${project_id}#deliverables`,
    idempotencyKey: idempotencyKey("project", project_id, "send_for_review"),
    manualOverride: true,
    clientEventKey: "deliverables_ready",
  });

  await db
    .from("projects")
    .update({ deliverables_approved_at: null, deliverables_approved_by: null })
    .eq("id", project_id);

  return NextResponse.json({ success: true });
}
