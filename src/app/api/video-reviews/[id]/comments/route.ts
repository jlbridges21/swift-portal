import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  isReviewAdmin,
  loadReviewForAccess,
  loadVersionForReview,
  VideoReviewAccessError,
} from "@/lib/video-review-access";
import {
  buildCommentThreads,
  createVideoReviewReply,
  enrichVideoReviewComments,
  filterTopLevelForView,
  listVideoReviewCommentsForVersion,
  type VideoReviewCommentView,
} from "@/lib/video-review-comments";
import { createVideoReviewComment, VideoReviewError } from "@/lib/video-reviews";
import { notifyVideoReviewEvent } from "@/lib/video-review-notifications";

function parseView(raw: string | null): VideoReviewCommentView {
  if (raw === "resolved" || raw === "all") return raw;
  return "unresolved";
}

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
  const view = parseView(url.searchParams.get("view"));

  if (!versionId) {
    return NextResponse.json({ error: "version_id required" }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  try {
    await loadVersionForReview(db, profile, reviewId, versionId);
    const { comments, counts } = await listVideoReviewCommentsForVersion(db, reviewId, versionId);
    const enriched = await enrichVideoReviewComments(db, comments);
    const threads = buildCommentThreads(comments, enriched, view);
    const markerComments = filterTopLevelForView(comments, view).map((c) => enriched.get(c.id)!);

    return NextResponse.json({ threads, counts, markerComments, view });
  } catch (err) {
    if (err instanceof VideoReviewAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof VideoReviewError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not load comments." }, { status: 500 });
  }
}

export async function POST(
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
  const body = await request.json();
  const versionId = body.version_id as string | undefined;
  const parentCommentId = body.parent_comment_id as string | undefined;
  const text = (body.body as string | undefined)?.trim();

  if (!text) {
    return NextResponse.json({ error: "body is required." }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);

  try {
    const review = await loadReviewForAccess(db, profile, reviewId);
    const authorKind = isReviewAdmin(profile) ? "admin" : "client";
    if (authorKind === "client" && !profile.client_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (parentCommentId) {
      const reply = await createVideoReviewReply(db, {
        reviewId,
        parentCommentId,
        authorUserId: profile.id,
        authorKind,
        body: text,
      });
      const enriched = await enrichVideoReviewComments(db, [reply]);
      if (authorKind === "admin") {
        await notifyVideoReviewEvent("business_reply", {
          businessId: tenant.businessId,
          projectId: review.project_id,
          reviewId,
          reviewTitle: review.title,
          versionId: reply.version_id,
          commentId: parentCommentId,
          actorUserId: profile.id,
          actorKind: "admin",
          previewText: text,
        });
      }
      return NextResponse.json(enriched.get(reply.id), { status: 201 });
    }

    if (!versionId) {
      return NextResponse.json({ error: "version_id is required for top-level comments." }, { status: 400 });
    }

    const timestampSeconds = Number(body.timestamp_seconds);
    if (!Number.isFinite(timestampSeconds)) {
      return NextResponse.json({ error: "timestamp_seconds is required." }, { status: 400 });
    }

    await loadVersionForReview(db, profile, reviewId, versionId);

    const comment = await createVideoReviewComment(db, {
      reviewId,
      versionId,
      projectId: review.project_id,
      authorUserId: profile.id,
      authorKind,
      body: text,
      timestampSeconds,
      pointX: body.point_x != null ? Number(body.point_x) : null,
      pointY: body.point_y != null ? Number(body.point_y) : null,
    });

    const enriched = await enrichVideoReviewComments(db, [comment]);
    if (authorKind === "client") {
      await notifyVideoReviewEvent("client_comment", {
        businessId: tenant.businessId,
        projectId: review.project_id,
        reviewId,
        reviewTitle: review.title,
        versionId,
        commentId: comment.id,
        actorUserId: profile.id,
        actorKind: "client",
        previewText: text,
      });
    }
    return NextResponse.json(enriched.get(comment.id), { status: 201 });
  } catch (err) {
    if (err instanceof VideoReviewAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof VideoReviewError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not save comment." }, { status: 500 });
  }
}
