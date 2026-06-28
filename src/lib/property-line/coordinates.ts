import type { ImagePoint } from "./types";

export interface ViewportTransform {
  panX: number;
  panY: number;
  zoom: number;
  displayWidth: number;
  displayHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  viewportCenterX: number;
  viewportCenterY: number;
}

/** Map client coords to display-local coords (pre-zoom layer space). */
export function clientToDisplayLocal(
  clientX: number,
  clientY: number,
  transform: ViewportTransform
): ImagePoint {
  const {
    panX,
    panY,
    zoom,
    displayWidth,
    displayHeight,
    viewportCenterX,
    viewportCenterY,
  } = transform;

  return {
    x: (clientX - viewportCenterX - panX) / zoom + displayWidth / 2,
    y: (clientY - viewportCenterY - panY) / zoom + displayHeight / 2,
  };
}

/** Convert display-local coords to natural image pixels, optionally clamped to image bounds. */
export function displayLocalToNatural(
  local: ImagePoint,
  transform: Pick<ViewportTransform, "displayWidth" | "displayHeight" | "naturalWidth" | "naturalHeight">,
  clamp = true
): ImagePoint {
  let { x, y } = local;
  if (clamp) {
    x = Math.max(0, Math.min(transform.displayWidth, x));
    y = Math.max(0, Math.min(transform.displayHeight, y));
  }
  return {
    x: (x / transform.displayWidth) * transform.naturalWidth,
    y: (y / transform.displayHeight) * transform.naturalHeight,
  };
}

/** Map a screen/client coordinate to natural image pixels, clamped to the image edge when outside. */
export function clientToNaturalPoint(
  clientX: number,
  clientY: number,
  transform: ViewportTransform
): ImagePoint | null {
  if (transform.naturalWidth <= 0 || transform.naturalHeight <= 0) {
    return null;
  }

  const local = clientToDisplayLocal(clientX, clientY, transform);
  return displayLocalToNatural(local, transform, true);
}

/** Find the index of the nearest polygon point within a screen-space hit radius. */
export function findNearestPointIndex(
  clientX: number,
  clientY: number,
  transform: ViewportTransform,
  naturalPoints: ImagePoint[],
  hitRadiusPx: number
): number | null {
  if (naturalPoints.length === 0) return null;

  const local = clientToDisplayLocal(clientX, clientY, transform);
  const radius = hitRadiusPx / transform.zoom;
  const size = {
    displayWidth: transform.displayWidth,
    displayHeight: transform.displayHeight,
    naturalWidth: transform.naturalWidth,
    naturalHeight: transform.naturalHeight,
  };

  let best: number | null = null;
  let bestDist = radius;

  for (let i = 0; i < naturalPoints.length; i++) {
    const dp = naturalToDisplayPoint(naturalPoints[i], size);
    const dist = Math.hypot(dp.x - local.x, dp.y - local.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = i;
    }
  }

  return best;
}

/** Map natural image pixels to display-local coordinates (pre-zoom layer). */
export function naturalToDisplayPoint(
  point: ImagePoint,
  transform: Pick<ViewportTransform, "displayWidth" | "displayHeight" | "naturalWidth" | "naturalHeight">
): ImagePoint {
  return {
    x: (point.x / transform.naturalWidth) * transform.displayWidth,
    y: (point.y / transform.naturalHeight) * transform.displayHeight,
  };
}

export function computeFitDisplaySize(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { width: number; height: number; scale: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { width: 0, height: 0, scale: 1 };
  }
  const scale = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  return {
    scale,
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}
