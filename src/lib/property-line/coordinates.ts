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

/** Map a screen/client coordinate to natural image pixels. */
export function clientToNaturalPoint(
  clientX: number,
  clientY: number,
  transform: ViewportTransform
): ImagePoint | null {
  const {
    panX,
    panY,
    zoom,
    displayWidth,
    displayHeight,
    naturalWidth,
    naturalHeight,
    viewportCenterX,
    viewportCenterY,
  } = transform;

  const localX = (clientX - viewportCenterX - panX) / zoom + displayWidth / 2;
  const localY = (clientY - viewportCenterY - panY) / zoom + displayHeight / 2;

  if (localX < 0 || localY < 0 || localX > displayWidth || localY > displayHeight) {
    return null;
  }

  return {
    x: (localX / displayWidth) * naturalWidth,
    y: (localY / displayHeight) * naturalHeight,
  };
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
