import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isReviewAdmin } from "@/lib/video-review-access";
import { enrichVideoReviewComments } from "@/lib/video-review-comments";
import { createLazyVideoReviewComment, VideoReviewError } from "@/lib/video-reviews";
import { notifyVideoReviewEvent } from "@/lib/video-review-notifications";
import { mediaDisplayName } from "@/lib/media-display-name";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const body = await request.json();
  const projectId = body.project_id as string | undefined;
  const mediaAssetId = body.media_asset_id as string | undefined;
  const text = (body.body as string | undefined)?.trim();
  const titleOverride = (body.title as string | undefined)?.trim();

  if (!projectId || !mediaAssetId || !text) {
    return NextResponse.json(
      { error: "project_id, media_asset_id, and body are required." },
      { status: 400 }
    );
  }

  const timestampSeconds = Number(body.timestamp_seconds);
  if (!Number.isFinite(timestampSeconds)) {
    return NextResponse.json({ error: "timestamp_seconds is required." }, { status: 400 });
  }

  const hasAccess = await canAccessProject(profile, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 });
  }

  const authorKind = isReviewAdmin(profile) ? "admin" : "client";
  const isSharedCommenter = Boolean(tenant.isSharedViewer);
  if (authorKind === "client" && !profile.client_id && !isSharedCommenter) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  const { data: asset, error: assetError } = await db
    .from("media_assets")
    .select("id, project_id, media_type, title, file_name")
    .eq("id", mediaAssetId)
    .maybeSingle();

  if (assetError || !asset || asset.project_id !== projectId) {
    return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
  }
  if (asset.media_type !== "video") {
    return NextResponse.json({ error: "Only video assets support review comments." }, { status: 400 });
  }

  const title = titleOverride || mediaDisplayName(asset);

  try {
    const result = await createLazyVideoReviewComment(db, {
      projectId,
      mediaAssetId,
      title,
      createdBy: profile.id,
      authorUserId: profile.id,
      authorKind,
      body: text,
      timestampSeconds,
      pointX: body.point_x != null ? Number(body.point_x) : null,
      pointY: body.point_y != null ? Number(body.point_y) : null,
    });

    const enriched = await enrichVideoReviewComments(db, [result.comment]);

    if (authorKind === "client") {
      await notifyVideoReviewEvent("client_comment", {
        businessId: tenant.businessId,
        projectId,
        reviewId: result.reviewId,
        reviewTitle: title,
        versionId: result.versionId,
        commentId: result.commentId,
        actorUserId: profile.id,
        actorKind: "client",
        previewText: text,
      });
    }

    return NextResponse.json(
      {
        review_id: result.reviewId,
        version_id: result.versionId,
        comment_id: result.commentId,
        review_created: result.reviewCreated,
        comment: enriched.get(result.commentId),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof VideoReviewError) {
      const status =
        err.code === "asset_not_found" || err.code === "asset_project_mismatch" ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: "Could not save comment." }, { status: 500 });
  }
}
