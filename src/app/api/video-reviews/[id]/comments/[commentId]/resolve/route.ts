import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  assertCanResolveComment,
  loadCommentForReview,
  loadReviewForAccess,
  VideoReviewAccessError,
} from "@/lib/video-review-access";
import {
  enrichVideoReviewComments,
  resolveVideoReviewComment,
} from "@/lib/video-review-comments";
import { VideoReviewError } from "@/lib/video-reviews";
import { notifyVideoReviewEvent } from "@/lib/video-review-notifications";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertCanResolveComment(profile);
  } catch (err) {
    if (err instanceof VideoReviewAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const { id: reviewId, commentId } = await params;
  const db = await createTenantServiceClient(tenant.businessId);

  try {
    const review = await loadReviewForAccess(db, profile, reviewId);
    await loadCommentForReview(db, profile, commentId, reviewId);
    const result = await resolveVideoReviewComment(
      db,
      reviewId,
      commentId,
      profile.id,
      review.project_id
    );
    const enriched = await enrichVideoReviewComments(db, [result.comment]);
    if (result.changed) {
      await notifyVideoReviewEvent("admin_resolved", {
        businessId: tenant.businessId,
        projectId: review.project_id,
        reviewId,
        reviewTitle: review.title,
        versionId: result.comment.version_id,
        commentId,
        actorUserId: profile.id,
        actorKind: "admin",
      });
    }
    return NextResponse.json({
      comment: enriched.get(result.comment.id),
      changed: result.changed,
    });
  } catch (err) {
    if (err instanceof VideoReviewAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof VideoReviewError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not resolve comment." }, { status: 500 });
  }
}
