import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { loadReviewForAccess, VideoReviewAccessError } from "@/lib/video-review-access";
import {
  enrichVideoReviewComments,
  updateVideoReviewCommentMark,
} from "@/lib/video-review-comments";
import { VideoReviewError } from "@/lib/video-reviews";

/**
 * Update point mark on a top-level comment. Author-only.
 * PATCH /api/video-reviews/[id]/comments/[commentId]/mark
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const { id: reviewId, commentId } = await params;
  const body = await request.json();
  const pointX = body.point_x != null ? Number(body.point_x) : null;
  const pointY = body.point_y != null ? Number(body.point_y) : null;

  const db = await createTenantServiceClient(tenant.businessId);

  try {
    await loadReviewForAccess(db, profile, reviewId);
    const comment = await updateVideoReviewCommentMark(
      db,
      reviewId,
      commentId,
      profile.id,
      pointX,
      pointY
    );
    const enriched = await enrichVideoReviewComments(db, [comment]);
    return NextResponse.json(enriched.get(comment.id));
  } catch (err) {
    if (err instanceof VideoReviewAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof VideoReviewError) {
      const status = err.code === "mark_edit_forbidden" ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: "Could not update mark." }, { status: 500 });
  }
}
