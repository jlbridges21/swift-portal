import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { logMediaEvent } from "@/lib/media-library";

const ALLOWED_PATCH_FIELDS = [
  "title",
  "description",
  "alt_text",
  "notes",
  "file_name",
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

  const supabase = await createServiceClient();

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

  if (asset.file_path) {
    const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
    await supabase.storage.from(bucket).remove([asset.file_path]);
  }

  await supabase.from("media_assets").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
