import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdminApi } from "@/lib/api-auth";
import { logProjectActivity } from "@/lib/activity";
import { notifyProjectClients } from "@/lib/notifications";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { normalizeExternal3dUrl } from "@/lib/external-3d-models";
import { sanitizePlainText } from "@/lib/landing-content";

export async function POST(request: Request) {
  const auth = await requireAdminApi({ permission: 'media.upload' });
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = await request.json();
  const title = sanitizePlainText(body.title, 200);
  const description = sanitizePlainText(body.description ?? "", 2000) || null;

  if (!body.project_id || !title || !body.embed_url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { canAccessProject } = await import("@/lib/project-access");
  if (!(await canAccessProject(auth.profile, body.project_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const normalized = normalizeExternal3dUrl(body.embed_url);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  const { data: maxOrder } = await db
    .from("project_3d_models")
    .select("display_order")
    .eq("project_id", body.project_id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("project_3d_models")
    .insert({
      project_id: body.project_id,
      title,
      embed_url: normalized.embedUrl,
      provider: normalized.provider,
      description,
      display_order: (maxOrder?.display_order ?? -1) + 1,
      client_visible: body.client_visible !== false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logProjectActivity("model_added", `3D model added: ${title}`, {
    businessId: tenant.businessId,
    projectId: body.project_id,
    metadata: { modelId: data.id, provider: normalized.provider },
  });

  await notifyProjectClients({
    type: "deliverables_uploaded",
    eventKey: "deliverables_ready",
    title: "Media in Production",
    body: `A 3D model "${title}" has been added to your project.`,
    link: `/dashboard/projects/${body.project_id}`,
    projectId: body.project_id,
  });

  return NextResponse.json({ ...data, normalizeMessage: normalized.message });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi({ permission: 'media.organize' });
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = await request.json();
  const { id, ...rest } = body;

  if (!id) {
    return NextResponse.json({ error: "Model id required" }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);
  const { data: existing } = await db
    .from("project_3d_models")
    .select("id, project_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing?.project_id) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }
  const { canAccessProject } = await import("@/lib/project-access");
  if (!(await canAccessProject(auth.profile, existing.project_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof rest.title === "string") {
    updates.title = sanitizePlainText(rest.title, 200);
  }
  if ("description" in rest) {
    updates.description = sanitizePlainText(rest.description ?? "", 2000) || null;
  }
  if (typeof rest.display_order === "number") {
    updates.display_order = rest.display_order;
  }
  if (typeof rest.client_visible === "boolean") {
    updates.client_visible = rest.client_visible;
  }
  if (typeof rest.embed_url === "string") {
    const normalized = normalizeExternal3dUrl(rest.embed_url);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    updates.embed_url = normalized.embedUrl;
    updates.provider = normalized.provider;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await db
    .from("project_3d_models")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi({ permission: 'media.delete' });
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const projectId = searchParams.get("project_id");

  if (!id || !projectId) {
    return NextResponse.json({ error: "id and project_id are required" }, { status: 400 });
  }

  const { canAccessProject } = await import("@/lib/project-access");
  if (!(await canAccessProject(auth.profile, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  const { data: model, error: lookupError } = await db
    .from("project_3d_models")
    .select("id, project_id, title")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  if (model.project_id !== projectId) {
    return NextResponse.json({ error: "Model does not belong to this project" }, { status: 400 });
  }

  const { error } = await db
    .from("project_3d_models")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_id: id });
}
