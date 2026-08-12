import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getProfile } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import type { MediaFolder } from "@/lib/types";

/** List folders for a project (admin or client with access). */
export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const hasAccess = await canAccessProject(profile, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createServiceClient();
  const { data: folders, error } = await supabase
    .from("media_folders")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: photos } = await supabase
    .from("media_assets")
    .select("id, folder_id, display_order")
    .eq("project_id", projectId)
    .eq("media_type", "photo")
    .order("display_order", { ascending: true });

  const countByFolder = new Map<string | "null", number>();
  const coverByFolder = new Map<string | "null", string>();
  for (const p of photos ?? []) {
    const key = (p.folder_id ?? "null") as string | "null";
    countByFolder.set(key, (countByFolder.get(key) ?? 0) + 1);
    if (!coverByFolder.has(key)) coverByFolder.set(key, p.id);
  }

  const result: MediaFolder[] = (folders ?? []).map((f) => ({
    ...f,
    photo_count: countByFolder.get(f.id) ?? 0,
    cover_media_id: coverByFolder.get(f.id) ?? null,
  }));

  return NextResponse.json({
    folders: result,
    unfiled_count: countByFolder.get("null") ?? 0,
    total_count: (photos ?? []).length,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!projectId || !name) {
    return NextResponse.json({ error: "project_id and name are required" }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: "Folder name is too long" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: maxOrder } = await supabase
    .from("media_folders")
    .select("display_order")
    .eq("project_id", projectId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("media_folders")
    .insert({
      project_id: projectId,
      name,
      display_order: (maxOrder?.display_order ?? -1) + 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...data, photo_count: 0, cover_media_id: null } satisfies MediaFolder);
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  const projectId = typeof body.project_id === "string" ? body.project_id : null;

  if (!id || !projectId) {
    return NextResponse.json({ error: "id and project_id are required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data: folder } = await supabase
    .from("media_folders")
    .select("id, project_id")
    .eq("id", id)
    .maybeSingle();

  if (!folder || folder.project_id !== projectId) {
    return NextResponse.json({ error: "Folder not found for this project" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: "Folder name is too long" }, { status: 400 });
    updates.name = name;
  }
  if (typeof body.display_order === "number") {
    updates.display_order = body.display_order;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("media_folders")
    .update(updates)
    .eq("id", id)
    .eq("project_id", projectId)
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
  const projectId = searchParams.get("project_id");

  if (!id || !projectId) {
    return NextResponse.json({ error: "id and project_id are required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data: folder } = await supabase
    .from("media_folders")
    .select("id, project_id, name")
    .eq("id", id)
    .maybeSingle();

  if (!folder || folder.project_id !== projectId) {
    return NextResponse.json({ error: "Folder not found for this project" }, { status: 404 });
  }

  // Photos stay; folder_id is ON DELETE SET NULL
  const { error } = await supabase
    .from("media_folders")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_id: id });
}
