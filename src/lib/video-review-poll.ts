import type { VideoReviewComment } from "@/lib/types";
import type { VideoReviewVersionRow } from "@/lib/video-reviews";
import {
  countTopLevelComments,
  enrichVideoReviewComments,
} from "@/lib/video-review-comments";
import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import type { VideoReviewPollResult } from "@/lib/video-review-poll-merge";

export type { VideoReviewPollResult } from "@/lib/video-review-poll-merge";

export async function pollVideoReviewChanges(
  db: TenantServiceClient,
  reviewId: string,
  versionId: string,
  since: string
): Promise<VideoReviewPollResult> {
  const serverTime = new Date().toISOString();

  const { data: countRows, error: countError } = await db
    .from("video_review_comments")
    .select("status, parent_comment_id")
    .eq("business_id", db.businessId)
    .eq("review_id", reviewId)
    .eq("version_id", versionId);

  if (countError) {
    throw new Error(countError.message);
  }

  const counts = countTopLevelComments((countRows ?? []) as VideoReviewComment[]);

  const { data: changedRows, error: changeError } = await db
    .from("video_review_comments")
    .select("*")
    .eq("business_id", db.businessId)
    .eq("review_id", reviewId)
    .eq("version_id", versionId)
    .gt("updated_at", since)
    .order("created_at", { ascending: true });

  if (changeError) {
    throw new Error(changeError.message);
  }

  const changes = (changedRows ?? []) as VideoReviewComment[];
  const enriched = await enrichVideoReviewComments(db, changes);

  const { data: versionRows, error: versionError } = await db
    .from("video_review_versions")
    .select("*")
    .eq("business_id", db.businessId)
    .eq("review_id", reviewId)
    .gt("created_at", since)
    .order("version_number", { ascending: true });

  if (versionError) {
    throw new Error(versionError.message);
  }

  let versions: VideoReviewVersionRow[] = (versionRows ?? []) as VideoReviewVersionRow[];
  if (versions.length) {
    const assetIds = versions.map((v) => v.media_asset_id);
    const { data: assets } = await db
      .from("media_assets")
      .select("id, title, file_name, media_type, duration_seconds")
      .eq("business_id", db.businessId)
      .in("id", assetIds);
    const assetById = new Map((assets ?? []).map((a) => [a.id as string, a]));
    versions = versions.map((v) => ({
      ...v,
      media_assets: assetById.get(v.media_asset_id) ?? null,
    }));
  }

  return {
    serverTime,
    counts,
    changes: changes.map((c) => enriched.get(c.id)!).filter(Boolean),
    versions,
  };
}
