import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { addVideoReviewVersion, VideoReviewError } from "@/lib/video-reviews";
import { notifyVideoReviewEvent } from "@/lib/video-review-notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const { id: reviewId } = await params;
  const body = await request.json();
  const mediaAssetId = body.media_asset_id as string | undefined;

  if (!mediaAssetId) {
    return NextResponse.json({ error: "media_asset_id is required." }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  try {
    const version = await addVideoReviewVersion(db, {
      reviewId,
      mediaAssetId,
      uploadedBy: profile.id,
      notes: body.notes ?? null,
    });

    const { data: review } = await db
      .from("video_reviews")
      .select("title, project_id")
      .eq("id", reviewId)
      .maybeSingle();

    if (review) {
      await notifyVideoReviewEvent("new_version", {
        businessId: tenant.businessId,
        projectId: review.project_id as string,
        reviewId,
        reviewTitle: review.title as string,
        versionId: version.id,
        actorUserId: profile.id,
        actorKind: "admin",
        versionNumber: version.version_number,
      });
    }

    return NextResponse.json(version, { status: 201 });
  } catch (err) {
    if (err instanceof VideoReviewError) {
      const status = err.code === "review_not_found" || err.code === "asset_not_found" ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : "Could not add review version.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
