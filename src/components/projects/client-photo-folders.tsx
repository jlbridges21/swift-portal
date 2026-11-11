"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotoGallery } from "@/components/projects/photo-gallery";
import { ProjectZipDownload } from "@/components/projects/project-zip-download";
import { Button } from "@/components/ui/button";
import { mediaDisplayName } from "@/lib/media-display-name";
import {
  countFolderDownloadableAssets,
  isStorageBackedDeliverable,
  UNFILED_FOLDER_LABEL,
  UNFILED_FOLDER_SCOPE,
} from "@/lib/project-zip-assets";
import { cn } from "@/lib/utils";
import type { MediaAsset, MediaFolder } from "@/lib/types";
import { ArrowLeft, Folder, Heart, Images } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ClientFavoritesController } from "@/components/projects/use-client-favorites";

type View = "browse" | "all" | "folder" | "unfiled" | "favorites";

interface ClientPhotoFoldersProps {
  projectId: string;
  zipApiBase?: string;
  downloadApiBase?: string;
  /** Full POST URL for batch thumbnails (public link pages). */
  thumbnailsEndpoint?: string;
  photos: MediaAsset[];
  folders: MediaFolder[];
  getDownloadUrl: (asset: MediaAsset, thumb?: boolean) => Promise<string | null>;
  downloadsAllowed?: boolean;
  compactInitialCount?: number;
  isAdmin?: boolean;
  /** Signed-in client's hearts: adds heart buttons and a Favorites view. */
  favorites?: ClientFavoritesController;
}

