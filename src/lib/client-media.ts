import type { MediaAsset, Tour, Project3dModel } from "@/lib/types";

/** Media the client portal should display (photos, videos, docs, YouTube). */
export function isClientVisibleMedia(asset: Pick<MediaAsset, "visibility">): boolean {
  // Fail closed when visibility is missing (do not treat undefined as client-visible).
  // "both" remains client-visible; only explicit "admin" is hidden.
  if (asset.visibility == null) return false;
  return asset.visibility !== "admin";
}

/** 360 tours visible on the client project page. */
export function isClientVisibleTour(tour: Pick<Tour, "client_visible">): boolean {
  return tour.client_visible !== false;
}

/** External 3D models visible on the client project page. */
export function isClientVisibleModel(model: Pick<Project3dModel, "client_visible">): boolean {
  return model.client_visible !== false;
}

export function filterClientMedia<T extends Pick<MediaAsset, "visibility">>(items: T[]): T[] {
  return items.filter(isClientVisibleMedia);
}

export function filterClientTours<T extends Pick<Tour, "client_visible">>(items: T[]): T[] {
  return items.filter(isClientVisibleTour);
}

export function filterClientModels<T extends Pick<Project3dModel, "client_visible">>(
  items: T[]
): T[] {
  return items.filter(isClientVisibleModel);
}
