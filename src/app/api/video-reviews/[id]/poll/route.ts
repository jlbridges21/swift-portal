import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { loadVersionForReview, VideoReviewAccessError } from "@/lib/video-review-access";
import { pollVideoReviewChanges } from "@/lib/video-review-poll";
import { VideoReviewError } from "@/lib/video-reviews";

/**
 * Incremental poll for live review updates.
 * GET /api/video-reviews/[id]/poll?version_id=…&since=ISO8601
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const { id: reviewId } = await params;
  const url = new URL(request.url);
  const versionId = url.searchParams.get("version_id");
  const since = url.searchParams.get("since");

  if (!versionId) {
    return NextResponse.json({ error: "version_id required" }, { status: 400 });
  }
  if (!since) {
    return NextResponse.json({ error: "since required" }, { status: 400 });
  }
  if (Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "since must be a valid ISO timestamp" }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  try {
    await loadVersionForReview(db, profile, reviewId, versionId);
    const result = await pollVideoReviewChanges(db, reviewId, versionId, since);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VideoReviewAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof VideoReviewError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not poll review." }, { status: 500 });
  }
}
