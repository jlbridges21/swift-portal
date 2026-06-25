import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/notifications";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "client" || !profile.client_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { property_address, service_requested, preferred_date, notes, company, phone } = body;

  if (!property_address || !service_requested) {
    return NextResponse.json({ error: "Property address and service are required." }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const clientId = profile.client_id;

  const { data: client } = await supabase.from("clients").select("name, email").eq("id", clientId).single();

  const projectName = `${property_address.split(",")[0]} — ${service_requested}`;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      client_id: clientId,
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

  await supabase.from("project_clients").upsert(
    { project_id: project.id, client_id: clientId, is_primary: true },
    { onConflict: "project_id,client_id" }
  );

  await supabase.from("leads").insert({
    name: client?.name || profile.full_name || "Client",
    email: client?.email || profile.email,
    phone: phone || null,
    company: company || null,
    property_address,
    service_requested,
    preferred_date: preferred_date || null,
    notes: notes || null,
    project_id: project.id,
    is_read: false,
  });

  await logProjectActivity("proposal_submitted", `New project requested: ${service_requested}`, {
    projectId: project.id,
    userId: profile.id,
    metadata: { client_id: clientId },
  });

  await notifyAdmins({
    type: "proposal_submitted",
    title: "New Project Request",
    body: `${client?.name || profile.full_name} requested ${service_requested} at ${property_address}.`,
    link: `/admin/projects/${project.id}`,
    projectId: project.id,
  });

  return NextResponse.json({ success: true, projectId: project.id });
}
