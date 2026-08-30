import type { VideoContentRect } from "@/lib/video-review-coords";
import { pointerToNormalizedPoint } from "@/lib/video-review-coords";

export type VisibleDot =
  | { kind: "draft"; x: number; y: number }
  | { kind: "selected"; x: number; y: number }
  | { kind: "preview"; x: number; y: number };

export function resolveVisibleDot(options: {
  videoPaused: boolean;
  pendingPoint: { x: number; y: number } | null;
  activeCommentId: string | null;
  activeCommentPoint: { x: number; y: number } | null;
  markingMode: boolean;
  editMarkMode: boolean;
  hoverPreviewPoint: { x: number; y: number } | null;
}): VisibleDot | null {
  if (!options.videoPaused) return null;

  if (options.markingMode || options.editMarkMode) {
    if (options.hoverPreviewPoint) {
      return { kind: "preview", x: options.hoverPreviewPoint.x, y: options.hoverPreviewPoint.y };
    }
    return null;
  }

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
  | { action: "move_edit_mark"; point: { x: number; y: number } }
  | { action: "move_draft"; point: { x: number; y: number } }
  | { action: "toggle_play" }
  | { action: "blocked_draft" };

/** True when the click should use native `<video controls>` (scrubber, volume, etc.). */
export function shouldDeferToNativeVideoControls(
  videoHeight: number,
  clientY: number,
  containerTop: number
): boolean {
  const controlsBandPx = Math.min(48, videoHeight * 0.22);
  return clientY > containerTop + videoHeight - controlsBandPx;
}

/** Pure click routing for the video frame overlay (not the control bar). */
export function resolveVideoSurfaceClick(options: {
  markingMode: boolean;
  editMarkMode: boolean;
  videoPaused: boolean;
  hasDraftPoint: boolean;
  blockPlaybackToggle: boolean;
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

  if (options.markingMode || options.editMarkMode) {
    if (!point) return { action: "letterbox" };
    return options.editMarkMode
      ? { action: "move_edit_mark", point }
      : { action: "place_mark", point };
  }

  if (options.hasDraftPoint && options.videoPaused && point) {
    return { action: "move_draft", point };
  }

  if (options.blockPlaybackToggle) {
    return { action: "blocked_draft" };
  }

  return { action: "toggle_play" };
}
