import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { canAccessProject } from "@/lib/project-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const supabase = await createClient();

  let query = supabase
    .from("revisions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (profile.business_id) {
    query = query.eq("business_id", profile.business_id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !profile.client_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const businessId = tenant.businessId;

  const body = await request.json();

  if (!body.project_id || !body.description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hasAccess = await canAccessProject(profile, body.project_id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
  }

  const db = await createTenantServiceClient(businessId);

  const { data, error } = await db
    .from("revisions")
    .insert({
      project_id: body.project_id,
      client_id: profile.client_id,
      description: body.description,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db
    .from("projects")
    .update({ deliverables_approved_at: null, deliverables_approved_by: null })
    .eq("id", body.project_id);

  await logProjectActivity("revision_requested", "Revision requested", {
    businessId,
    projectId: body.project_id,
    userId: profile.id,
    idempotencyKey: idempotencyKey("revision", data.id, "requested"),
    metadata: { revisionId: data.id },
  });

  await notifyAdmins({
    businessId,
    type: "revision_requested",
    eventKey: "revision_requested",
    title: "Revision Requested",
    body: body.description.slice(0, 160),
    link: `/admin/projects/${body.project_id}#activity`,
    projectId: body.project_id,
  });

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const businessId = tenant.businessId;
  const appSettings = await getAppSettings(businessId);

  const body = await request.json();
  const { id, status, admin_notes } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  const db = await createTenantServiceClient(businessId);

  const { data, error } = await db
    .from("revisions")
    .update({ status, admin_notes: admin_notes ?? null })
    .eq("id", id)
    .select("*, project_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (status === "completed") {
    await logProjectActivity("revision_completed", "Revision completed", {
      businessId,
      projectId: data.project_id,
      userId: profile.id,
      metadata: { revisionId: id },
    });
  }

  const clientMessages: Record<string, { title: string; body: string }> = {
    in_progress: {
      title: "We're working on your revision",
      body: admin_notes || `${appSettings.business.businessName} is addressing your revision request.`,
    },
    completed: {
      title: "Your revision is complete",
      body: admin_notes || "We've completed your revision request. Check your project for updates.",
    },
    pending: {
      title: "Revision request received",
      body: admin_notes || "We've received your revision request and will get started soon.",
    },
  };
  const msg = clientMessages[status] ?? {
    title: "Update on your revision request",
    body: admin_notes || "Your revision request has been updated.",
  };

  await notifyProjectClients({
    businessId,
    type: "revision_requested",
    eventKey: status === "completed" ? "revision_completed" : undefined,
    title: msg.title,
    body: msg.body,
    link: `/dashboard/projects/${data.project_id}#activity`,
    projectId: data.project_id,
  });

  return NextResponse.json(data);
}
