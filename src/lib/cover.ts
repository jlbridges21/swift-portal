import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAsset, Project } from "@/lib/types";
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from "@/lib/youtube";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { signMediaThumbnailUrl, type ThumbSignAsset } from "@/lib/media-signed-thumbs";

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

type PosterAsset = ThumbSignAsset & Pick<MediaAsset, "youtube_url">;

const POSTER_ASSET_COLUMNS =
  "id, business_id, file_path, file_name, file_size, mime_type, media_type, media_source, thumbnail_url, youtube_url";

async function posterUrlForAsset(
  storage: SupabaseClient,
  asset: PosterAsset
): Promise<string | null> {
  if (asset.media_source === "youtube") return getYouTubeThumbnail(asset.youtube_url || "") || null;
  return signMediaThumbnailUrl(storage, "project-media", asset);
}

/**
 * Card-sized hero posters for many projects at once (Client View, client
 * profile). Same precedence as getProjectHeroPosterUrl — the project's chosen
 * cover (cover_image_id), then cover_image_url, then the first gallery photo —
 * but signs thumbnails instead of full-size originals so a board of cards
 * stays light. Callers must pass only projects the viewer may already see.
 */
export async function getProjectHeroPosterUrlMap(
  projects: Pick<Project, "id" | "cover_image_id" | "cover_image_url">[],
  businessId: string
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  if (projects.length === 0) return result;
  const db = await createTenantServiceClient(businessId);

  const coverIds = projects.map((p) => p.cover_image_id).filter((id): id is string => Boolean(id));
  const coverById = new Map<string, PosterAsset>();
  if (coverIds.length) {
    const { data } = await db.from("media_assets").select(POSTER_ASSET_COLUMNS).in("id", coverIds);
    for (const row of (data ?? []) as PosterAsset[]) coverById.set(row.id, row);
  }

  await Promise.all(
    projects.map(async (project) => {
      const cover = project.cover_image_id ? coverById.get(project.cover_image_id) : undefined;
      if (cover) {
        const url = await posterUrlForAsset(db.raw, cover);
        if (url) {
          result[project.id] = url;
          return;
        }
      }
      if (project.cover_image_url) {
        result[project.id] = project.cover_image_url;
        return;
      }
      const { data: first } = await db
        .from("media_assets")
        .select(POSTER_ASSET_COLUMNS)
        .eq("project_id", project.id)
        .eq("media_type", "photo")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      result[project.id] = first ? await posterUrlForAsset(db.raw, first as PosterAsset) : null;
    })
  );

  return result;
}

/** Long edge for the New interface project hero banner (wide, so the 400px card thumb is too soft). */
const BANNER_TRANSFORM_WIDTH = 1600;

/**
 * Banner-sized cover for the business project page. Same precedence as the card posters —
 * chosen cover (cover_image_id), then cover_image_url, then the first gallery photo — but
 * photos are signed at banner width. Falls back to the card poster for videos / YouTube.
 * Business-side only: callers must already be authorized for the project.
 */
export async function getProjectHeroBannerUrl(
  project: Pick<Project, "id" | "cover_image_id" | "cover_image_url">,
  businessId: string
): Promise<string | null> {
  const db = await createTenantServiceClient(businessId);
  let asset: PosterAsset | null = null;
  if (project.cover_image_id) {
    const { data } = await db
      .from("media_assets")
      .select(POSTER_ASSET_COLUMNS)
      .eq("id", project.cover_image_id)
      .maybeSingle();
    asset = (data as PosterAsset | null) ?? null;
  }
  if (!asset && project.cover_image_url) return project.cover_image_url;
  if (!asset) {
    const { data } = await db
      .from("media_assets")
      .select(POSTER_ASSET_COLUMNS)
      .eq("project_id", project.id)
      .eq("media_type", "photo")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    asset = (data as PosterAsset | null) ?? null;
  }
  if (!asset) return null;
  if (asset.media_type === "photo" && asset.media_source !== "youtube" && asset.file_path) {
    const size = asset.file_size ?? 0;
    const canTransform = size > 0 && size <= 25 * 1024 * 1024;
    const { data, error } = await db.raw.storage.from("project-media").createSignedUrl(
      asset.file_path,
      3600,
      canTransform ? { transform: { width: BANNER_TRANSFORM_WIDTH, quality: 75 } } : undefined
    );
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return posterUrlForAsset(db.raw, asset);
}
