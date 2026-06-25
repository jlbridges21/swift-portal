import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  const supabase = await createServiceClient();

  let query = supabase
    .from("project_clients")
    .select("*, clients(id, name, email, company)")
    .order("is_primary", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { project_id, client_id, is_primary } = body;

  if (!project_id || !client_id) {
    return NextResponse.json({ error: "project_id and client_id required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  if (is_primary) {
    await supabase
      .from("project_clients")
      .update({ is_primary: false })
      .eq("project_id", project_id);

    await supabase
      .from("projects")
      .update({ client_id })
      .eq("id", project_id);
  }

  const { data, error } = await supabase
    .from("project_clients")
    .upsert(
      { project_id, client_id, is_primary: is_primary ?? false },
      { onConflict: "project_id,client_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("project_clients").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
