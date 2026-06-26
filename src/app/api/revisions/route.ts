import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/notifications";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const supabase = await createClient();

  let query = supabase
    .from("revisions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (profile.role === "client" && profile.client_id) {
    query = query.eq("client_id", profile.client_id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !profile.client_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.project_id || !body.description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("revisions")
    .insert({
      project_id: body.project_id,
      client_id: profile.client_id,
      description: body.description,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("projects")
    .update({ deliverables_approved_at: null, deliverables_approved_by: null })
    .eq("id", body.project_id);

  await logProjectActivity("revision_requested", "Revision requested", {
    projectId: body.project_id,
    userId: profile.id,
    metadata: { revisionId: data.id },
  });

  await notifyAdmins({
    type: "revision_requested",
    eventKey: "revision_requested",
    title: "Revision Requested",
    body: body.description.slice(0, 160),
    link: `/admin/projects/${body.project_id}#activity`,
    projectId: body.project_id,
  });

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status, admin_notes } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("revisions")
    .update({ status, admin_notes: admin_notes ?? null })
    .eq("id", id)
    .select("*, project_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (status === "completed") {
    await logProjectActivity("revision_completed", "Revision completed", {
      projectId: data.project_id,
      userId: profile.id,
      metadata: { revisionId: id },
    });
  }

  const clientMessages: Record<string, { title: string; body: string }> = {
    in_progress: {
      title: "We're working on your revision",
      body: admin_notes || "Swift Aerial Media is addressing your revision request.",
    },
    completed: {
      title: "Your revision is complete",
      body: admin_notes || "We've completed your revision request. Check your project for updates.",
    },
    pending: {
      title: "Revision request received",
      body: admin_notes || "We've received your revision request and will get started soon.",
    },
  };
  const msg = clientMessages[status] ?? {
    title: "Update on your revision request",
    body: admin_notes || "Your revision request has been updated.",
  };

  const { notifyProjectClients } = await import("@/lib/notifications");
  await notifyProjectClients({
    type: "revision_requested",
    eventKey: status === "completed" ? "revision_completed" : undefined,
    title: msg.title,
    body: msg.body,
    link: `/dashboard/projects/${data.project_id}#activity`,
    projectId: data.project_id,
  });

  return NextResponse.json(data);
}
