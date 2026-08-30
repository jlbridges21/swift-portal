import type { VideoReviewComment } from "@/lib/types";

export type VideoReviewCommentView = "unresolved" | "resolved" | "all";

export interface VideoReviewCommentEnriched extends VideoReviewComment {
  author_name: string;
  resolved_by_name: string | null;
  reopened_by_name: string | null;
}

export interface VideoReviewCommentThread {
  comment: VideoReviewCommentEnriched;
  replies: VideoReviewCommentEnriched[];
}

export interface VideoReviewCommentCounts {
  all: number;
  unresolved: number;
  resolved: number;
}

export function countTopLevelComments(comments: VideoReviewComment[]): VideoReviewCommentCounts {
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const unresolved = topLevel.filter((c) => c.status === "unresolved").length;
  const resolved = topLevel.filter((c) => c.status === "resolved").length;
  return { all: topLevel.length, unresolved, resolved };
}

export function filterTopLevelForView(
  comments: VideoReviewComment[],
  view: VideoReviewCommentView
): VideoReviewComment[] {
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  if (view === "all") return topLevel;
  return topLevel.filter((c) => c.status === view);
}

export function buildCommentThreads(
  comments: VideoReviewComment[],
  enriched: Map<string, VideoReviewCommentEnriched>,
  view: VideoReviewCommentView
): VideoReviewCommentThread[] {
  const topLevel = filterTopLevelForView(comments, view).sort(
    (a, b) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)
  );

  const repliesByParent = new Map<string, VideoReviewComment[]>();
  for (const row of comments) {
    if (!row.parent_comment_id) continue;
    const list = repliesByParent.get(row.parent_comment_id) ?? [];
    list.push(row);
    repliesByParent.set(row.parent_comment_id, list);
  }

  return topLevel.map((comment) => {
    const replies = (repliesByParent.get(comment.id) ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((reply) => enriched.get(reply.id)!)
      .filter(Boolean);
    return { comment: enriched.get(comment.id)!, replies };
  });
}
