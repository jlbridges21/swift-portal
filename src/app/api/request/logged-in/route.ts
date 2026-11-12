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
import { resolveSelectedServices, writeProjectServiceLinks, type SelectedService } from "@/lib/project-services";
import { formatServiceList, projectTitleForServices } from "@/lib/project-service-names";
import {
  findProjectByRequestKey,
  findRecentDuplicateRequest,
  insertRequestProject,
  parseRequestKey,
} from "@/lib/request-dedupe";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  isMissingFinancialSectionColumnError,
  normalizeProjectMediaSections,
  withoutFinancialSectionColumns,
  projectColumnsFromMediaSections,
} from "@/lib/project-media-sections";
import { copyDefaultDocumentsToProject } from "@/lib/default-project-documents";

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

  const createSettings = await getAppSettings(businessId);
  const instantPreliminary = createSettings.proposals.autoPreliminaryEstimate !== false;
  let selected: SelectedService[] = [];
  let serviceRequested = "";
  let primaryServiceId: string | null = null;
  if (instantPreliminary) {
    const hasSelection =
      body.service_ids !== undefined || body.service_names !== undefined || String(service_requested ?? "").trim();
    if (!hasSelection) {
      return NextResponse.json({ error: "Service type is required." }, { status: 400 });
    }
    const resolvedServices = await resolveSelectedServices(businessId, body as Record<string, unknown>);
    if (!resolvedServices.ok) {
      return NextResponse.json({ error: resolvedServices.error }, { status: resolvedServices.status });
    }
    selected = resolvedServices.services;
    serviceRequested = resolvedServices.serviceType;
    primaryServiceId = resolvedServices.primaryServiceId;
  }
  const serviceNames = selected.map((s) => s.name);
  const serviceLabel = formatServiceList(serviceNames) || serviceRequested;
  const requestKey = parseRequestKey(body.request_key);

  const db = await createTenantServiceClient(businessId);
  const clientId = profile.client_id;

  const keyed = await findProjectByRequestKey(db, requestKey);
  if (keyed) {
    return NextResponse.json({ success: true, projectId: keyed.id, duplicate: true });
  }
  if (!requestKey) {
    const recent = await findRecentDuplicateRequest(db, {
      clientId,
      propertyAddress: property_address ?? "",
      serviceType: serviceRequested,
    });
    if (recent) return NextResponse.json({ success: true, projectId: recent.id, duplicate: true });
  }

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

  const projectName = selected.length
    ? projectTitleForServices(property_address, serviceNames)
    : defaultProjectTitle(property_address, serviceRequested);
  const serviceId = selected.length ? primaryServiceId : await resolveServiceId(businessId, serviceRequested);
  const sectionDefaults = projectColumnsFromMediaSections(
    normalizeProjectMediaSections(createSettings.mediaSectionDefaults)
  );

  const projectInsert = {
    client_id: clientId,
    project_name: projectName,
    property_address,
    service_type: serviceRequested,
    service_id: serviceId,
    status: "new_request",
    notes: notes || null,
    shoot_date: preferred_date || null,
    ghl_sync_status: "pending",
    ...sectionDefaults,
  };
  const inserted = await insertRequestProject(db, projectInsert, requestKey, async (row) => {
    let result = await db.from("projects").insert(row).select().single();
    if (result.error && isMissingFinancialSectionColumnError(result.error)) {
      // Pre-v113 database: create without the estimates/payments visibility columns.
      result = await db.from("projects").insert(withoutFinancialSectionColumns(row)).select().single();
    }
    return { data: result.data as Record<string, unknown> | null, error: result.error };
  });
  if (inserted.kind === "duplicate") {
    return NextResponse.json({ success: true, projectId: inserted.project.id, duplicate: true });
  }
  if (inserted.kind === "error") {
    return NextResponse.json({ error: inserted.message }, { status: 500 });
  }
  const project = inserted.project as { id: string };
  if (selected.length) await writeProjectServiceLinks(db, project.id, selected);

  await linkProjectToProperty(project.id, clientId, property_address, businessId);
  // Settings → New Project Setup → Default Documents: each project gets its own copies.
  await copyDefaultDocumentsToProject(businessId, project.id);
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
    service_requested: serviceRequested,
    preferred_date: preferred_date || null,
    notes: notes || null,
    project_id: project.id,
    is_read: false,
  });

  await logProjectActivity(
    "proposal_submitted",
    instantPreliminary
      ? `New project requested: ${serviceLabel}`
      : `Inquiry submitted for ${property_address}`,
    {
      businessId,
      projectId: project.id,
      userId: profile.id,
      metadata: {
        client_id: clientId,
        inquiry: !instantPreliminary,
        ...(serviceNames.length > 1 ? { services: serviceNames } : {}),
      },
    }
  );

  await notifyAdmins({
    type: "proposal_submitted",
    eventKey: "new_project_request",
    title: instantPreliminary ? "New Project Request" : "New Project Inquiry",
    body: instantPreliminary
      ? `${person.fullName} requested ${serviceLabel} at ${property_address}. ${serviceNames.length > 1 ? "One combined preliminary estimate was" : "A preliminary estimate was"} generated automatically.`
      : `${person.fullName} sent an inquiry for ${property_address}. No preliminary estimate was created — follow up manually.`,
    link: `/admin/projects/${project.id}`,
    projectId: project.id,
    businessId,
  });

  await notifyClient({
    clientId,
    type: "proposal_submitted",
    eventKey: "new_project_request",
    title: instantPreliminary ? "We received your project request" : "We received your inquiry",
    body: instantPreliminary
      ? `Thanks ${person.fullName} — we received your request for ${serviceLabel} at ${property_address}.`
      : `Thanks ${person.fullName} — we received your inquiry for ${property_address}. We'll follow up shortly.`,
    link: `/dashboard/projects/${project.id}`,
    projectId: project.id,
    businessId,
  });

  if (instantPreliminary && serviceRequested) {
    await createPreliminaryEstimate(project.id, serviceRequested, {
      userId: profile.id,
      skipIfExists: true,
      businessId,
      templates: selected.map((s) => s.template),
    });
  }

  const ghlPayload = await buildPortalLeadPayload({
    businessId,
    clientId,
    projectId: project.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: client.email || profile.email || "",
    phone: phone || client.phone,
    company: company || client.company,
    serviceRequested: serviceRequested,
    propertyAddress: property_address,
    streetAddress: String(body.street_address ?? "").trim() || null,
    city: String(body.city ?? "").trim() || null,
    state: String(body.state ?? "").trim() || null,
    postalCode: String(body.zip_code ?? body.zip ?? "").trim() || null,
    projectNotes: notes,
    referralSource: body.referral_source,
    preferredDate: preferred_date,
    propertyType: body.property_type,
    source: createSettings.integrations.ghlLeadSource,
  });

  await syncNewProjectLeadToGhl(project.id, ghlPayload, businessId);

  return NextResponse.json({ success: true, projectId: project.id });
}
