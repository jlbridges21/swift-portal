import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdmin, logActivity } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";
import { getStatusLabel, normalizeStatus } from "@/lib/constants";
import { clientStatusNotification } from "@/lib/client-messages";
import { notifyProjectClients } from "@/lib/notifications";
import { defaultProjectTitle, formatAutoProjectName, resolveAddressFromBody } from "@/lib/address";
import { linkProjectToProperty } from "@/lib/properties";
import { createPreliminaryEstimate } from "@/lib/preliminary-estimates";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { resolveServiceId } from "@/lib/business-services";
import { resolveSelectedServices, writeProjectServiceLinks } from "@/lib/project-services";
import { projectTitleForServices } from "@/lib/project-service-names";
import { getAppSettings, type NotificationEventKey } from "@/lib/app-settings";
import {
  isMissingFinancialSectionColumnError,
  normalizeProjectMediaSections,
  withoutFinancialSectionColumns,
  parseMediaSectionsPatch,
  projectColumnsFromMediaSections,
} from "@/lib/project-media-sections";
import { copyDefaultDocumentsToProject } from "@/lib/default-project-documents";

function clientEventKeyForStatus(status: string): NotificationEventKey | undefined {
  switch (normalizeStatus(status)) {
    case "scheduled":
      return "shoot_scheduled";
    case "shoot_complete_editing":
      return "shoot_completed";
    case "ready_for_review":
      return "deliverables_ready";
    case "awaiting_payment":
      return "payment_link_sent";
    case "delivered":
      return "project_delivered";
    default:
      return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireAdmin({ permission: 'projects.create' });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const body = await request.json();

    const { property_address, error: addressError } = resolveAddressFromBody(body);
    if (addressError || !property_address) {
      return NextResponse.json({ error: addressError || "Missing required fields" }, { status: 400 });
    }

    if (!body.client_id || (!body.service_type && body.service_ids === undefined && body.service_names === undefined)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    // One project for every selected service; validated against this business's catalog.
    const resolvedServices = await resolveSelectedServices(businessId, body, { legacyField: "service_type" });
    if (!resolvedServices.ok) {
      return NextResponse.json({ error: resolvedServices.error }, { status: resolvedServices.status });
    }
    const selected = resolvedServices.services;
    const serviceType = resolvedServices.serviceType;
    const multiService = selected.length > 1;

    const { canAccessClient } = await import("@/lib/staff-access");
    if (!(await canAccessClient(businessId, profile, body.client_id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = await createClient();

    const { data: client } = await supabase
      .from("clients")
      .select("name, full_name")
      .eq("id", body.client_id)
      .eq("business_id", businessId)
      .single();

    const clientName = client?.full_name || client?.name || "Client";
    const street =
      String(body.street_address ?? "").trim() || property_address.split(",")[0]?.trim() || property_address;

    // One service keeps the existing auto-name; several read "Street — Multiple Services".
    const projectName =
      (typeof body.project_name === "string" && body.project_name.trim()) ||
      (multiService
        ? projectTitleForServices(street, selected.map((s) => s.name))
        : formatAutoProjectName(clientName, street, serviceType) || defaultProjectTitle(property_address, serviceType));

    const serviceId = resolvedServices.primaryServiceId;
    const appSettings = await getAppSettings(businessId);
    const sectionDefaults = projectColumnsFromMediaSections(
      normalizeProjectMediaSections(appSettings.mediaSectionDefaults)
    );

    const projectInsert = {
      business_id: businessId,
      client_id: body.client_id,
      project_name: projectName,
      property_address,
      service_type: serviceType,
      service_id: serviceId,
      status: body.status || "new_request",
      shoot_date: null,
      delivery_date: body.delivery_date || null,
      notes: body.notes || null,
      ...sectionDefaults,
    };
    let { data: project, error } = await supabase
      .from("projects")
      .insert(projectInsert)
      .select()
      .single();
    if (error && isMissingFinancialSectionColumnError(error)) {
      // Pre-v113 database: create without the estimates/payments visibility columns.
      ({ data: project, error } = await supabase
        .from("projects")
        .insert(withoutFinancialSectionColumns(projectInsert))
        .select()
        .single());
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeProjectServiceLinks(await createTenantServiceClient(businessId), project.id, selected);

    await linkProjectToProperty(project.id, body.client_id, property_address, businessId);
    // Settings → New Project Setup → Default Documents: each project gets its own copies.
    await copyDefaultDocumentsToProject(businessId, project.id);

    await supabase.from("project_clients").upsert(
      { business_id: businessId, project_id: project.id, client_id: body.client_id, is_primary: true },
      { onConflict: "project_id,client_id" }
    );

    // Phase 3 model: staff creators are auto-assigned. Inert until staff can create projects.
    const { autoAssignCreatorToProject } = await import("@/lib/staff");
    await autoAssignCreatorToProject({
      businessId,
      projectId: project.id,
      creatorUserId: profile.id,
      creatorRole: profile.role,
    });

    await createPreliminaryEstimate(project.id, serviceType, {
      userId: profile.id,
      skipIfExists: true,
      businessId,
      templates: selected.map((s) => s.template),
    });

    const proposedShootAt = body.proposed_shoot_at || body.shoot_date;
    if (proposedShootAt) {
      const proposedIso = new Date(proposedShootAt).toISOString();
      const service = await createTenantServiceClient(businessId);
      await service.from("shoot_proposals").insert({
        project_id: project.id,
        proposed_by: "client",
        proposed_at: proposedIso,
        message: "Preferred shoot time provided when the project was created.",
        status: "pending",
        created_by: profile.id,
      });
      await logProjectActivity("shoot_proposed", `Preferred shoot time: ${new Date(proposedIso).toLocaleString()}`, {
        businessId,
        projectId: project.id,
        userId: profile.id,
        metadata: { source: "project_create" },
      });
    }

    await logActivity("project_created", `Project "${project.project_name}" created`, {
      businessId,
      projectId: project.id,
    });

    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await requireAdmin({ permission: 'projects.edit' });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const body = await request.json();
    const { id, media_sections, marketing_visible, download_access, ...rest } = body;
    const updates: Record<string, unknown> = { ...rest };
    // Section visibility only via media_sections — refuse raw column mass-assignment.
    delete updates.media_sections;
    delete updates.client_section_photos;
    delete updates.client_section_videos;
    delete updates.client_section_tours;
    delete updates.client_section_models;
    delete updates.client_section_documents;
    delete updates.client_section_estimates;
    delete updates.client_section_payments;
    delete updates.client_section_marketing;
    delete updates.client_download_access;

    // Marketing Kit visibility (v123): true / false, or null to go back to automatic.
    if (marketing_visible !== undefined) {
      if (marketing_visible !== null && typeof marketing_visible !== "boolean") {
        return NextResponse.json({ error: "Invalid marketing_visible" }, { status: 400 });
      }
      updates.client_section_marketing = marketing_visible;
    }

    // Client download override (v124): "default" | "allow" | "restrict". Business users only (requireAdmin above).
    if (download_access !== undefined) {
      if (download_access !== "default" && download_access !== "allow" && download_access !== "restrict") {
        return NextResponse.json({ error: "Invalid download_access" }, { status: 400 });
      }
      updates.client_download_access = download_access === "default" ? null : download_access;
    }

    if (media_sections !== undefined) {
      const parsed = parseMediaSectionsPatch(media_sections);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid media_sections" }, { status: 400 });
      }
      Object.assign(updates, projectColumnsFromMediaSections(parsed));
    }

    // Service links are managed by PUT /api/projects/[id]/services; never mass-assigned here.
    delete updates.service_id;
    delete updates.request_key;

    const { canAccessProject } = await import("@/lib/project-access");
    if (!(await canAccessProject(profile, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("projects")
      .select("status, service_type")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    // Legacy single "Service Type" edits. An unchanged value (the Classic form
    // re-sends it on every save) must not re-resolve a multi-service project.
    let legacyServiceChange = false;
    if (typeof updates.service_type === "string") {
      if (existing && updates.service_type.trim() === String(existing.service_type ?? "").trim()) {
        delete updates.service_type;
      } else {
        updates.service_id = await resolveServiceId(businessId, updates.service_type);
        legacyServiceChange = true;
      }
    }

    let { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error && "client_download_access" in updates && (error.message ?? "").includes("client_download_access")) {
      return NextResponse.json(
        { error: "Per-project download access needs database migration v124." },
        { status: 409 }
      );
    }

    if (error && "client_section_marketing" in updates && (error.message ?? "").includes("client_section_marketing")) {
      return NextResponse.json(
        { error: "Showing or hiding the Marketing Kit per project needs database migration v123." },
        { status: 409 }
      );
    }

    if (error && isMissingFinancialSectionColumnError(error)) {
      // Pre-v113 database: estimates/payments columns don't exist yet. Media toggles
      // still save; hiding estimates or payments needs the migration.
      if (updates.client_section_estimates === false || updates.client_section_payments === false) {
        return NextResponse.json(
          { error: "Hiding Estimates & Proposals or Payments needs database migration v113." },
          { status: 409 }
        );
      }
      ({ data, error } = await supabase
        .from("projects")
        .update(withoutFinancialSectionColumns(updates))
        .eq("id", id)
        .eq("business_id", businessId)
        .select()
        .single());
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (
      typeof updates.status === "string" &&
      existing &&
      updates.status !== existing.status
    ) {
      const newStatus = updates.status;
      const label = getStatusLabel(newStatus);
      const activityType =
        newStatus === "shoot_complete_editing"
          ? "shoot_completed"
          : newStatus === "ready_for_review"
            ? "sent_for_review"
            : "status_updated";

      await logProjectActivity(
        activityType,
        activityType === "shoot_completed"
          ? "🚁 Shoot completed."
          : activityType === "sent_for_review"
            ? "Deliverables sent for review"
            : `Status updated to ${label}`,
        {
          businessId,
          projectId: id,
          idempotencyKey: idempotencyKey("project", id, activityType),
          metadata: { from: existing.status, to: newStatus },
        }
      );

      const appSettings = await getAppSettings(businessId);
      await notifyProjectClients({
        type: newStatus === "awaiting_payment" ? "invoice_available" : "status_changed",
        eventKey: clientEventKeyForStatus(newStatus),
        title: clientStatusNotification(newStatus, appSettings.business.businessName).title,
        body: clientStatusNotification(newStatus, appSettings.business.businessName).body,
        link: `/dashboard/projects/${id}`,
        projectId: id,
      });
    }

    if (updates.shoot_date !== undefined) {
      const service = await createClient();
      const { data: confirmed } = await service
        .from("shoot_proposals")
        .select("id")
        .eq("project_id", id)
        .eq("business_id", businessId)
        .eq("status", "confirmed")
        .maybeSingle();

      if (confirmed && updates.shoot_date) {
        await service
          .from("shoot_proposals")
          .update({ proposed_at: `${updates.shoot_date}T09:00:00.000Z` })
          .eq("id", confirmed.id)
          .eq("business_id", businessId);
        const { syncShootToGoogleSafe } = await import("@/lib/google-calendar");
        await syncShootToGoogleSafe(businessId, confirmed.id, "upsert");
      }
    }

    // The estimate is independent of the project's services once created: no regeneration here.
    if (legacyServiceChange && typeof updates.service_type === "string") {
      await writeProjectServiceLinks(await createTenantServiceClient(businessId), id, [
        { id: (updates.service_id as string | null) ?? null, name: updates.service_type },
      ]);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
