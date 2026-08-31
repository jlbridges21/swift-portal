import { logProjectActivity } from "@/lib/activity";
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import type { VideoReviewComment, VideoReviewCommentStatus } from "@/lib/types";
import { VideoReviewError } from "@/lib/video-reviews";

export type {
  VideoReviewCommentCounts,
  VideoReviewCommentEnriched,
  VideoReviewCommentThread,
  VideoReviewCommentView,
} from "@/lib/video-review-comment-model";
export {
  buildCommentThreads,
  countTopLevelComments,
  filterTopLevelForView,
} from "@/lib/video-review-comment-model";

import type { VideoReviewCommentEnriched, VideoReviewCommentCounts } from "@/lib/video-review-comment-model";
import { countTopLevelComments } from "@/lib/video-review-comment-model";

async function loadDisplayNames(
  db: TenantServiceClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return new Map();

  // Shared viewers have profiles.business_id NULL — must not use tenant-scoped `.from("profiles")`.
  const { data: profiles } = await db.raw
    .from("profiles")
    .select("id, full_name, email, role, client_id")
    .in("id", unique);

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const clientIds = [...new Set((profiles ?? []).map((p) => p.client_id).filter(Boolean))] as string[];
  const clientNameById = new Map<string, string>();
  if (clientIds.length) {
    const { data: clients } = await db
      .from("clients")
      .select("id, first_name, last_name, company_name")
      .eq("business_id", db.businessId)
      .in("id", clientIds);
    for (const client of clients ?? []) {
      const personal = [client.first_name, client.last_name].filter(Boolean).join(" ").trim();
      clientNameById.set(
        client.id as string,
        personal || (client.company_name as string) || "Client"
      );
    }
  }

  const out = new Map<string, string>();
  for (const profile of profiles ?? []) {
    if (profile.role === "client" && profile.client_id) {
      out.set(profile.id as string, clientNameById.get(profile.client_id as string) ?? "Client");
    } else {
      out.set(
        profile.id as string,
        (profile.full_name as string | null)?.trim() ||
          (profile.email as string)?.split("@")[0] ||
          "Team member"
      );
    }
  }
  return out;
}

function authorLabel(
  kind: string,
  name: string,
  profile?: { role?: string; client_id?: string | null }
): string {
  if (kind === "admin") return `${name} (business)`;
  if (profile?.role === "client" && !profile.client_id) {
    return `${name} (shared viewer)`;
  }
  return `${name} (client)`;
}

