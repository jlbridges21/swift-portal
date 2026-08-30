import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import { canAccessProject } from "@/lib/project-access";
import type { Profile, VideoReview, VideoReviewComment, VideoReviewVersion } from "@/lib/types";

export class VideoReviewAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number = 404
  ) {
    super(message);
    this.name = "VideoReviewAccessError";
  }
}

export function isReviewAdmin(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "super_admin";
}

export function assertCanResolveComment(profile: Profile): void {
  if (!isReviewAdmin(profile)) {
    throw new VideoReviewAccessError(
      "Only the business team can mark feedback as resolved.",
      403
    );
  }
}

export async function assertReviewProjectAccess(
  profile: Profile,
  projectId: string
): Promise<void> {
  if (isReviewAdmin(profile)) return;
  const ok = await canAccessProject(profile, projectId);
  if (!ok) {
    throw new VideoReviewAccessError("Review not found or access denied.", 404);
  }
}

export async function loadReviewForAccess(
  db: TenantServiceClient,
  profile: Profile,
  reviewId: string,
  expectedProjectId?: string
): Promise<VideoReview> {
  const { data: review, error } = await db
    .from("video_reviews")
    .select("*")
    .eq("business_id", db.businessId)
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !review) {
    throw new VideoReviewAccessError("Review not found or access denied.", 404);
  }

  if (expectedProjectId && review.project_id !== expectedProjectId) {
    throw new VideoReviewAccessError("Review not found or access denied.", 404);
  }

  await assertReviewProjectAccess(profile, review.project_id);
  return review as VideoReview;
}

export async function loadVersionForReview(
  db: TenantServiceClient,
  profile: Profile,
  reviewId: string,
  versionId: string
): Promise<VideoReviewVersion> {
  const review = await loadReviewForAccess(db, profile, reviewId);

  const { data: version, error } = await db
    .from("video_review_versions")
    .select("*")
    .eq("business_id", db.businessId)
    .eq("id", versionId)
    .eq("review_id", review.id)
    .maybeSingle();

  if (error || !version) {
    throw new VideoReviewAccessError("Version not found or access denied.", 404);
  }

  return version as VideoReviewVersion;
}

export async function loadCommentForReview(
  db: TenantServiceClient,
  profile: Profile,
  commentId: string,
  expectedReviewId?: string
): Promise<VideoReviewComment> {
  const { data: comment, error } = await db
    .from("video_review_comments")
    .select("*")
    .eq("business_id", db.businessId)
    .eq("id", commentId)
    .maybeSingle();

  if (error || !comment) {
    throw new VideoReviewAccessError("Comment not found or access denied.", 404);
  }

  if (expectedReviewId && comment.review_id !== expectedReviewId) {
    throw new VideoReviewAccessError("Comment not found or access denied.", 404);
  }

  await loadReviewForAccess(db, profile, comment.review_id, comment.project_id);
  return comment as VideoReviewComment;
}
