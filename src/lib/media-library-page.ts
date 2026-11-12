/** Shared server loading for the New interface Media Library pages (/admin/media…). */
import type { Profile } from "@/lib/types";
import { getLibraryFilterOptions } from "@/lib/media-library";
import { listLibraryFolders } from "@/lib/library-folders";
import { photoSharePermissions } from "@/lib/media-share-api";
import { isOwnerAdmin, staffCan, visibleClientIdsFor, visibleProjectIdsFor } from "@/lib/staff-access";
import type { FolderPermissions } from "@/components/admin/media-library/folder-client";

export async function loadMediaLibraryShell(businessId: string, profile: Profile) {
  const projectIds = isOwnerAdmin(profile) ? ("all" as const) : await visibleProjectIdsFor(businessId, profile);
  const clientIds = isOwnerAdmin(profile) ? ("all" as const) : await visibleClientIdsFor(businessId, profile);
  const shareItems = photoSharePermissions(profile);
  const permissions: FolderPermissions = {
    organize: staffCan(profile, "media.organize"),
    upload: staffCan(profile, "media.upload"),
    deleteMedia: staffCan(profile, "media.delete"),
    shareItems,
    // A folder spans projects: only people who can see every project may share one.
    shareFolders: (shareItems.email || shareItems.link) && projectIds === "all",
    deleteFolders: staffCan(profile, "media.organize") && projectIds === "all",
  };
  const [filterOptions, folderList] = await Promise.all([
    getLibraryFilterOptions(businessId, { projectIds, clientIds }),
    listLibraryFolders(businessId),
  ]);
  return { projectIds, permissions, filterOptions, folderList };
}
