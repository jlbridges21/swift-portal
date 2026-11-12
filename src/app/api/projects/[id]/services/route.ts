import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { canAccessProject } from "@/lib/project-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { logProjectActivity } from "@/lib/activity";
import { listBusinessServices } from "@/lib/business-services";
import {
  loadProjectServiceLinks,
  resolveSelectedServices,
  writeProjectServiceLinks,
} from "@/lib/project-services";
import { formatServiceList, projectServiceNames } from "@/lib/project-service-names";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * A project's linked services (Settings → Services entries).
 *
 * Changing them updates the project's service links, service_type display list
 * and primary service_id ONLY. It never renames the project and never touches
 * an estimate or proposal: estimates are independent once created.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const profile = await requireAdmin({ area: "projects" });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { id } = await params;
    if (!(await canAccessProject(profile, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = await createTenantServiceClient(tenant.businessId);
    const { data: project } = await db.from("projects").select("id, service_id, service_type").eq("id", id).maybeSingle();
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const links = (await loadProjectServiceLinks(db, [id])).get(id) ?? [];
    return NextResponse.json({
      service_ids: links.length ? links.map((l) => l.service_id) : project.service_id ? [project.service_id] : [],
      service_names: links.length ? links.map((l) => l.service_name) : projectServiceNames(project),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const profile = await requireAdmin({ permission: "projects.edit" });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const { id } = await params;
    if (!(await canAccessProject(profile, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!Array.isArray(body.service_ids)) {
      return NextResponse.json({ error: "service_ids must be a list" }, { status: 400 });
    }

    const db = await createTenantServiceClient(businessId);
    const { data: project } = await db
      .from("projects")
      .select("id, service_id, service_type")
      .eq("id", id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const links = (await loadProjectServiceLinks(db, [id])).get(id) ?? [];
    // Services already on this project stay selectable even after they are deactivated.
    const keepInactiveIds = [...links.map((l) => l.service_id), ...(project.service_id ? [project.service_id as string] : [])];
    const resolved = await resolveSelectedServices(
      businessId,
      { service_ids: body.service_ids },
      { keepInactiveIds }
    );
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    // A deactivated service keeps its historical name from the link snapshot.
    const linkNames = new Map(links.map((l) => [l.service_id, l.service_name]));
    const services = resolved.services.map((s) => ({
      ...s,
      name: (!s.active && s.id && linkNames.get(s.id)) || s.name,
    }));
    const serviceType = services.map((s) => s.name).join(" + ");

    const { data: updated, error } = await db
      .from("projects")
      .update({ service_type: serviceType, service_id: resolved.primaryServiceId })
      .eq("id", id)
      .select("id, service_id, service_type")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const linksStored = await writeProjectServiceLinks(db, id, services);

    const before = links.length ? links.map((l) => l.service_name) : projectServiceNames(project);
    const after = services.map((s) => s.name);
    if (before.join("|") !== after.join("|")) {
      await logProjectActivity("project_services_updated", `Services updated: ${formatServiceList(after)}`, {
        businessId,
        projectId: id,
        userId: profile.id,
        visibility: "admin",
        metadata: { from: before, to: after },
      });
    }

    const catalog = await listBusinessServices(businessId);
    return NextResponse.json({
      project: updated,
      service_ids: services.map((s) => s.id).filter(Boolean),
      service_names: after,
      links_stored: linksStored,
      inactive_ids: catalog.filter((row) => !row.is_active).map((row) => row.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
  }
}
