import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { logMediaEvent } from "@/lib/media-library";
import { normalizeMediaTitle } from "@/lib/media-display-name";

const ALLOWED_PATCH_FIELDS = [
  "title",
  "description",
  "alt_text",
  "notes",
  "youtube_url",
  "visibility",
  "downloadable",
  "captured_at",
  "camera_model",
  "orientation",
  "width",
  "height",
  "duration_seconds",
  "is_favorite",
  "thumbnail_url",
  "project_id",
  "folder_id",
] as const;

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { id, ...rawUpdates } = body;

  if (!id) {
    return NextResponse.json({ error: "Media id required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (key in rawUpdates) updates[key] = rawUpdates[key];
  }

  if ("title" in updates) {
    const normalized = normalizeMediaTitle(updates.title);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    updates.title = normalized.title;
  }

  const supabase = await createServiceClient();

  if ("project_id" in updates) {
    const projectId = updates.project_id as string | null;
    if (projectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("client_id, property_id")
        .eq("id", projectId)
        .single();
      updates.client_id = project?.client_id ?? null;
      updates.property_id = project?.property_id ?? null;
    } else {
      updates.client_id = null;
      updates.property_id = null;
      updates.folder_id = null;
    }
  }

  if ("folder_id" in updates && updates.folder_id !== null) {
    const folderId = updates.folder_id as string;
    const { data: existing } = await supabase
      .from("media_assets")
      .select("project_id")
      .eq("id", id)
      .maybeSingle();
    const projectId = (updates.project_id as string | null | undefined) ?? existing?.project_id;
    if (!projectId) {
      return NextResponse.json({ error: "Cannot assign folder without a project" }, { status: 400 });
    }
    const { data: folder } = await supabase
      .from("media_folders")
      .select("id, project_id")
      .eq("id", folderId)
      .maybeSingle();
    if (!folder || folder.project_id !== projectId) {
      return NextResponse.json({ error: "Folder does not belong to this project" }, { status: 400 });
    }
  }

  if (updates.youtube_url) {
    const embedUrl = getYouTubeEmbedUrl(updates.youtube_url as string);
    if (!embedUrl) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }
    updates.embed_url = embedUrl;
  }

  const { data: existing } = await supabase.from("media_assets").select("project_id, title").eq("id", id).single();

  const { data, error } = await supabase
    .from("media_assets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updates.title && updates.title !== existing?.title) {
    await logMediaEvent({
      mediaAssetId: id,
      projectId: existing?.project_id,
      userId: auth.profile?.id,
      eventType: "renamed",
      description: `Renamed to "${updates.title}"`,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: asset } = await supabase.from("media_assets").select("*").eq("id", id).single();

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // YouTube / external / kuula rows use sentinel file_path values — not Storage objects
  const hasStorageObject =
    Boolean(asset.file_path) &&
    asset.media_source !== "youtube" &&
    asset.media_source !== "kuula" &&
    asset.media_source !== "external";

  if (hasStorageObject) {
    const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
    await supabase.storage.from(bucket).remove([asset.file_path]);
  }

  await supabase.from("media_assets").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
