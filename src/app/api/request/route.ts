import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
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
import { resolvePublicSignupBusinessId } from "@/lib/tenant";
import {
  isMissingFinancialSectionColumnError,
  normalizeProjectMediaSections,
  withoutFinancialSectionColumns,
  projectColumnsFromMediaSections,
} from "@/lib/project-media-sections";
import {
  THANK_YOU_PATH,
  normalizeEmail,
  resolveRequestScenario,
  sealActivationToken,
  type RequestScenario,
} from "@/lib/portal-activation";
import { ensureClientLoginPlaceholder } from "@/lib/portal-activation-server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public project request. No password and no login required:
 * creates or links the client, creates the project in New Requests, notifies
 * the business, and returns a thank-you URL carrying a sealed request token
 * (optional portal activation happens there).
 *
 * Scenarios (see portal-activation.ts): A new client · B existing client
 * without an active portal · C existing active portal · D signed-in client.
 * An existing client's details are never overwritten from this public form.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, company, service_requested, preferred_date, notes } = body;

    const { property_address, error: addressError } = resolveAddressFromBody(body);
    if (addressError) {
      return NextResponse.json({ error: addressError }, { status: 400 });
    }

    const resolved = await resolvePublicSignupBusinessId(body);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const businessId = resolved.businessId;
    const appSettingsEarly = await getAppSettings(businessId);
    const instantPreliminary = appSettingsEarly.proposals.autoPreliminaryEstimate !== false;
    const serviceRequested = instantPreliminary ? String(service_requested ?? "").trim() : "";
    if (instantPreliminary && !serviceRequested) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }

    const raw = await createServiceClient();
    const db = await createTenantServiceClient(businessId);

    // ── Scenario D: signed in as a client of THIS business ──
    const profile = await getProfile();
    let sessionClient: {
      id: string;
      email: string | null;
      name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null = null;
    // The tenant-scoped lookup proves the client belongs to this business
    // (older client profiles may not carry business_id).
    if (
      profile?.role === "client" &&
      profile.client_id &&
      (!profile.business_id || profile.business_id === businessId)
    ) {
      const { data } = await db
        .from("clients")
        .select("id, email, name, first_name, last_name, deleted_at")
        .eq("id", profile.client_id)
        .maybeSingle();
      if (data && !data.deleted_at) sessionClient = data;
    }

    const person = sessionClient
      ? resolvePersonName({
          first_name: sessionClient.first_name,
          last_name: sessionClient.last_name,
          name: sessionClient.name || profile?.full_name,
        })
      : resolvePersonName({
          first_name: body.first_name,
          last_name: body.last_name,
          name: body.name,
        });
    const email = sessionClient ? normalizeEmail(sessionClient.email) : normalizeEmail(body.email);

    if (!sessionClient && (!person.firstName || !person.lastName || !email)) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }
    if (!sessionClient && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    let clientId: string;
    let existingClient: { id: string; portalActive: boolean } | null = null;
    let newClientPortalActive = false;

    if (sessionClient) {
      clientId = sessionClient.id;
    } else {
      const { data: candidates } = await raw
        .from("clients")
        .select("id, business_id, email")
        .ilike("email", email)
        .is("deleted_at", null);
      // ilike treats _ and % as wildcards — only exact (case-insensitive) matches count.
      const matches = (candidates ?? []).filter((c) => normalizeEmail(c.email) === email);

      if (matches.some((c) => c.business_id && c.business_id !== businessId)) {
        return NextResponse.json(
          {
            error: "email_other_business",
            message:
              "This email is already associated with another business. Please use a different email address.",
          },
          { status: 409 }
        );
      }

      const sameBusiness = matches.find((c) => c.business_id === businessId);
      if (sameBusiness) {
        clientId = sameBusiness.id;
        await fillBlankClientFields(db, clientId, {
          first_name: person.firstName,
          last_name: person.lastName,
          full_name: person.fullName,
          name: person.fullName,
          phone: phone || null,
          company: company || null,
          referral_source: body.referral_source || null,
        });
        const login = await ensureClientLoginPlaceholder(clientId, businessId);
        existingClient = {
          id: clientId,
          portalActive: Boolean(login.userId && !login.foreign && login.emailConfirmedAt),
        };
      } else {
        const { data: client, error: clientError } = await db
          .from("clients")
          .insert({
            name: person.fullName,
            first_name: person.firstName,
            last_name: person.lastName,
            full_name: person.fullName,
            email,
            phone: phone || null,
            company: company || null,
            notes: notes || null,
            referral_source: body.referral_source || null,
          })
          .select("id")
          .single();
        if (clientError || !client) {
          return NextResponse.json({ error: clientError?.message || "Could not save your details." }, { status: 500 });
        }
        clientId = client.id;
        const login = await ensureClientLoginPlaceholder(clientId, businessId);
        newClientPortalActive = Boolean(login.userId && !login.foreign && login.emailConfirmedAt);
      }
    }

    const scenario: RequestScenario = resolveRequestScenario({
      sessionClientId: sessionClient?.id ?? null,
      existingClient,
      newClientPortalActive,
    });

    const { data: linkedClient } = await db.from("clients").select("user_id").eq("id", clientId).maybeSingle();
    const actorUserId = sessionClient ? profile!.id : (linkedClient?.user_id as string | null) ?? null;

    const projectName = defaultProjectTitle(property_address, serviceRequested);
    const serviceId = await resolveServiceId(businessId, serviceRequested);
    const sectionDefaults = projectColumnsFromMediaSections(
      normalizeProjectMediaSections(appSettingsEarly.mediaSectionDefaults)
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
    let { data: project, error: projectError } = await db
      .from("projects")
      .insert(projectInsert)
      .select()
      .single();
    if (projectError && isMissingFinancialSectionColumnError(projectError)) {
      // Pre-v113 database: create without the estimates/payments visibility columns.
      ({ data: project, error: projectError } = await db
        .from("projects")
        .insert(withoutFinancialSectionColumns(projectInsert))
        .select()
        .single());
    }

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    await linkProjectToProperty(project.id, clientId, property_address, businessId);
    await touchClientActivity(clientId, businessId);

    const { data: lead } = await db
      .from("leads")
      .insert({
        name: person.fullName,
        first_name: person.firstName,
        last_name: person.lastName,
        email,
        phone: phone || null,
        company: company || null,
        property_address,
        service_requested: serviceRequested,
        preferred_date: preferred_date || null,
        notes: notes || null,
        project_id: project.id,
        is_read: false,
      })
      .select()
      .single();

    const activityServiceLabel = serviceRequested || "inquiry";
    const activities: Record<string, unknown>[] = [
      {
        activity_type: "proposal_submitted",
        description: instantPreliminary
          ? `Proposal submitted for ${serviceRequested}`
          : `Inquiry submitted for ${property_address}`,
        lead_id: lead?.id,
        project_id: project.id,
        client_id: clientId,
        user_id: actorUserId,
        visibility: "both",
        metadata: {
          email,
          service: activityServiceLabel,
          auto_created: true,
          inquiry: !instantPreliminary,
          request_scenario: scenario,
        },
      },
      {
        activity_type: "project_created",
        description: `Project "${projectName}" created`,
        project_id: project.id,
        client_id: clientId,
        user_id: actorUserId,
        lead_id: null,
        visibility: "both",
        metadata: { client_id: clientId },
      },
    ];
    if (scenario === "A") {
      activities.push({
        activity_type: "client_created",
        description: `Client record created for ${person.fullName} from a project request`,
        project_id: project.id,
        client_id: clientId,
        user_id: actorUserId,
        lead_id: null,
        visibility: "admin",
        metadata: { client_id: clientId, portal: "not_activated" },
      });
    }
    await db.from("activity_logs").insert(activities);

    await notifyAdmins({
      type: "proposal_submitted",
      eventKey: "new_project_request",
      title: instantPreliminary ? "New Project Request" : "New Project Inquiry",
      body: instantPreliminary
        ? `${person.fullName} submitted a request for ${serviceRequested} at ${property_address}. A preliminary estimate was generated automatically.`
        : `${person.fullName} sent an inquiry for ${property_address}. No preliminary estimate was created — follow up manually.`,
      link: `/admin/projects/${project.id}`,
      projectId: project.id,
      businessId,
    });

    // Confirmation email: clients without an active portal get a one-step
    // activation link (see clientEmailCtaUrl); active clients get the project link.
    await notifyClient({
      clientId,
      type: "proposal_submitted",
      eventKey: "new_project_request",
      title: instantPreliminary ? "We received your project request" : "We received your inquiry",
      body: instantPreliminary
        ? `Thanks ${person.firstName || person.fullName} — we received your request for ${serviceRequested} at ${property_address}. You don't need to do anything else; we'll follow up shortly.`
        : `Thanks ${person.firstName || person.fullName} — we received your inquiry for ${property_address}. You don't need to do anything else; we'll follow up shortly.`,
      link: `/dashboard/projects/${project.id}`,
      projectId: project.id,
      businessId,
    });

    if (instantPreliminary && serviceRequested) {
      await createPreliminaryEstimate(project.id, serviceRequested, {
        userId: actorUserId,
        skipIfExists: true,
        businessId,
      });
    }

    const ghlPayload = await buildPortalLeadPayload({
      businessId,
      clientId,
      projectId: project.id,
      firstName: person.firstName,
      lastName: person.lastName,
      email,
      phone,
      company,
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
      source: appSettingsEarly.integrations.ghlLeadSource,
    });

    await syncNewProjectLeadToGhl(project.id, ghlPayload, businessId);

    let thankYouUrl: string | null = null;
    try {
      const token = sealActivationToken({
        kind: "request",
        businessId,
        clientId,
        email,
        projectId: project.id,
        freshClient: scenario === "A",
      });
      thankYouUrl = `${THANK_YOU_PATH}?t=${encodeURIComponent(token)}`;
    } catch (err) {
      // The request is saved either way; the form falls back to an inline confirmation.
      console.error("[request] thank-you token unavailable:", err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      success: true,
      projectId: project.id,
      scenario,
      thankYouUrl,
    });
  } catch (err) {
    console.error("Request submission error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/** Public form input only fills empty fields on an existing client — never overwrites. */
async function fillBlankClientFields(
  db: Awaited<ReturnType<typeof createTenantServiceClient>>,
  clientId: string,
  incoming: Record<string, string | null>
) {
  const columns = Object.keys(incoming);
  const { data: current } = await db.from("clients").select(columns.join(", ")).eq("id", clientId).maybeSingle();
  if (!current) return;
  const row = current as unknown as Record<string, unknown>;
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    const existing = row[key];
    if (value && (existing === null || existing === undefined || String(existing).trim() === "")) {
      patch[key] = value;
    }
  }
  if (Object.keys(patch).length) {
    await db.from("clients").update(patch).eq("id", clientId);
  }
}
