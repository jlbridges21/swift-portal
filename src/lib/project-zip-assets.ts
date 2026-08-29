import { filterClientMedia } from "@/lib/client-media";
import type { MediaAsset } from "@/lib/types";

/** Query param value for assets with folder_id IS NULL. */
export const UNFILED_FOLDER_SCOPE = "unfiled" as const;

/** Client-facing label for unfiled photos (not "Unfiled" / "null"). */
export const UNFILED_FOLDER_LABEL = "General Photos";

export function isStorageBackedDeliverable(asset: MediaAsset): boolean {
  if (asset.media_type !== "photo" && asset.media_type !== "video") return false;
  if (asset.media_source === "youtube" || asset.media_source === "kuula" || asset.media_source === "external") {
    return false;
  }
  return !!(asset.file_path ?? "").trim();
}

export function assetsInFolderScope(photos: MediaAsset[], folderScope: string): MediaAsset[] {
  if (folderScope === UNFILED_FOLDER_SCOPE) {
    return photos.filter((p) => !p.folder_id);
  }
  return photos.filter((p) => p.folder_id === folderScope);
}

/** Count assets that would be included in a folder ZIP for this viewer. */
export function countFolderDownloadableAssets(
  photos: MediaAsset[],
  folderScope: string,
  isAdmin: boolean
): number {
  const inFolder = assetsInFolderScope(photos, folderScope);
  const visible = isAdmin ? inFolder : filterClientMedia(inFolder);
  return visible.filter(isStorageBackedDeliverable).length;
}
