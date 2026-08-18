import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAsset, Project } from "@/lib/types";
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from "@/lib/youtube";

export type HeroMedia =
  | { type: "image"; url: string }
  | { type: "video"; url: string }
  | { type: "youtube"; embedUrl: string; posterUrl: string | null }
  | null;

/**
 * Poster/thumbnail URL for dashboard cards (always an image, never a video file).
 *
 * `businessId` is required: media lookups are filtered by it even when `supabase`
 * is a service-role client (admin calendar). Chosen over an "RLS-bound client
 * only" contract because one caller injects service role for signed URLs.
 */
export async function getProjectHeroPosterUrl(
  supabase: SupabaseClient,
  project: Pick<Project, "id" | "cover_image_id" | "cover_image_url">,
  businessId: string
): Promise<string | null> {
  const hero = await getProjectHeroMedia(supabase, project, businessId);
  if (hero?.type === "image") return hero.url;
  if (hero?.type === "youtube") return hero.posterUrl;
  if (project.cover_image_url) return project.cover_image_url;
  return firstProjectPhotoUrl(supabase, project.id, businessId);
}

/** @deprecated Use getProjectHeroMedia — returns image URL only for card thumbnails */
export async function getProjectCoverUrl(
  supabase: SupabaseClient,
  project: Pick<Project, "id" | "cover_image_id" | "cover_image_url">,
  businessId: string
): Promise<string | null> {
  return getProjectHeroPosterUrl(supabase, project, businessId);
}

async function signedPhotoUrl(
  supabase: SupabaseClient,
  filePath: string
): Promise<string | null> {
  const { data } = await supabase.storage
    .from("project-media")
    .createSignedUrl(filePath, 3600);
  return data?.signedUrl ?? null;
}

async function firstProjectPhotoUrl(
  supabase: SupabaseClient,
  projectId: string,
  businessId: string
): Promise<string | null> {
  const { data: firstPhoto } = await supabase
    .from("media_assets")
    .select("file_path")
    .eq("business_id", businessId)
    .eq("project_id", projectId)
    .eq("media_type", "photo")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstPhoto?.file_path) return null;
  return signedPhotoUrl(supabase, firstPhoto.file_path);
}

async function signedMediaUrl(
  supabase: SupabaseClient,
  filePath: string
): Promise<string | null> {
  return signedPhotoUrl(supabase, filePath);
}

async function heroFromAsset(
  supabase: SupabaseClient,
  asset: Pick<
    MediaAsset,
    "file_path" | "media_type" | "media_source" | "embed_url" | "youtube_url"
  >
): Promise<HeroMedia> {
  if (asset.media_source === "youtube") {
    const embedUrl = asset.embed_url || getYouTubeEmbedUrl(asset.youtube_url || "");
    if (!embedUrl) return null;
    const posterUrl =
      getYouTubeThumbnail(asset.youtube_url || "") || null;
    return { type: "youtube", embedUrl, posterUrl };
  }

  if (!asset.file_path) return null;
  const url = await signedMediaUrl(supabase, asset.file_path);
  if (!url) return null;

  if (asset.media_type === "video") {
    return { type: "video", url };
  }
  return { type: "image", url };
}

export async function getProjectHeroMedia(
  supabase: SupabaseClient,
  project: Pick<Project, "id" | "cover_image_id" | "cover_image_url">,
  businessId: string
): Promise<HeroMedia> {
  if (project.cover_image_id) {
    const { data: asset } = await supabase
      .from("media_assets")
      .select("file_path, media_type, media_source, embed_url, youtube_url, mime_type")
      .eq("business_id", businessId)
      .eq("id", project.cover_image_id)
      .single();

    if (asset) {
      const hero = await heroFromAsset(supabase, asset);
      if (hero) return hero;
    }
  }

  if (project.cover_image_url) {
    return { type: "image", url: project.cover_image_url };
  }

  const { data: firstPhoto } = await supabase
    .from("media_assets")
    .select("file_path, media_type, media_source, embed_url, youtube_url, mime_type")
    .eq("business_id", businessId)
    .eq("project_id", project.id)
    .eq("media_type", "photo")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstPhoto) {
    return heroFromAsset(supabase, firstPhoto);
  }

  return null;
}
