import type { VideoContentRect } from "@/lib/video-review-coords";
import { pointerToNormalizedPoint } from "@/lib/video-review-coords";

export type VisibleDot =
  | { kind: "draft"; x: number; y: number }
  | { kind: "selected"; x: number; y: number };

export function resolveVisibleDot(options: {
  videoPaused: boolean;
  pendingPoint: { x: number; y: number } | null;
  activeCommentId: string | null;
  activeCommentPoint: { x: number; y: number } | null;
}): VisibleDot | null {
  if (!options.videoPaused) return null;
  if (options.pendingPoint) {
    return { kind: "draft", x: options.pendingPoint.x, y: options.pendingPoint.y };
  }
  if (options.activeCommentId && options.activeCommentPoint) {
    return { kind: "selected", x: options.activeCommentPoint.x, y: options.activeCommentPoint.y };
  }
  return null;
}

export type VideoSurfaceClickResult =
  | { action: "letterbox" }
  | { action: "place_mark"; point: { x: number; y: number } }
  | { action: "move_draft"; point: { x: number; y: number } }
  | { action: "toggle_play" };

/** Pure click routing for the video surface (desktop + touch). */
export function resolveVideoSurfaceClick(options: {
  markingMode: boolean;
  videoPaused: boolean;
  hasDraftPoint: boolean;
  clientX: number;
  clientY: number;
  containerRect: DOMRect;
  content: VideoContentRect;
}): VideoSurfaceClickResult {
  const point = pointerToNormalizedPoint(
    options.clientX,
    options.clientY,
    options.containerRect,
    options.content
  );

  if (options.markingMode) {
    if (!point) return { action: "letterbox" };
    return { action: "place_mark", point };
  }

  if (options.hasDraftPoint && options.videoPaused && point) {
    return { action: "move_draft", point };
  }

  return { action: "toggle_play" };
}
