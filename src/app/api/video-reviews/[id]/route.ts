import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { loadReviewForAccess, VideoReviewAccessError } from "@/lib/video-review-access";
import { getVideoReviewDetail } from "@/lib/video-reviews";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const { id } = await params;
  const db = await createTenantServiceClient(tenant.businessId);

  try {
    await loadReviewForAccess(db, profile, id);
    const detail = await getVideoReviewDetail(db, id);
    if (!detail) {
      return NextResponse.json({ error: "Review not found or access denied." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof VideoReviewAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not load review." }, { status: 500 });
  }
}
