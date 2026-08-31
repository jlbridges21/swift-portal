import type { VideoReviewCommentThread } from "@/lib/video-review-comment-model";

/**
 * Playback-synced transcript follow: the latest top-level comment whose timestamp
 * is <= currentTime (by timestamp, ties broken by thread order).
 */
export function findPlaybackActiveCommentId(
  threads: VideoReviewCommentThread[],
  currentTime: number
): string | null {
  if (!Number.isFinite(currentTime) || currentTime < 0 || threads.length === 0) {
    return null;
  }

  let bestId: string | null = null;
  let bestTs = -Infinity;

  for (const thread of threads) {
    const ts = thread.comment.timestamp_seconds;
    if (ts == null || ts > currentTime) continue;
    if (ts > bestTs || (ts === bestTs && bestId === null)) {
      bestTs = ts;
      bestId = thread.comment.id;
    }
  }

  return bestId;
}

export function isCommentIdInThreads(
  commentId: string | null,
  threads: VideoReviewCommentThread[]
): boolean {
  if (!commentId) return false;
  return threads.some((t) => t.comment.id === commentId);
}

/** True when any part of the comment row intersects the scroll container viewport. */
export function isCommentIntersectingContainer(
  container: HTMLElement,
  commentEl: HTMLElement
): boolean {
  const cRect = container.getBoundingClientRect();
  const eRect = commentEl.getBoundingClientRect();
  return eRect.bottom > cRect.top && eRect.top < cRect.bottom;
}
