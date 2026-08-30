import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import type { VideoReview, VideoReviewComment, VideoReviewVersion } from "@/lib/types";

export class VideoReviewError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "VideoReviewError";
  }
}

export interface CreateVideoReviewInput {
  projectId: string;
  mediaAssetId: string;
  title: string;
  createdBy: string;
  notes?: string | null;
}

export interface AddVideoReviewVersionInput {
  reviewId: string;
  mediaAssetId: string;
  uploadedBy: string;
  notes?: string | null;
}

/** Create a review from an existing project video and register it as version 1. */
export async function createVideoReviewFromAsset(
  db: TenantServiceClient,
  input: CreateVideoReviewInput
): Promise<{ review: VideoReview; version: VideoReviewVersion }> {
  const { data: asset, error: assetError } = await db
    .from("media_assets")
    .select("id, project_id, media_type, business_id")
    .eq("id", input.mediaAssetId)
    .maybeSingle();

  if (assetError || !asset) {
    throw new VideoReviewError("Media asset not found.", "asset_not_found");
  }
  if (asset.project_id !== input.projectId) {
    throw new VideoReviewError("Media asset does not belong to this project.", "asset_project_mismatch");
  }
  if (asset.media_type !== "video") {
    throw new VideoReviewError("Only video assets can start a video review.", "asset_not_video");
  }

  const { data: existingVersion } = await db
    .from("video_review_versions")
    .select("id")
    .eq("media_asset_id", input.mediaAssetId)
    .maybeSingle();

  if (existingVersion) {
    throw new VideoReviewError("This video is already linked to a review version.", "asset_already_in_review");
  }

  const { data: review, error: reviewError } = await db
    .from("video_reviews")
    .insert({
      project_id: input.projectId,
      title: input.title.trim(),
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (reviewError || !review) {
    throw new VideoReviewError(reviewError?.message ?? "Could not create review.", "review_insert_failed");
  }

  const { data: version, error: versionError } = await db
    .from("video_review_versions")
    .insert({
      review_id: review.id,
      media_asset_id: input.mediaAssetId,
      version_number: 1,
      uploaded_by: input.createdBy,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (versionError || !version) {
    await db.from("video_reviews").delete().eq("id", review.id);
    throw new VideoReviewError(versionError?.message ?? "Could not create version.", "version_insert_failed");
  }

  return { review: review as VideoReview, version: version as VideoReviewVersion };
}

/** Append the next sequential version to an existing review. Version numbers are immutable. */
export async function addVideoReviewVersion(
  db: TenantServiceClient,
  input: AddVideoReviewVersionInput
): Promise<VideoReviewVersion> {
  const { data: review, error: reviewError } = await db
    .from("video_reviews")
    .select("id, project_id")
    .eq("id", input.reviewId)
    .maybeSingle();

  if (reviewError || !review) {
    throw new VideoReviewError("Review not found.", "review_not_found");
  }

  const { data: asset, error: assetError } = await db
    .from("media_assets")
    .select("id, project_id, media_type")
    .eq("id", input.mediaAssetId)
    .maybeSingle();

  if (assetError || !asset) {
    throw new VideoReviewError("Media asset not found.", "asset_not_found");
  }
  if (asset.project_id !== review.project_id) {
    throw new VideoReviewError("Media asset does not belong to this review's project.", "asset_project_mismatch");
  }
  if (asset.media_type !== "video") {
    throw new VideoReviewError("Only video assets can be added as review versions.", "asset_not_video");
  }

  const { data: existingVersion } = await db
    .from("video_review_versions")
    .select("id")
    .eq("media_asset_id", input.mediaAssetId)
    .maybeSingle();

  if (existingVersion) {
    throw new VideoReviewError("This video is already linked to a review version.", "asset_already_in_review");
  }

  const { data: latest, error: latestError } = await db
    .from("video_review_versions")
    .select("version_number")
    .eq("review_id", input.reviewId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new VideoReviewError(latestError.message, "version_lookup_failed");
  }

  const nextVersionNumber = (latest?.version_number ?? 0) + 1;

  const { data: version, error: versionError } = await db
    .from("video_review_versions")
    .insert({
      review_id: input.reviewId,
      media_asset_id: input.mediaAssetId,
      version_number: nextVersionNumber,
      uploaded_by: input.uploadedBy,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (versionError || !version) {
    throw new VideoReviewError(versionError?.message ?? "Could not add version.", "version_insert_failed");
  }

  return version as VideoReviewVersion;
}

/**
 * Remove a version row (and its comments via ON DELETE CASCADE) before deleting the media asset.
 * Does not delete the review or the underlying media asset.
 */
export async function removeVideoReviewVersion(
  db: TenantServiceClient,
  versionId: string
): Promise<void> {
  const { data: version, error: lookupError } = await db
    .from("video_review_versions")
    .select("id, review_id")
    .eq("id", versionId)
    .maybeSingle();

  if (lookupError || !version) {
    throw new VideoReviewError("Version not found.", "version_not_found");
  }

  const { error: deleteError } = await db.from("video_review_versions").delete().eq("id", versionId);
  if (deleteError) {
    throw new VideoReviewError(deleteError.message, "version_delete_failed");
  }

  const { count } = await db
    .from("video_review_versions")
    .select("id", { count: "exact", head: true })
    .eq("review_id", version.review_id);

  if (count === 0) {
    await db.from("video_reviews").delete().eq("id", version.review_id);
  }
}

export type { VideoReview, VideoReviewVersion, VideoReviewComment };

export interface VideoReviewVersionRow extends VideoReviewVersion {
  media_assets?: {
    id: string;
    title: string | null;
    file_name: string | null;
    media_type: string;
    duration_seconds: number | null;
  } | null;
}

export interface VideoReviewDetail {
  review: VideoReview;
  versions: VideoReviewVersionRow[];
}

export interface VideoReviewListItem {
  review: VideoReview;
  versions: Pick<VideoReviewVersion, "id" | "version_number" | "media_asset_id" | "created_at">[];
  latestVersionNumber: number;
}

export async function listProjectVideoReviews(
  db: TenantServiceClient,
  projectId: string
): Promise<VideoReviewListItem[]> {
  const { data: reviews, error } = await db
    .from("video_reviews")
    .select("id, business_id, project_id, title, created_by, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error || !reviews?.length) return [];

  const reviewIds = reviews.map((r) => r.id as string);
  const { data: versions } = await db
    .from("video_review_versions")
    .select("id, review_id, version_number, media_asset_id, created_at")
    .in("review_id", reviewIds)
    .order("version_number", { ascending: true });

  const byReview = new Map<string, VideoReviewListItem["versions"]>();
  for (const row of versions ?? []) {
    const list = byReview.get(row.review_id as string) ?? [];
    list.push({
      id: row.id as string,
      version_number: row.version_number as number,
      media_asset_id: row.media_asset_id as string,
      created_at: row.created_at as string,
    });
    byReview.set(row.review_id as string, list);
  }

  return reviews.map((review) => {
    const v = byReview.get(review.id as string) ?? [];
    const latestVersionNumber = v.reduce((max, row) => Math.max(max, row.version_number), 0);
    return {
      review: review as VideoReview,
      versions: v,
      latestVersionNumber,
    };
  });
}

export async function getVideoReviewDetail(
  db: TenantServiceClient,
  reviewId: string
): Promise<VideoReviewDetail | null> {
  const { data: review, error } = await db
    .from("video_reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !review) return null;

  const { data: versions, error: versionsError } = await db
    .from("video_review_versions")
    .select("*")
    .eq("review_id", reviewId)
    .order("version_number", { ascending: true });

  if (versionsError || !versions?.length) {
    return { review: review as VideoReview, versions: [] };
  }

  const assetIds = versions.map((v) => v.media_asset_id as string);
  const { data: assets } = await db
    .from("media_assets")
    .select("id, title, file_name, media_type, duration_seconds")
    .in("id", assetIds);

  const assetById = new Map((assets ?? []).map((a) => [a.id as string, a]));

  return {
    review: review as VideoReview,
    versions: versions.map((v) => ({
      ...(v as VideoReviewVersion),
      media_assets: assetById.get(v.media_asset_id as string) ?? null,
    })),
  };
}

export interface CreateVideoReviewCommentInput {
  reviewId: string;
  versionId: string;
  projectId: string;
  authorUserId: string;
  authorKind: "client" | "admin";
  body: string;
  timestampSeconds: number;
  pointX?: number | null;
  pointY?: number | null;
}

export async function createVideoReviewComment(
  db: TenantServiceClient,
  input: CreateVideoReviewCommentInput
): Promise<VideoReviewComment> {
  const body = input.body.trim();
  if (!body) {
    throw new VideoReviewError("Comment body is required.", "comment_body_required");
  }
  if (!Number.isFinite(input.timestampSeconds) || input.timestampSeconds < 0) {
    throw new VideoReviewError("A valid timestamp is required.", "comment_timestamp_required");
  }

  const hasPointX = input.pointX != null;
  const hasPointY = input.pointY != null;
  if (hasPointX !== hasPointY) {
    throw new VideoReviewError("Point coordinates must be provided as a pair.", "comment_point_pair");
  }

  const { data: version } = await db
    .from("video_review_versions")
    .select("id, review_id")
    .eq("id", input.versionId)
    .eq("review_id", input.reviewId)
    .maybeSingle();

  if (!version) {
    throw new VideoReviewError("Version not found for this review.", "version_not_found");
  }

  const { data: review } = await db
    .from("video_reviews")
    .select("project_id")
    .eq("id", input.reviewId)
    .maybeSingle();

  if (!review || review.project_id !== input.projectId) {
    throw new VideoReviewError("Review project mismatch.", "review_project_mismatch");
  }

  const { data: comment, error } = await db
    .from("video_review_comments")
    .insert({
      review_id: input.reviewId,
      version_id: input.versionId,
      project_id: input.projectId,
      author_user_id: input.authorUserId,
      author_kind: input.authorKind,
      body,
      timestamp_seconds: input.timestampSeconds,
      point_x: hasPointX ? input.pointX : null,
      point_y: hasPointY ? input.pointY : null,
    })
    .select()
    .single();

  if (error || !comment) {
    throw new VideoReviewError(error?.message ?? "Could not save comment.", "comment_insert_failed");
  }

  return comment as VideoReviewComment;
}

export async function getVideoReviewVersionLink(
  db: TenantServiceClient,
  mediaAssetId: string
): Promise<
  | {
      versionId: string;
      reviewId: string;
      reviewTitle: string;
      versionNumber: number;
      commentCount: number;
    }
  | null
> {
  const { data: version } = await db
    .from("video_review_versions")
    .select("id, review_id, version_number")
    .eq("media_asset_id", mediaAssetId)
    .maybeSingle();

  if (!version) return null;

  const { data: review } = await db
    .from("video_reviews")
    .select("title")
    .eq("id", version.review_id)
    .maybeSingle();

  const reviewTitle = (review?.title as string | undefined) ?? "Video review";

  const { count } = await db
    .from("video_review_comments")
    .select("id", { count: "exact", head: true })
    .eq("version_id", version.id);

  return {
    versionId: version.id as string,
    reviewId: version.review_id as string,
    reviewTitle,
    versionNumber: version.version_number as number,
    commentCount: count ?? 0,
  };
}

export async function removeVideoReviewVersionAndAsset(
  db: TenantServiceClient,
  versionId: string,
  deleteAsset: boolean
): Promise<void> {
  const { data: version } = await db
    .from("video_review_versions")
    .select("id, review_id, media_asset_id")
    .eq("id", versionId)
    .maybeSingle();

  if (!version) {
    throw new VideoReviewError("Version not found.", "version_not_found");
  }

  const mediaAssetId = version.media_asset_id as string;
  await removeVideoReviewVersion(db, versionId);

  if (deleteAsset) {
    const { data: asset } = await db
      .from("media_assets")
      .select("*")
      .eq("id", mediaAssetId)
      .maybeSingle();

    if (asset) {
      const hasStorageObject =
        Boolean(asset.file_path) &&
        asset.media_source !== "youtube" &&
        asset.media_source !== "kuula" &&
        asset.media_source !== "external";

      if (hasStorageObject) {
        const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
        await db.raw.storage.from(bucket).remove([asset.file_path]);
      }
      await db.from("media_assets").delete().eq("id", mediaAssetId);
    }
  }
}
