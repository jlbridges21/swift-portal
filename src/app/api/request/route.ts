import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/notifications";
import { createPreliminaryEstimate } from "@/lib/preliminary-estimates";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      name,
      email,
      phone,
      company,
      property_address,
      service_requested,
      preferred_date,
      notes,
      password,
      confirm_password,
    } = body;

    if (!name || !email || !property_address || !service_requested || !password) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }

    if (password !== confirm_password) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: "client" },
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

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        name,
        email,
        phone: phone || null,
        company: company || null,
        notes: notes || null,
        user_id: userId,
      })
      .select()
      .single();

    if (clientError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    await supabase
      .from("profiles")
      .update({ client_id: client.id, full_name: name, role: "client" })
      .eq("id", userId);

    const projectName = `${property_address.split(",")[0]} — ${service_requested}`;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        client_id: client.id,
        project_name: projectName,
        property_address,
        service_type: service_requested,
        status: "new_request",
        notes: notes || null,
        shoot_date: preferred_date || null,
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    const { data: lead } = await supabase
      .from("leads")
      .insert({
        name,
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

    await supabase.from("activity_logs").insert([
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
        description: `Client account created for ${name}`,
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
      body: `${name} submitted a request for ${service_requested} at ${property_address}. A preliminary estimate was generated automatically.`,
      link: `/admin/projects/${project.id}`,
      projectId: project.id,
    });

    await createPreliminaryEstimate(project.id, service_requested, {
      userId,
      skipIfExists: true,
    });

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
