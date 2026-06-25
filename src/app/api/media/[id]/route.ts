import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getYouTubeEmbedUrl } from "@/lib/youtube";

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Media id required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  if (updates.youtube_url) {
    const embedUrl = getYouTubeEmbedUrl(updates.youtube_url);
    if (!embedUrl) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }
    updates.embed_url = embedUrl;
  }

  const { data, error } = await supabase
    .from("media_assets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
