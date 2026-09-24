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
import { createPreliminaryEstimate, upsertPreliminaryEstimate } from "@/lib/preliminary-estimates";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { resolveServiceId } from "@/lib/business-services";
import { getAppSettings, type NotificationEventKey } from "@/lib/app-settings";
import {
  normalizeProjectMediaSections,
  parseMediaSectionsPatch,
  projectColumnsFromMediaSections,
} from "@/lib/project-media-sections";

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

    if (!body.client_id || !body.service_type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    const projectName =
      (typeof body.project_name === "string" && body.project_name.trim()) ||
      formatAutoProjectName(clientName, street, body.service_type) ||
      defaultProjectTitle(property_address, body.service_type);

    const serviceId = await resolveServiceId(businessId, body.service_type);
    const appSettings = await getAppSettings(businessId);
    const sectionDefaults = projectColumnsFromMediaSections(
      normalizeProjectMediaSections(appSettings.mediaSectionDefaults)
    );

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        business_id: businessId,
        client_id: body.client_id,
        project_name: projectName,
        property_address,
        service_type: body.service_type,
        service_id: serviceId,
        status: body.status || "new_request",
        shoot_date: null,
        delivery_date: body.delivery_date || null,
        notes: body.notes || null,
        ...sectionDefaults,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await linkProjectToProperty(project.id, body.client_id, property_address, businessId);

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

    await createPreliminaryEstimate(project.id, body.service_type, {
      userId: profile.id,
      skipIfExists: true,
      businessId,
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
    const { id, media_sections, ...rest } = body;
    const updates: Record<string, unknown> = { ...rest };
    // Section visibility only via media_sections — refuse raw column mass-assignment.
    delete updates.media_sections;
    delete updates.client_section_photos;
    delete updates.client_section_videos;
    delete updates.client_section_tours;
    delete updates.client_section_models;
    delete updates.client_section_documents;

    if (media_sections !== undefined) {
      const parsed = parseMediaSectionsPatch(media_sections);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid media_sections" }, { status: 400 });
      }
      Object.assign(updates, projectColumnsFromMediaSections(parsed));
    }

    if (typeof updates.service_type === "string") {
      updates.service_id = await resolveServiceId(businessId, updates.service_type);
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("projects")
      .select("status")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

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
      }
    }

    if (updates.service_type && typeof updates.service_type === "string") {
      await upsertPreliminaryEstimate(id, updates.service_type, { businessId });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
