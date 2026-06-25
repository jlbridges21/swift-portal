import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getYouTubeEmbedUrl } from "@/lib/youtube";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json();

  if (!body.project_id || !body.youtube_url) {
    return NextResponse.json({ error: "Project and YouTube URL are required" }, { status: 400 });
  }

  const embedUrl = getYouTubeEmbedUrl(body.youtube_url);
  if (!embedUrl) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: maxOrder } = await supabase
    .from("media_assets")
    .select("display_order")
    .eq("project_id", body.project_id)
    .eq("media_type", "video")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      project_id: body.project_id,
      file_name: body.title || "YouTube Video",
      file_path: "",
      mime_type: "video/youtube",
      media_type: "video",
      media_source: "youtube",
      youtube_url: body.youtube_url,
      embed_url: embedUrl,
      display_order: (maxOrder?.display_order ?? -1) + 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
