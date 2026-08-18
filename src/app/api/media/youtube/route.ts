import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdminApi } from "@/lib/api-auth";
import { extractYouTubeId, getYouTubeEmbedUrl } from "@/lib/youtube";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = await request.json();

  if (!body.project_id || !body.youtube_url) {
    return NextResponse.json({ error: "Project and YouTube URL are required" }, { status: 400 });
  }

  const embedUrl = getYouTubeEmbedUrl(body.youtube_url);
  const videoId = extractYouTubeId(body.youtube_url);
  if (!embedUrl || !videoId) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  const { data: maxOrder } = await db
    .from("media_assets")
    .select("display_order")
    .eq("project_id", body.project_id)
    .eq("media_type", "video")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const title = (typeof body.title === "string" && body.title.trim()) || "YouTube Video";
  // file_path is globally unique — YouTube rows aren't in Storage, but still need a unique sentinel
  const filePath = `youtube/${videoId}/${randomUUID()}`;

  const { data, error } = await db
    .from("media_assets")
    .insert({
      project_id: body.project_id,
      file_name: `${title}.youtube`,
      title,
      file_path: filePath,
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
