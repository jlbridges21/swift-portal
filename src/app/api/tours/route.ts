import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { logProjectActivity } from "@/lib/activity";
import { notifyProjectClients } from "@/lib/notifications";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();

  if (!body.project_id || !body.tour_name || !body.kuula_url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: maxOrder } = await supabase
    .from("tours")
    .select("display_order")
    .eq("project_id", body.project_id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("tours")
    .insert({
      project_id: body.project_id,
      tour_name: body.tour_name,
      kuula_url: body.kuula_url,
      embed_code: body.embed_code || null,
      thumbnail_url: body.thumbnail_url || null,
      notes: body.notes || null,
      display_order: (maxOrder?.display_order ?? -1) + 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logProjectActivity("tour_added", `360° tour added: ${body.tour_name}`, {
    projectId: body.project_id,
    metadata: { tourId: data.id },
  });

  await notifyProjectClients({
    type: "deliverables_uploaded",
    eventKey: "deliverables_ready",
    title: "Media in Production",
    body: `A virtual tour "${body.tour_name}" has been added to your project.`,
    link: `/dashboard/projects/${body.project_id}`,
    projectId: body.project_id,
  });

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Tour id required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("tours").update(updates).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
