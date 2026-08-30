import type { VideoReviewCommentEnriched } from "@/lib/video-review-comment-model";

/** Derive up to two initials from a display name. */
export function authorInitials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const one = parts[0];
    if (one.length <= 2) return one.toUpperCase();
    return (one[0] + one[one.length - 1]).toUpperCase();
  }

  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

/** Stable marker color from author id (same user → same color across loads). */
export function authorMarkerColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 42%)`;
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

export function clusterMarkerLabel(cluster: TimelineMarkerCluster): {
  initials: string;
  color: string;
  extraCount: number;
  ariaLabel: string;
} {
  const primary = cluster.comments[0];
  const initials = authorInitials(primary.author_name);
  const color = authorMarkerColor(primary.author_user_id);
  const extraCount = cluster.comments.length - 1;
  const names = cluster.comments.map((c) => c.author_name).join(", ");
  const ariaLabel =
    extraCount > 0
      ? `${cluster.comments.length} comments by ${names}`
      : `Comment by ${primary.author_name}`;

  return { initials, color, extraCount, ariaLabel };
}