export async function enrichVideoReviewComments(
  db: TenantServiceClient,
  comments: VideoReviewComment[]
): Promise<Map<string, VideoReviewCommentEnriched>> {
  const userIds = comments.flatMap((c) => [
    c.author_user_id,
    c.resolved_by,
    c.reopened_by,
  ]);
  const names = await loadDisplayNames(db, userIds as string[]);
  const unique = [...new Set(userIds.filter(Boolean))];
  const { data: profiles } = unique.length
    ? await db.raw.from("profiles").select("id, role, client_id").in("id", unique)
    : { data: [] as { id: string; role: string; client_id: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const enriched = new Map<string, VideoReviewCommentEnriched>();
  for (const comment of comments) {
    const authorProfile = profileById.get(comment.author_user_id);
    const authorName = names.get(comment.author_user_id) ?? "Unknown";
    const resolvedProfile = comment.resolved_by ? profileById.get(comment.resolved_by) : null;
    const reopenedProfile = comment.reopened_by ? profileById.get(comment.reopened_by) : null;
    enriched.set(comment.id, {
      ...comment,
      author_name: authorLabel(
        comment.author_kind,
        authorName,
        authorProfile ?? undefined
      ),
      resolved_by_name: comment.resolved_by
        ? authorLabel(
            resolvedProfile?.role === "client" ? "client" : "admin",
            names.get(comment.resolved_by) ?? "Team member",
            resolvedProfile ?? undefined
          )
        : null,
      reopened_by_name: comment.reopened_by
        ? authorLabel(
            reopenedProfile?.role === "client" ? "client" : "admin",
            names.get(comment.reopened_by) ?? "Unknown",
            reopenedProfile ?? undefined
          )
        : null,
    });
  }
  return enriched;
}

export async function listVideoReviewCommentsForVersion(
  db: TenantServiceClient,
  reviewId: string,
  versionId: string
): Promise<{ comments: VideoReviewComment[]; counts: VideoReviewCommentCounts }> {
  const { data: comments, error } = await db
    .from("video_review_comments")
    .select("*")
    .eq("business_id", db.businessId)
    .eq("review_id", reviewId)
    .eq("version_id", versionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new VideoReviewError(error.message, "comments_load_failed");
  }

  const rows = (comments ?? []) as VideoReviewComment[];
  return { comments: rows, counts: countTopLevelComments(rows) };
}

export interface CreateVideoReviewReplyInput {
  reviewId: string;
  parentCommentId: string;
  authorUserId: string;
  authorKind: "client" | "admin";
  body: string;
}

export async function createVideoReviewReply(
  db: TenantServiceClient,
  input: CreateVideoReviewReplyInput
): Promise<VideoReviewComment> {
  const body = input.body.trim();
  if (!body) {
    throw new VideoReviewError("Reply body is required.", "reply_body_required");
  }

  const { data: parent, error: parentError } = await db
    .from("video_review_comments")
    .select("*")
    .eq("business_id", db.businessId)
    .eq("id", input.parentCommentId)
    .eq("review_id", input.reviewId)
    .maybeSingle();

  if (parentError || !parent) {
    throw new VideoReviewError("Parent comment not found.", "parent_not_found");
  }
  if (parent.parent_comment_id) {
    throw new VideoReviewError("Replies cannot nest beyond one level.", "reply_nested");
  }

  const { data: reply, error } = await db
    .from("video_review_comments")
    .insert({
      review_id: input.reviewId,
      version_id: parent.version_id,
      project_id: parent.project_id,
      parent_comment_id: input.parentCommentId,
      author_user_id: input.authorUserId,
      author_kind: input.authorKind,
      body,
    })
    .select()
    .single();

  if (error || !reply) {
    throw new VideoReviewError(error?.message ?? "Could not save reply.", "reply_insert_failed");
  }

  return reply as VideoReviewComment;
}

async function loadTopLevelComment(
  db: TenantServiceClient,
  reviewId: string,
  commentId: string
): Promise<VideoReviewComment> {
  const { data: comment, error } = await db
    .from("video_review_comments")
    .select("*")
    .eq("business_id", db.businessId)
    .eq("id", commentId)
    .eq("review_id", reviewId)
    .maybeSingle();

  if (error || !comment) {
    throw new VideoReviewError("Comment not found.", "comment_not_found");
  }
  if (comment.parent_comment_id) {
    throw new VideoReviewError("Only top-level comments can be resolved or reopened.", "not_top_level");
  }
  return comment as VideoReviewComment;
}

export interface StatusChangeResult {
  comment: VideoReviewComment;
  changed: boolean;
}

export async function resolveVideoReviewComment(
  db: TenantServiceClient,
  reviewId: string,
  commentId: string,
  userId: string,
  projectId: string
): Promise<StatusChangeResult> {
  const existing = await loadTopLevelComment(db, reviewId, commentId);
  if (existing.status === "resolved") {
    return { comment: existing, changed: false };
  }

  const now = new Date().toISOString();
  const { data: comment, error } = await db
    .from("video_review_comments")
    .update({
      status: "resolved" satisfies VideoReviewCommentStatus,
      resolved_by: userId,
      resolved_at: now,
      reopened_by: null,
      reopened_at: null,
    })
    .eq("business_id", db.businessId)
    .eq("id", commentId)
    .select()
    .single();

  if (error || !comment) {
    throw new VideoReviewError(error?.message ?? "Could not resolve comment.", "resolve_failed");
  }

  await logProjectActivity(
    "video_review_comment_resolved",
    `Video review note marked resolved at ${formatActivityTimestamp(existing.timestamp_seconds)}`,
    {
      businessId: db.businessId,
      projectId,
      userId,
      metadata: {
        reviewId,
        commentId,
        versionId: existing.version_id,
        timestampSeconds: existing.timestamp_seconds,
      },
    }
  );

  return { comment: comment as VideoReviewComment, changed: true };
}

export async function reopenVideoReviewComment(
  db: TenantServiceClient,
  reviewId: string,
  commentId: string,
  userId: string,
  projectId: string
): Promise<StatusChangeResult> {
  const existing = await loadTopLevelComment(db, reviewId, commentId);
  if (existing.status === "unresolved") {
    return { comment: existing, changed: false };
  }

  const now = new Date().toISOString();
  const { data: comment, error } = await db
    .from("video_review_comments")
    .update({
      status: "unresolved",
      reopened_by: userId,
      reopened_at: now,
    })
    .eq("business_id", db.businessId)
    .eq("id", commentId)
    .select()
    .single();

  if (error || !comment) {
    throw new VideoReviewError(error?.message ?? "Could not reopen comment.", "reopen_failed");
  }

  await logProjectActivity(
    "video_review_comment_reopened",
    `Video review note reopened at ${formatActivityTimestamp(existing.timestamp_seconds)}`,
    {
      businessId: db.businessId,
      projectId,
      userId,
      metadata: {
        reviewId,
        commentId,
        versionId: existing.version_id,
        timestampSeconds: existing.timestamp_seconds,
      },
    }
  );

  return { comment: comment as VideoReviewComment, changed: true };
}

export async function updateVideoReviewCommentMark(
  db: TenantServiceClient,
  reviewId: string,
  commentId: string,
  userId: string,
  pointX: number | null,
  pointY: number | null
): Promise<VideoReviewComment> {
  const existing = await loadTopLevelComment(db, reviewId, commentId);

  if (existing.author_user_id !== userId) {
    throw new VideoReviewError("Only the comment author can edit this mark.", "mark_edit_forbidden");
  }

  const hasPointX = pointX != null;
  const hasPointY = pointY != null;
  if (hasPointX !== hasPointY) {
    throw new VideoReviewError("Point coordinates must be provided as a pair.", "comment_point_pair");
  }

  if (hasPointX) {
    if (
      !Number.isFinite(pointX!) ||
      pointX! < 0 ||
      pointX! > 1 ||
      !Number.isFinite(pointY!) ||
      pointY! < 0 ||
      pointY! > 1
    ) {
      throw new VideoReviewError("Point coordinates must be between 0 and 1.", "comment_point_range");
    }
  }

  const { data: comment, error } = await db
    .from("video_review_comments")
    .update({
      point_x: hasPointX ? pointX : null,
      point_y: hasPointY ? pointY : null,
    })
    .eq("business_id", db.businessId)
    .eq("id", commentId)
    .eq("review_id", reviewId)
    .select()
    .single();

  if (error || !comment) {
    throw new VideoReviewError(error?.message ?? "Could not update mark.", "mark_update_failed");
  }

  return comment as VideoReviewComment;
}

function formatActivityTimestamp(seconds: number | null): string {
  if (seconds == null) return "unknown time";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
