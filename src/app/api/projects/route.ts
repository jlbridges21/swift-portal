import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin, logActivity } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";
import { getStatusLabel, normalizeStatus } from "@/lib/constants";
import { clientStatusNotification } from "@/lib/client-messages";
import { notifyProjectClients } from "@/lib/notifications";
import { defaultProjectTitle, formatAutoProjectName, resolveAddressFromBody } from "@/lib/address";
import { linkProjectToProperty } from "@/lib/properties";
import { createPreliminaryEstimate, upsertPreliminaryEstimate } from "@/lib/preliminary-estimates";
import type { NotificationEventKey } from "@/lib/app-settings";

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
    const profile = await requireAdmin();
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
      .single();

    const clientName = client?.full_name || client?.name || "Client";
    const street =
      String(body.street_address ?? "").trim() || property_address.split(",")[0]?.trim() || property_address;

    const projectName =
      (typeof body.project_name === "string" && body.project_name.trim()) ||
      formatAutoProjectName(clientName, street, body.service_type) ||
      defaultProjectTitle(property_address, body.service_type);

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        client_id: body.client_id,
        project_name: projectName,
        property_address,
        service_type: body.service_type,
        status: body.status || "new_request",
        shoot_date: null,
        delivery_date: body.delivery_date || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await linkProjectToProperty(project.id, body.client_id, property_address);

    await supabase.from("project_clients").upsert(
      { project_id: project.id, client_id: body.client_id, is_primary: true },
      { onConflict: "project_id,client_id" }
    );

    await createPreliminaryEstimate(project.id, body.service_type, {
      userId: profile.id,
      skipIfExists: true,
    });

    const proposedShootAt = body.proposed_shoot_at || body.shoot_date;
    if (proposedShootAt) {
      const proposedIso = new Date(proposedShootAt).toISOString();
      const service = await createServiceClient();
      await service.from("shoot_proposals").insert({
        project_id: project.id,
        proposed_by: "client",
        proposed_at: proposedIso,
        message: "Preferred shoot time provided when the project was created.",
        status: "pending",
        created_by: profile.id,
      });
      await logProjectActivity("shoot_proposed", `Preferred shoot time: ${new Date(proposedIso).toLocaleString()}`, {
        projectId: project.id,
        userId: profile.id,
        metadata: { source: "project_create" },
      });
    }

    await logActivity("project_created", `Project "${project.project_name}" created`, {
      projectId: project.id,
    });

    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, ...updates } = body;

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("projects")
      .select("status")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (updates.status && existing && updates.status !== existing.status) {
      const label = getStatusLabel(updates.status);
      const activityType =
        updates.status === "shoot_complete_editing"
          ? "shoot_completed"
          : updates.status === "ready_for_review"
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
          projectId: id,
          idempotencyKey: idempotencyKey("project", id, activityType),
          metadata: { from: existing.status, to: updates.status },
        }
      );

      await notifyProjectClients({
        type: updates.status === "awaiting_payment" ? "invoice_available" : "status_changed",
        eventKey: clientEventKeyForStatus(updates.status),
        title: clientStatusNotification(updates.status).title,
        body: clientStatusNotification(updates.status).body,
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
        .eq("status", "confirmed")
        .maybeSingle();

      if (confirmed && updates.shoot_date) {
        await service
          .from("shoot_proposals")
          .update({ proposed_at: `${updates.shoot_date}T09:00:00.000Z` })
          .eq("id", confirmed.id);
      }
    }

    if (updates.service_type && typeof updates.service_type === "string") {
      await upsertPreliminaryEstimate(id, updates.service_type);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
