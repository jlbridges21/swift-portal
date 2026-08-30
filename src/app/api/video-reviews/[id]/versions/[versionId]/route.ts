import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { canAccessProject } from "@/lib/project-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isReviewAdmin, loadReviewForAccess, VideoReviewAccessError } from "@/lib/video-review-access";
import {
  getVideoReviewVersionLink,
  removeVideoReviewVersionAndAsset,
  VideoReviewError,
} from "@/lib/video-reviews";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const profile = await getProfile();
  if (!profile || !isReviewAdmin(profile)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const { id: reviewId, versionId } = await params;
  const deleteAsset = new URL(request.url).searchParams.get("delete_asset") === "1";
  const db = await createTenantServiceClient(tenant.businessId);

  try {
    await loadReviewForAccess(db, profile, reviewId);
    await removeVideoReviewVersionAndAsset(db, versionId, deleteAsset);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof VideoReviewAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof VideoReviewError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not remove version." }, { status: 500 });
  }
}

/** Lookup review link for a media asset (admin delete UX). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  void request;
  void params;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
