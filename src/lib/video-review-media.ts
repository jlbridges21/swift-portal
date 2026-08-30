import type { TenantServiceClient } from "@/lib/supabase/tenant-service";

export interface VideoReviewVersionInfo {
  reviewId: string;
  versionNumber: number;
  isLatest: boolean;
}

/**
 * Map media_asset_id → review version metadata for a project.
 * Empty map when the project has no video reviews (no-op for gallery/ZIP filters).
 */
export async function loadVideoReviewVersionMap(
  db: TenantServiceClient,
  projectId: string
): Promise<Map<string, VideoReviewVersionInfo>> {
  const { data: reviews, error: reviewsError } = await db
    .from("video_reviews")
    .select("id")
    .eq("project_id", projectId);

  if (reviewsError || !reviews?.length) {
    return new Map();
  }

  const reviewIds = reviews.map((r) => r.id as string);
  const { data: versions, error: versionsError } = await db
    .from("video_review_versions")
    .select("review_id, media_asset_id, version_number")
    .in("review_id", reviewIds);

  if (versionsError || !versions?.length) {
    return new Map();
  }

  const latestByReview = new Map<string, number>();
  for (const row of versions) {
    const reviewId = row.review_id as string;
    const versionNumber = row.version_number as number;
    const current = latestByReview.get(reviewId) ?? 0;
    if (versionNumber > current) {
      latestByReview.set(reviewId, versionNumber);
    }
  }

  const map = new Map<string, VideoReviewVersionInfo>();
  for (const row of versions) {
    const reviewId = row.review_id as string;
    const versionNumber = row.version_number as number;
    map.set(row.media_asset_id as string, {
      reviewId,
      versionNumber,
      isLatest: versionNumber === latestByReview.get(reviewId),
    });
  }

  return map;
}

/**
 * Gallery / ZIP visibility for review-linked video assets.
 *
 * - Projects with no reviews: unchanged (map empty → pass-through).
 * - Non-review assets: unchanged.
 * - Clients: latest version per review only; older versions hidden from normal gallery/ZIP.
 * - Admins: all versions visible (full post-production history).
 */
export function filterMediaForVideoReviewDelivery<T extends { id: string }>(
  assets: T[],
  versionMap: Map<string, VideoReviewVersionInfo>,
  isAdmin: boolean
): T[] {
  if (isAdmin || versionMap.size === 0) {
    return assets;
  }

  return assets.filter((asset) => {
    const info = versionMap.get(asset.id);
    if (!info) return true;
    return info.isLatest;
  });
}
