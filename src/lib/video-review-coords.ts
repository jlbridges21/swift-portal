/** Pixel rect of the letterboxed video content within its container (object-contain). */
export interface VideoContentRect {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export function computeVideoContentRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number
): VideoContentRect | null {
  if (containerWidth <= 0 || containerHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
    return null;
  }

  const containerAspect = containerWidth / containerHeight;
  const videoAspect = videoWidth / videoHeight;

  if (videoAspect > containerAspect) {
    const width = containerWidth;
    const height = containerWidth / videoAspect;
    return {
      offsetX: 0,
      offsetY: (containerHeight - height) / 2,
      width,
      height,
    };
  }

  const height = containerHeight;
  const width = containerHeight * videoAspect;
  return {
    offsetX: (containerWidth - width) / 2,
    offsetY: 0,
    width,
    height,
  };
}

/** Map a click within the container to normalized 0–1 coords on the video frame. Returns null on letterbox bars. */
export function pointerToNormalizedPoint(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  content: VideoContentRect
): { x: number; y: number } | null {
  const localX = clientX - containerRect.left - content.offsetX;
  const localY = clientY - containerRect.top - content.offsetY;

  if (localX < 0 || localY < 0 || localX > content.width || localY > content.height) {
    return null;
  }

  return {
    x: localX / content.width,
    y: localY / content.height,
  };
}

/** Convert normalized point to CSS percentage position within the container. */
export function normalizedPointToPercent(
  point: { x: number; y: number },
  containerWidth: number,
  containerHeight: number,
  content: VideoContentRect
): { leftPct: number; topPct: number } {
  const px = content.offsetX + point.x * content.width;
  const py = content.offsetY + point.y * content.height;
  return {
    leftPct: (px / containerWidth) * 100,
    topPct: (py / containerHeight) * 100,
  };
}
