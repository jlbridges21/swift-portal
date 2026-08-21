import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins, notifyClient } from "@/lib/notifications";
import { createPreliminaryEstimate } from "@/lib/preliminary-estimates";
import { defaultProjectTitle, resolveAddressFromBody } from "@/lib/address";
import { linkProjectToProperty } from "@/lib/properties";
import { touchClientActivity } from "@/lib/clients-data";
import { resolvePersonName } from "@/lib/person-name";
import { buildPortalLeadPayload } from "@/lib/ghl/build-portal-lead-payload";
import { syncNewProjectLeadToGhl } from "@/lib/ghl/sync-portal-lead";
import { getAppSettings } from "@/lib/app-settings";
import { resolveServiceId } from "@/lib/business-services";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "client" || !profile.client_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const businessId = tenant.businessId;

  const body = await request.json();
  const { service_requested, preferred_date, notes, company, phone } = body;

  const { property_address, error: addressError } = resolveAddressFromBody(body);
  if (addressError) {
    return NextResponse.json({ error: addressError }, { status: 400 });
  }

  if (!service_requested) {
    return NextResponse.json({ error: "Service type is required." }, { status: 400 });
  }

  const db = await createTenantServiceClient(businessId);
  const clientId = profile.client_id;

  const { data: client } = await db
    .from("clients")
    .select("name, first_name, last_name, email, phone, company")
    .eq("id", clientId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const person = resolvePersonName({
    first_name: client.first_name,
    last_name: client.last_name,
    name: client.name || profile.full_name,
  });

  const projectName = defaultProjectTitle(property_address, service_requested);
  const serviceId = await resolveServiceId(businessId, service_requested);

  const { data: project, error: projectError } = await db
    .from("projects")
    .insert({
      client_id: clientId,
      project_name: projectName,
      property_address,
      service_type: service_requested,
      service_id: serviceId,
      status: "new_request",
      notes: notes || null,
      shoot_date: preferred_date || null,
      ghl_sync_status: "pending",
    })
    .select()
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  await linkProjectToProperty(project.id, clientId, property_address, businessId);
  await touchClientActivity(clientId, businessId);

  await db.from("project_clients").upsert(
    { project_id: project.id, client_id: clientId, is_primary: true },
    { onConflict: "project_id,client_id" }
  );

  await db.from("leads").insert({
    name: person.fullName,
    first_name: person.firstName || null,
    last_name: person.lastName || null,
    email: client.email || profile.email,
    phone: phone || client.phone || null,
    company: company || client.company || null,
    property_address,
    service_requested,
    preferred_date: preferred_date || null,
    notes: notes || null,
    project_id: project.id,
    is_read: false,
  });

  await logProjectActivity("proposal_submitted", `New project requested: ${service_requested}`, {
    businessId,
    projectId: project.id,
    userId: profile.id,
    metadata: { client_id: clientId },
  });

  await notifyAdmins({
    type: "proposal_submitted",
    eventKey: "new_project_request",
    title: "New Project Request",
    body: `${person.fullName} requested ${service_requested} at ${property_address}. A preliminary estimate was generated automatically.`,
    link: `/admin/projects/${project.id}`,
    projectId: project.id,
    businessId,
  });

  await notifyClient({
    clientId,
    type: "proposal_submitted",
    eventKey: "new_project_request",
    title: "We received your project request",
    body: `Thanks ${person.fullName} — we received your request for ${service_requested} at ${property_address}.`,
    link: `/dashboard/projects/${project.id}`,
    projectId: project.id,
    businessId,
  });

  await createPreliminaryEstimate(project.id, service_requested, {
    userId: profile.id,
    skipIfExists: true,
    businessId,
  });

  const appSettings = await getAppSettings(businessId);
  const ghlPayload = await buildPortalLeadPayload({
    businessId,
    clientId,
    projectId: project.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: client.email || profile.email || "",
    phone: phone || client.phone,
    company: company || client.company,
    serviceRequested: service_requested,
    propertyAddress: property_address,
    streetAddress: String(body.street_address ?? "").trim() || null,
    city: String(body.city ?? "").trim() || null,
    state: String(body.state ?? "").trim() || null,
    postalCode: String(body.zip_code ?? body.zip ?? "").trim() || null,
    projectNotes: notes,
    referralSource: body.referral_source,
    preferredDate: preferred_date,
    propertyType: body.property_type,
    source: appSettings.integrations.ghlLeadSource,
  });

  await syncNewProjectLeadToGhl(project.id, ghlPayload, businessId);

  return NextResponse.json({ success: true, projectId: project.id });
}
