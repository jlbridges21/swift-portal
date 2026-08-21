import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      email,
      phone,
      company,
      service_requested,
      preferred_date,
      notes,
      password,
      confirm_password,
    } = body;

    const person = resolvePersonName({
      first_name: body.first_name,
      last_name: body.last_name,
      name: body.name,
    });

    const { property_address, error: addressError } = resolveAddressFromBody(body);
    if (addressError) {
      return NextResponse.json({ error: addressError }, { status: 400 });
    }

    if (!person.firstName || !person.lastName || !email || !service_requested || !password) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }

    if (password !== confirm_password) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const resolved = await resolvePublicSignupBusinessId(body);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const businessId = resolved.businessId;

    const raw = await createServiceClient();
    const db = await createTenantServiceClient(businessId);

    const { data: existingClients } = await raw
      .from("clients")
      .select("id, business_id, email")
      .ilike("email", email)
      .is("deleted_at", null);

    const otherBusiness = (existingClients ?? []).find(
      (c) => c.business_id && c.business_id !== businessId
    );
    if (otherBusiness) {
      return NextResponse.json(
        {
          error: "email_other_business",
          message:
            "This email is already associated with another business. One person cannot be a client of two businesses.",
        },
        { status: 409 }
      );
    }

    const sameBusiness = (existingClients ?? []).find((c) => c.business_id === businessId);
    if (sameBusiness) {
      return NextResponse.json(
        {
          error: "account_exists",
          message:
            "An account already exists with this email. Please log in to request a new shoot from your portal.",
        },
        { status: 409 }
      );
    }

    const { data: authUser, error: authError } = await raw.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: person.fullName, role: "client", business_id: businessId },
    });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return NextResponse.json(
          {
            error: "account_exists",
            message:
              "An account already exists with this email. Please log in to request a new shoot from your portal.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authUser.user) {
      return NextResponse.json({ error: "Failed to create account." }, { status: 500 });
    }

    const userId = authUser.user.id;

    const { data: client, error: clientError } = await db
      .from("clients")
      .insert({
        name: person.fullName,
        first_name: person.firstName,
        last_name: person.lastName,
        full_name: person.fullName,
        email,
        phone: body.phone || null,
        company: body.company || null,
        notes: body.notes || null,
        referral_source: body.referral_source || null,
        user_id: userId,
      })
      .select()
      .single();

    if (clientError) {
      await raw.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    await raw
      .from("profiles")
      .update({
        client_id: client.id,
        full_name: person.fullName,
        role: "client",
        business_id: businessId,
      })
      .eq("id", userId);

    const projectName = defaultProjectTitle(property_address, service_requested);
    const serviceId = await resolveServiceId(businessId, service_requested);

    const { data: project, error: projectError } = await db
      .from("projects")
      .insert({
        client_id: client.id,
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

    await linkProjectToProperty(project.id, client.id, property_address, businessId);
    await touchClientActivity(client.id, businessId);

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
        service_requested,
        preferred_date: preferred_date || null,
        notes: notes || null,
        project_id: project.id,
        is_read: false,
      })
      .select()
      .single();

    await db.from("activity_logs").insert([
      {
        activity_type: "proposal_submitted",
        description: `Proposal submitted for ${service_requested}`,
        lead_id: lead?.id,
        project_id: project.id,
        user_id: userId,
        metadata: { email, service: service_requested, auto_created: true },
      },
      {
        activity_type: "account_created",
        description: `Client account created for ${person.fullName}`,
        project_id: project.id,
        user_id: userId,
        metadata: { client_id: client.id },
      },
      {
        activity_type: "project_created",
        description: `Project "${projectName}" created`,
        project_id: project.id,
        user_id: userId,
        metadata: { client_id: client.id },
      },
    ]);

    await notifyAdmins({
      type: "proposal_submitted",
      eventKey: "new_project_request",
      title: "New Project Request",
      body: `${person.fullName} submitted a request for ${service_requested} at ${property_address}. A preliminary estimate was generated automatically.`,
      link: `/admin/projects/${project.id}`,
      projectId: project.id,
      businessId,
    });

    await notifyClient({
      clientId: client.id,
      type: "proposal_submitted",
      eventKey: "new_project_request",
      title: "We received your project request",
      body: `Thanks ${person.fullName} — we received your request for ${service_requested} at ${property_address}.`,
      link: `/dashboard/projects/${project.id}`,
      projectId: project.id,
      businessId,
    });

    await createPreliminaryEstimate(project.id, service_requested, {
      userId,
      skipIfExists: true,
      businessId,
    });

    const appSettings = await getAppSettings(businessId);
    const ghlPayload = await buildPortalLeadPayload({
      businessId,
      clientId: client.id,
      projectId: project.id,
      firstName: person.firstName,
      lastName: person.lastName,
      email,
      phone,
      company,
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

    return NextResponse.json({
      success: true,
      projectId: project.id,
      email,
    });
  } catch (err) {
    console.error("Request signup error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