function sortInFolder(list: MediaAsset[]) {
  return [...list].sort((a, b) => {
    const order = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (order !== 0) return order;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function ClientPhotoFolders({
  projectId,
  zipApiBase,
  downloadApiBase,
  thumbnailsEndpoint,
  photos,
  folders,
  getDownloadUrl,
  downloadsAllowed = true,
  compactInitialCount,
  isAdmin = false,
  favorites,
}: ClientPhotoFoldersProps) {
  const [view, setView] = useState<View>(folders.length ? "browse" : "all");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.display_order - b.display_order),
    [folders]
  );

  const photosByFolder = useMemo(() => {
    const map = new Map<string | "null", MediaAsset[]>();
    for (const p of photos) {
      const key = (p.folder_id ?? "null") as string | "null";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    for (const [k, list] of map) map.set(k, sortInFolder(list));
    return map;
  }, [photos]);

  const unfiled = useMemo(() => photosByFolder.get("null") ?? [], [photosByFolder]);
  const allSorted = useMemo(() => sortInFolder(photos), [photos]);

  useEffect(() => {
    if (!folders.length) setView("all");
  }, [folders.length]);

  useEffect(() => {
    let cancelled = false;
    async function loadCovers() {
      const next: Record<string, string> = {};
      for (const folder of sortedFolders) {
        const first = (photosByFolder.get(folder.id) ?? [])[0];
        if (!first) continue;
        const url = await getDownloadUrl(first, true);
        if (url) next[folder.id] = url;
      }
      if (!cancelled) setCovers(next);
    }
    if (view === "browse") void loadCovers();
    return () => {
      cancelled = true;
    };
  }, [view, sortedFolders, photosByFolder, getDownloadUrl]);

  const favoritePhotos = favorites ? allSorted.filter((p) => favorites.isFavorite(p.id)) : [];

  function favoritesButton(active: boolean, onClick: () => void) {
    if (!favorites) return null;
    return (
      <Button
        variant={active ? "accent" : "outline"}
        size="sm"
        className="min-h-10"
        aria-pressed={active}
        onClick={onClick}
      >
        <Heart className={cn("h-4 w-4", (active || favorites.count > 0) && "fill-current")} /> Favorites (
        {favorites.count})
      </Button>
    );
  }

  const favoritesView = favorites ? (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-10"
          onClick={() => setView(folders.length ? "browse" : "all")}
        >
          <ArrowLeft className="h-4 w-4" /> {folders.length ? "Folders" : "All photos"}
        </Button>
        <p className="flex items-center gap-1.5 text-sm font-medium text-heading">
          <Heart className="h-4 w-4 fill-current text-accent" /> Your favorites
          <span className="font-normal text-muted">({favoritePhotos.length})</span>
        </p>
        {downloadsAllowed && favoritePhotos.length > 0 ? (
          <ProjectZipDownload
            projectId={projectId}
            zipApiBase={zipApiBase}
            favoritesOnly
            folderLabel="Favorites"
            expectedFileCount={favoritePhotos.filter(isStorageBackedDeliverable).length}
            variant="default"
            className="sm:ml-auto"
          />
        ) : null}
      </div>
      <PhotoGallery
        photos={favoritePhotos}
        getDownloadUrl={getDownloadUrl}
        downloadsAllowed={downloadsAllowed}
        downloadApiBase={downloadApiBase}
        thumbnailsEndpoint={thumbnailsEndpoint}
        favorites={favorites}
        emptyState={
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            description="Tap the heart on any photo to save it here. Your favorites are shared with your photographer."
          />
        }
      />
    </div>
  ) : null;

  if (view === "favorites" && favoritesView) return favoritesView;

  if (!folders.length) {
    return (
      <div className="space-y-4">
        {favorites ? (
          <div className="flex flex-wrap gap-2">{favoritesButton(false, () => setView("favorites"))}</div>
        ) : null}
        <PhotoGallery
          photos={sortInFolder(photos)}
          getDownloadUrl={getDownloadUrl}
          downloadsAllowed={downloadsAllowed}
          compactInitialCount={compactInitialCount}
          downloadApiBase={downloadApiBase}
          thumbnailsEndpoint={thumbnailsEndpoint}
          favorites={favorites}
        />
      </div>
    );
  }

  function folderDownload(folderId: string, folderName: string, fileCount: number) {
    if (!downloadsAllowed || fileCount <= 0) return null;
    return (
      <ProjectZipDownload
        projectId={projectId}
        zipApiBase={zipApiBase}
        folderId={folderId}
        folderLabel={folderName}
        expectedFileCount={fileCount}
        variant="default"
        compact
      />
    );
  }

  if (view === "browse") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-10" onClick={() => setView("all")}>
            <Images className="h-4 w-4" /> All photos ({photos.length})
          </Button>
          {favoritesButton(false, () => setView("favorites"))}
          {unfiled.length > 0 &&
            countFolderDownloadableAssets(photos, UNFILED_FOLDER_SCOPE, isAdmin) > 0 && (
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => setView("unfiled")}>
              {UNFILED_FOLDER_LABEL} ({unfiled.length})
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sortedFolders.map((folder) => {
            const count = (photosByFolder.get(folder.id) ?? []).length;
            const downloadableCount = countFolderDownloadableAssets(photos, folder.id, isAdmin);
            return (
              <div
                key={folder.id}
                className="overflow-hidden rounded-xl border border-border bg-white surface-dark:bg-card text-left shadow-sm transition hover:border-accent/40 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveFolderId(folder.id);
                    setView("folder");
                  }}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 surface-dark:bg-subtle">
                    {covers[folder.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={covers[folder.id]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted">
                        <Folder className="h-8 w-8 opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate font-medium text-heading">{folder.name}</p>
                    <p className="text-xs text-muted">
                      {count} photo{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
                {folderDownload(folder.id, folder.name, downloadableCount) && (
                  <div className="border-t border-border px-3 pb-3">
                    {folderDownload(folder.id, folder.name, downloadableCount)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(() => {
          const unfiledDownloadCount = countFolderDownloadableAssets(
            photos,
            UNFILED_FOLDER_SCOPE,
            isAdmin
          );
          const unfiledDownload =
            unfiled.length > 0 && unfiledDownloadCount > 0
              ? folderDownload(UNFILED_FOLDER_SCOPE, UNFILED_FOLDER_LABEL, unfiledDownloadCount)
              : null;
          return unfiledDownload ? <div>{unfiledDownload}</div> : null;
        })()}
      </div>
    );
  }

  const title =
    view === "all"
      ? "All photos"
      : view === "unfiled"
        ? UNFILED_FOLDER_LABEL
        : sortedFolders.find((f) => f.id === activeFolderId)?.name || "Folder";

  const list =
    view === "all"
      ? allSorted
      : view === "unfiled"
        ? unfiled
        : photosByFolder.get(activeFolderId ?? "") ?? [];

  const activeFolderScope =
    view === "unfiled"
      ? UNFILED_FOLDER_SCOPE
      : view === "folder" && activeFolderId
        ? activeFolderId
        : null;
  const activeDownloadCount =
    activeFolderScope != null
      ? countFolderDownloadableAssets(photos, activeFolderScope, isAdmin)
      : 0;
  const activeDownloadLabel =
    view === "unfiled"
      ? UNFILED_FOLDER_LABEL
      : sortedFolders.find((f) => f.id === activeFolderId)?.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-10"
          onClick={() => {
            setView("browse");
            setActiveFolderId(null);
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Folders
        </Button>
        <p className={cn("text-sm font-medium text-heading")}>{title}</p>
        {view !== "all" && (
          <Button variant="outline" size="sm" className="min-h-10 sm:ml-auto" onClick={() => setView("all")}>
            All photos
          </Button>
        )}
        {favoritesButton(false, () => setView("favorites"))}
        {activeFolderScope && activeDownloadLabel && (
          folderDownload(activeFolderScope, activeDownloadLabel, activeDownloadCount)
        )}
      </div>
      <PhotoGallery
        photos={list}
        getDownloadUrl={getDownloadUrl}
        downloadsAllowed={downloadsAllowed}
        compactInitialCount={view === "all" ? compactInitialCount : undefined}
        downloadApiBase={downloadApiBase}
        thumbnailsEndpoint={thumbnailsEndpoint}
        favorites={favorites}
      />
      {view === "folder" && list[0] && (
        <p className="sr-only">Folder starts with {mediaDisplayName(list[0])}</p>
      )}
    </div>
  );
}
