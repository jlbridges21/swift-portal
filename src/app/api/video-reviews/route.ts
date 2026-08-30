import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { canAccessProject } from "@/lib/project-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isReviewAdmin } from "@/lib/video-review-access";
import {
  createVideoReviewFromAsset,
  listProjectVideoReviews,
  VideoReviewError,
} from "@/lib/video-reviews";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const projectId = new URL(request.url).searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const ok = await canAccessProject(profile, projectId);
  if (!ok) {
    return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 });
  }

  const db = await createTenantServiceClient(tenant.businessId);
  const reviews = await listProjectVideoReviews(db, projectId);
  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !isReviewAdmin(profile)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const body = await request.json();
  const projectId = body.project_id as string | undefined;
  const mediaAssetId = body.media_asset_id as string | undefined;
  const title = (body.title as string | undefined)?.trim();

  if (!projectId || !mediaAssetId || !title) {
    return NextResponse.json(
      { error: "project_id, media_asset_id, and title are required." },
      { status: 400 }
    );
  }

  const hasAccess = await canAccessProject(profile, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  try {
    const result = await createVideoReviewFromAsset(db, {
      projectId,
      mediaAssetId,
      title,
      createdBy: profile.id,
      notes: body.notes ?? null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof VideoReviewError) {
      const status = err.code === "asset_not_found" || err.code === "review_not_found" ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : "Could not create video review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
