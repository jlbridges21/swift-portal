/**
 * Narrow loader for anonymous public-link project pages.
 * ONLY accepts a link token — project id and business id come from the resolved row.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProjectHeroMedia } from "@/lib/cover";
import { filterClientMedia, filterClientTours } from "@/lib/client-media";
import { getAppSettings } from "@/lib/app-settings";
import {
  filterMediaForVideoReviewDelivery,
  loadVideoReviewVersionMap,
} from "@/lib/video-review-media";
import { listProjectVideoReviews } from "@/lib/video-reviews";
import { resolvePublicLinkProject, type PublicLinkProjectContext } from "@/lib/project-link-access";
import type { MediaAsset, MediaFolder, Tour } from "@/lib/types";
import type { VideoReviewListItem } from "@/lib/video-reviews";

export type PublicProjectViewData = {
  ctx: PublicLinkProjectContext;
  hero: Awaited<ReturnType<typeof getProjectHeroMedia>>;
  photos: MediaAsset[];
  videos: MediaAsset[];
  documents: MediaAsset[];
  tours: Tour[];
  mediaFolders: MediaFolder[];
  videoReviews: VideoReviewListItem[];
  requireDeliveredForDownloads: boolean;
};

export async function loadPublicProjectView(
  token: string,
  hostBusinessId?: string | null
): Promise<PublicProjectViewData | null> {
  const ctx = await resolvePublicLinkProject(token, hostBusinessId);
  if (!ctx) return null;

  const { projectId, businessId } = ctx;
  const raw = await createServiceClient();
  const db = await createTenantServiceClient(businessId);

  const [{ data: media }, { data: tours }, { data: mediaFolders }] = await Promise.all([
    db
      .from("media_assets")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order", { ascending: true }),
    db.from("tours").select("*").eq("project_id", projectId).order("display_order"),
    db.from("media_folders").select("*").eq("project_id", projectId).order("display_order", {
      ascending: true,
    }),
  ]);

  const versionMap = await loadVideoReviewVersionMap(db, projectId);
  const videoReviews = await listProjectVideoReviews(db, projectId);
  const visibleMedia = filterClientMedia(
    filterMediaForVideoReviewDelivery(media ?? [], versionMap, false)
  );
  const visibleTours = filterClientTours(tours ?? []);
  const hero = await getProjectHeroMedia(raw, ctx.project as never, businessId);
  const appSettings = await getAppSettings(businessId);

  return {
    ctx,
    hero,
    photos: visibleMedia.filter((m) => m.media_type === "photo"),
    videos: visibleMedia.filter((m) => m.media_type === "video"),
    documents: visibleMedia.filter((m) => m.media_type === "document"),
    tours: visibleTours,
    mediaFolders: mediaFolders ?? [],
    videoReviews,
    requireDeliveredForDownloads: appSettings.payments.requireDeliveredForDownloads,
  };
}

/** Verify a media asset belongs to the public-link project (both ids from resolved ctx). */
export async function loadPublicLinkMediaAsset(
  ctx: PublicLinkProjectContext,
  mediaAssetId: string
) {
  const db = await createTenantServiceClient(ctx.businessId);
  const { data: asset } = await db
    .from("media_assets")
    .select("*")
    .eq("id", mediaAssetId)
    .eq("project_id", ctx.projectId)
    .maybeSingle();
  return asset;
}
