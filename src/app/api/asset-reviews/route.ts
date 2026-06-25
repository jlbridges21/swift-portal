import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { setProjectStatus } from "@/lib/status-automation";
import { notifyAdmins } from "@/lib/notifications";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("project_id");
  if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_reviews")
    .select("*")
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

async function checkAllApproved(projectId: string) {
  const supabase = await createServiceClient();

  const [{ data: media }, { data: tours }, { data: reviews }] = await Promise.all([
    supabase.from("media_assets").select("id, media_type").eq("project_id", projectId),
    supabase.from("tours").select("id").eq("project_id", projectId),
    supabase.from("asset_reviews").select("*").eq("project_id", projectId),
  ]);

  const assets: { type: string; id: string }[] = [];
  media?.forEach((m) => assets.push({ type: m.media_type, id: m.id }));
  tours?.forEach((t) => assets.push({ type: "tour", id: t.id }));

  if (assets.length === 0) return false;

  const reviewMap = new Map(reviews?.map((r) => [`${r.asset_type}:${r.asset_id}`, r.status]));

  return assets.every((a) => reviewMap.get(`${a.type}:${a.id}`) === "approved");
}

async function hasRejectedOrPending(projectId: string) {
  const supabase = await createServiceClient();
  const { data: reviews } = await supabase
    .from("asset_reviews")
    .select("status")
    .eq("project_id", projectId);

  return reviews?.some((r) => r.status === "rejected" || r.status === "pending") ?? false;
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !profile.client_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, asset_type, asset_id, status, feedback } = body;

  if (!project_id || !asset_type || !asset_id || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: review, error } = await supabase
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
    projectId: project_id,
    userId: profile.id,
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
      type: "revision_requested",
      title: "Deliverable feedback",
      body: feedback || "A client flagged a deliverable for changes.",
      link: `/admin/projects/${project_id}`,
      projectId: project_id,
    });
  } else {
    const allApproved = await checkAllApproved(project_id);
    if (allApproved) {
      await setProjectStatus({
        projectId: project_id,
        status: "awaiting_payment",
        userId: profile.id,
        activityType: "deliverables_approved",
        activityDescription: "All deliverables approved",
        notifyAdmin: true,
        notifyClient: true,
        clientTitle: "Deliverables approved",
        clientBody: "Thank you! Complete your final payment to unlock all downloads.",
        link: `/dashboard/projects/${project_id}#payments`,
      });

      await supabase
        .from("projects")
        .update({
          deliverables_approved_at: new Date().toISOString(),
          deliverables_approved_by: profile.id,
        })
        .eq("id", project_id);
    }
  }

  return NextResponse.json(review);
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, action } = body;

  if (!project_id || action !== "send_for_review") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await setProjectStatus({
    projectId: project_id,
    status: "ready_for_review",
    userId: profile.id,
    activityType: "sent_for_review",
    activityDescription: "Deliverables sent for client review",
    notifyClient: true,
    clientTitle: "Your deliverables are ready",
    clientBody: "Preview your photos, videos, and tours. Approve each item when you're satisfied.",
    link: `/dashboard/projects/${project_id}#deliverables`,
  });

  const supabase = await createServiceClient();
  await supabase
    .from("projects")
    .update({ deliverables_approved_at: null, deliverables_approved_by: null })
    .eq("id", project_id);

  return NextResponse.json({ success: true });
}
