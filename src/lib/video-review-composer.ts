/** Max playhead drift (seconds) before a draft mark is treated as belonging to another frame. */
export const MARK_FRAME_EPSILON_SEC = 0.05;

export function shouldClearDraftMark(
  playheadSeconds: number,
  markTimestamp: number | null
): boolean {
  if (markTimestamp == null) return false;
  return Math.abs(playheadSeconds - markTimestamp) > MARK_FRAME_EPSILON_SEC;
}

/** Timestamp persisted with a new top-level comment (mark uses the frame where it was placed). */
export function commentTimestampForSubmit(options: {
  playheadSeconds: number;
  videoCurrentTime: number | null;
  pendingPoint: { x: number; y: number } | null;
  pendingMarkTimestamp: number | null;
}): number {
  if (options.pendingPoint != null && options.pendingMarkTimestamp != null) {
    return options.pendingMarkTimestamp;
  }
  return options.videoCurrentTime ?? options.playheadSeconds;
}

export function clusterShowsResolvedIndicator(
  comments: { status: string }[],
  showInAllView: boolean
): boolean {
  if (!showInAllView) return false;
  return comments.length > 0 && comments.every((c) => c.status === "resolved");
}
