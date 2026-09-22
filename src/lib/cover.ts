import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAsset, Project } from "@/lib/types";
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from "@/lib/youtube";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export type HeroMedia =
  | { type: "image"; url: string }
  | { type: "video"; url: string }
  | { type: "youtube"; embedUrl: string; posterUrl: string | null }
  | null;

export type GetProjectHeroOptions = {
  /**
   * When false, do not fall back to the first gallery photo.
   * An explicitly set cover_image_id / cover_image_url still shows.
   * Default true (legacy behavior).
   */
  photosSectionVisible?: boolean;
};

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
  businessId: string,
  options?: GetProjectHeroOptions
): Promise<string | null> {
  const hero = await getProjectHeroMedia(supabase, project, businessId, options);
  if (hero?.type === "image") return hero.url;
  if (hero?.type === "youtube") return hero.posterUrl;
  if (project.cover_image_url) return project.cover_image_url;
  if (options?.photosSectionVisible === false) return null;
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

/**
 * Sign with service role after the asset row was authorized via `supabase`.
 * User-scoped createSignedUrl fails for many clients on tenant-prefixed paths
 * (storage RLS / missing JWT business claim) while the gallery download API works.
 */
async function signedPhotoUrl(businessId: string, filePath: string): Promise<string | null> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.raw.storage
    .from("project-media")
    .createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) {
    console.warn("[cover] signed URL failed", { filePath, error: error?.message });
    return null;
  }
  return data.signedUrl;
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
  return signedPhotoUrl(businessId, firstPhoto.file_path);
}

async function heroFromAsset(
  businessId: string,
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
  const url = await signedPhotoUrl(businessId, asset.file_path);
  if (!url) return null;

  if (asset.media_type === "video") {
    return { type: "video", url };
  }
  return { type: "image", url };
}

/**
 * Resolve project hero media.
 *
 * Explicit cover (cover_image_id / cover_image_url) always wins when readable.
 * First-photo fallback only runs when the photo gallery section is visible
 * (or when visibility is unspecified — default true).
 */
export async function getProjectHeroMedia(
  supabase: SupabaseClient,
  project: Pick<Project, "id" | "cover_image_id" | "cover_image_url">,
  businessId: string,
  options?: GetProjectHeroOptions
): Promise<HeroMedia> {
  const photosSectionVisible = options?.photosSectionVisible !== false;

  if (project.cover_image_id) {
    let asset:
      | Pick<
          MediaAsset,
          "file_path" | "media_type" | "media_source" | "embed_url" | "youtube_url"
        >
      | null = null;

    const { data: scoped } = await supabase
      .from("media_assets")
      .select("file_path, media_type, media_source, embed_url, youtube_url, mime_type")
      .eq("business_id", businessId)
      .eq("id", project.cover_image_id)
      .maybeSingle();
    asset = scoped;

    // Project access is already authorized by the caller. If RLS hid the cover
    // row (e.g. shared viewer edge cases), load it with tenant service role.
    if (!asset) {
      const db = await createTenantServiceClient(businessId);
      const { data: privileged } = await db
        .from("media_assets")
        .select("file_path, media_type, media_source, embed_url, youtube_url, mime_type")
        .eq("id", project.cover_image_id)
        .maybeSingle();
      asset = privileged;
    }

    if (asset) {
      const hero = await heroFromAsset(businessId, asset);
      if (hero) return hero;
    }
  }

  if (project.cover_image_url) {
    return { type: "image", url: project.cover_image_url };
  }

  if (!photosSectionVisible) {
    return null;
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
    return heroFromAsset(businessId, firstPhoto);
  }

  return null;
}
