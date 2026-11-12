import { notFound, redirect } from "next/navigation";
import { ShellPageTitle } from "@/components/admin/app-shell/shell-page-title";
import { MediaLibraryWorkspace, type MediaLibraryView } from "@/components/admin/media-library/media-library-workspace";
import { getLibraryFolder } from "@/lib/library-folders";
import { isUuid } from "@/lib/library-folder-types";
import { queryMediaLibrary } from "@/lib/media-library";
import { loadMediaLibraryShell } from "@/lib/media-library-page";
import type { Profile } from "@/lib/types";

const PAGE_DESCRIPTION = "All your photos, videos, and assets in one place.";

/**
 * New interface Media Library (server). Three views share one workspace:
 *   all     /admin/media                 folder row + every asset
 *   folders /admin/media/folders         large folder cards
 *   folder  /admin/media/folders/{id}    one folder's media (filters/search scoped to it)
 */
export async function NewMediaLibraryPage({
  profile,
  businessId,
  view = "all",
  folderId = null,
  initialQuery = "",
  openUpload = false,
  addTo = null,
}: {
  profile: Profile;
  businessId: string;
  view?: MediaLibraryView;
  folderId?: string | null;
  initialQuery?: string;
  openUpload?: boolean;
  addTo?: string | null;
}) {
  const shell = await loadMediaLibraryShell(businessId, profile);
  const { projectIds, permissions, filterOptions, folderList } = shell;

  let folder: { id: string; name: string } | null = null;
  if (view === "folder") {
    if (!folderId || !isUuid(folderId) || folderList.setupRequired) notFound();
    const row = await getLibraryFolder(businessId, folderId).catch(() => null);
    if (!row) notFound();
    folder = { id: row.id, name: row.name };
  }

  // "Add from library" mode needs a real folder this user may organize.
  let pickForFolder: { id: string; name: string } | null = null;
  if (view === "all" && addTo) {
    const target = isUuid(addTo) && permissions.organize ? folderList.folders.find((f) => f.id === addTo) : null;
    if (!target) redirect("/admin/media");
    pickForFolder = { id: target.id, name: target.name };
  }

  const browser =
    view === "folders"
      ? undefined
      : await queryMediaLibrary(businessId, {
          page: 1,
          limit: 48,
          q: initialQuery || undefined,
          projectIds,
          libraryFolderId: folder?.id,
          sort: folder ? "added" : "newest",
        });

  // Unfiltered total for the All Media tab; folder views load it lazily on the client.
  const libraryTotal = view === "all" && browser && !initialQuery ? browser.total : null;

  return (
    <div className="min-h-screen bg-background">
      <ShellPageTitle
        title={folder ? folder.name : "Media Library"}
        description={folder ? "Media Library folder" : PAGE_DESCRIPTION}
        crumbs={folder ? [{ label: "Media Library", href: "/admin/media" }, { label: "Folders", href: "/admin/media/folders" }] : undefined}
      />
      <main className="app-page app-page-wide mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <MediaLibraryWorkspace
          view={view}
          initialFolders={folderList.folders}
          foldersSetupRequired={folderList.setupRequired}
          libraryTotal={libraryTotal}
          folder={folder}
          browser={
            browser
              ? {
                  initialAssets: browser.assets,
                  initialTotal: browser.total,
                  initialKindCounts: browser.kindCounts,
                  initialQuery,
                }
              : undefined
          }
          filterOptions={filterOptions}
          permissions={permissions}
          openUploadOnMount={openUpload && permissions.upload}
          pickForFolder={pickForFolder}
        />
      </main>
    </div>
  );
}
