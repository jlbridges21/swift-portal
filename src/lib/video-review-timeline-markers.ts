import type { VideoReviewCommentEnriched } from "@/lib/video-review-comment-model";

/** Stable marker color from author id (same user → same color across loads). */
export function authorMarkerColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 42%)`;
}

export function commentPreview(body: string, maxLen = 72): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (!trimmed) return "(No comment text)";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export interface TimelineMarkerCluster {
  anchorSeconds: number;
  comments: VideoReviewCommentEnriched[];
}

export function clusterEnrichedReviewComments(
  comments: VideoReviewCommentEnriched[],
  windowSec = 1
): TimelineMarkerCluster[] {
  if (!comments.length) return [];
  const sorted = [...comments].sort(
    (a, b) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)
  );
  const clusters: TimelineMarkerCluster[] = [];

  for (const comment of sorted) {
    const ts = comment.timestamp_seconds ?? 0;
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(ts - last.anchorSeconds) <= windowSec) {
      last.comments.push(comment);
    } else {
      clusters.push({ anchorSeconds: ts, comments: [comment] });
    }
  }

  return clusters;
}

export function clusterMarkerTooltip(cluster: TimelineMarkerCluster): {
  color: string;
  extraCount: number;
  ariaLabel: string;
  lines: { author: string; preview: string }[];
} {
  const primary = cluster.comments[0];
  const color = authorMarkerColor(primary.author_user_id);
  const extraCount = cluster.comments.length - 1;
  const lines = cluster.comments.map((comment) => ({
    author: comment.author_name?.trim() || "Unknown",
    preview: commentPreview(comment.body),
  }));
  const names = lines.map((line) => line.author).join(", ");
  const ariaLabel =
    extraCount > 0
      ? `${cluster.comments.length} comments by ${names}`
      : `Comment by ${lines[0]?.author ?? "Unknown"}`;

  return { color, extraCount, ariaLabel, lines };
}

/** @deprecated Use clusterMarkerTooltip — initials markers removed. */
export function clusterMarkerLabel(cluster: TimelineMarkerCluster): {
  initials: string;
  color: string;
  extraCount: number;
  ariaLabel: string;
} {
  const tooltip = clusterMarkerTooltip(cluster);
  return {
    initials: "",
    color: tooltip.color,
    extraCount: tooltip.extraCount,
    ariaLabel: tooltip.ariaLabel,
  };
}
