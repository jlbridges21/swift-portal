import type { VideoReviewComment } from "@/lib/types";

/** Group comments whose timestamps fall within `windowSec` of a cluster anchor. */
export function clusterReviewComments(
  comments: VideoReviewComment[],
  windowSec = 1
): { anchorSeconds: number; comments: VideoReviewComment[] }[] {
  if (!comments.length) return [];
  const sorted = [...comments].sort(
    (a, b) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)
  );
  const clusters: { anchorSeconds: number; comments: VideoReviewComment[] }[] = [];

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

export function markerPositionPercent(
  seconds: number,
  durationSeconds: number | null | undefined
): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Math.min(100, Math.max(0, (seconds / durationSeconds) * 100));
}
