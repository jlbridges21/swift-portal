"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder, Link2, MoreHorizontal, Users } from "lucide-react";
import { RemoteImage } from "@/components/ui/remote-image";
import { folderContentsLabel, type LibraryFolderSummary } from "@/lib/library-folder-types";
import { LIBRARY_DRAG_MIME, LIBRARY_FOLDER_DRAG_MIME } from "@/components/admin/media-library/library-ui";
import { cn } from "@/lib/utils";

export function folderHref(id: string) {
  return `/admin/media/folders/${id}`;
}

function FolderGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent", className)}>
      <Folder className="h-1/2 w-1/2" aria-hidden />
    </span>
  );
}

function ShareIndicator({ folder }: { folder: LibraryFolderSummary }) {
  if (!folder.share.link && !folder.share.people) return null;
  const label = [
    folder.share.people ? `${folder.share.people} ${folder.share.people === 1 ? "person" : "people"}` : null,
    folder.share.link ? "link on" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-1.5 py-0.5 text-[11px] font-medium text-accent"
      title={`Shared: ${label}`}
    >
      {folder.share.link ? <Link2 className="h-3 w-3" aria-hidden /> : <Users className="h-3 w-3" aria-hidden />}
      Shared
    </span>
  );
}

/** Folder being dragged, if any (dataTransfer can't be read during dragover). */
let draggingFolderId: string | null = null;

/** Drag a folder card (desktop) to move it onto another folder or a breadcrumb. */
export function folderDragProps(folder: { id: string; name: string }, enabled: boolean) {
  if (!enabled) return {};
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      draggingFolderId = folder.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(LIBRARY_FOLDER_DRAG_MIME, folder.id);
      e.dataTransfer.setData("text/plain", folder.name);
    },
    onDragEnd: () => {
      draggingFolderId = null;
    },
  };
}

/**
 * Drop target for media (moved into the folder) and, when `onDropFolder` is given, for other
 * folders (moved inside it). Exported for breadcrumbs.
 */
export function useFolderDropTarget(
  targetId: string | null,
  onDropItems?: (keys: string[]) => void,
  onDropFolder?: (folderId: string) => void
) {
  const [over, setOver] = useState(false);
  if (!onDropItems && !onDropFolder) return { over: false, props: {} };
  const accepts = (e: React.DragEvent) =>
    (onDropItems && e.dataTransfer.types.includes(LIBRARY_DRAG_MIME)) ||
    (onDropFolder && e.dataTransfer.types.includes(LIBRARY_FOLDER_DRAG_MIME) && draggingFolderId !== targetId);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        setOver(false);
        const folderId = onDropFolder ? e.dataTransfer.getData(LIBRARY_FOLDER_DRAG_MIME) : "";
        if (folderId) {
          e.preventDefault();
          draggingFolderId = null;
          if (folderId !== targetId) onDropFolder?.(folderId);
          return;
        }
        const raw = onDropItems ? e.dataTransfer.getData(LIBRARY_DRAG_MIME) : "";
        if (!raw) return;
        e.preventDefault();
        try {
          const keys = JSON.parse(raw) as unknown;
          if (Array.isArray(keys)) onDropItems?.(keys.filter((k): k is string => typeof k === "string"));
        } catch {
          /* ignore malformed drag data */
        }
      },
    },
  };
}

function useDropTarget(
  folder: LibraryFolderSummary,
  onDropItems?: (folder: LibraryFolderSummary, keys: string[]) => void,
  onDropFolder?: (target: LibraryFolderSummary, folderId: string) => void
) {
  return useFolderDropTarget(
    folder.id,
    onDropItems ? (keys) => onDropItems(folder, keys) : undefined,
    onDropFolder ? (id) => onDropFolder(folder, id) : undefined
  );
}

function MenuButton({ folder, onMenu, className }: { folder: LibraryFolderSummary; onMenu: (f: LibraryFolderSummary, el: HTMLElement) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMenu(folder, e.currentTarget);
      }}
      aria-label={`Options for ${folder.name}`}
      aria-haspopup="menu"
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className
      )}
    >
      <MoreHorizontal className="h-5 w-5" aria-hidden />
    </button>
  );
}

type CardProps = {
  folder: LibraryFolderSummary;
  onMenu: (f: LibraryFolderSummary, el: HTMLElement) => void;
  onDropItems?: (folder: LibraryFolderSummary, keys: string[]) => void;
  /** Another folder card was dropped here: move that folder inside this one. Also makes this card draggable. */
  onDropFolder?: (target: LibraryFolderSummary, folderId: string) => void;
};

/**
 * Compact card for the All Media folder row: cover preview (photo or video poster; gradient +
 * folder icon when there's none), blue folder icon, name, item count, and the options menu.
 */
export function FolderStripCard({ folder, onMenu, onDropItems, onDropFolder, coverUrl = null }: CardProps & { coverUrl?: string | null }) {
  const drop = useDropTarget(folder, onDropItems, onDropFolder);
  const shared = folder.share.link || folder.share.people > 0;
  return (
    <div
      {...drop.props}
      {...folderDragProps(folder, Boolean(onDropFolder))}
      className={cn(
        "group relative flex h-[5.25rem] min-w-0 items-center gap-3 rounded-2xl border bg-card p-2 pr-1.5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md",
        drop.over ? "border-accent ring-2 ring-accent/30" : "border-border"
      )}
    >
      <Link href={folderHref(folder.id)} className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Open folder ${folder.name}`} />
      <span className="pointer-events-none relative h-full w-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-subtle sm:w-[7.5rem]">
        {coverUrl ? (
          <RemoteImage src={coverUrl} alt="" fill sizes="120px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-subtle to-subtle">
            <Folder className="h-6 w-6 text-accent/50" aria-hidden />
          </span>
        )}
      </span>
      <Folder className="pointer-events-none hidden h-6 w-6 shrink-0 text-accent min-[400px]:block" aria-hidden />
      <div className="pointer-events-none min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-heading" title={folder.name}>
          {folder.name}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
          <span className="truncate">{folderContentsLabel(folder)}</span>
          {shared ? (
            <span className="inline-flex shrink-0 items-center text-accent" title="Shared">
              {folder.share.link ? <Link2 className="h-3.5 w-3.5" aria-hidden /> : <Users className="h-3.5 w-3.5" aria-hidden />}
              <span className="sr-only">Shared</span>
            </span>
          ) : null}
        </p>
      </div>
      <MenuButton folder={folder} onMenu={onMenu} className="relative" />
    </div>
  );
}

/** Large cover card for the Folders tab (mockup 2). */
export function FolderGalleryCard({ folder, coverUrl, onMenu, onDropItems, onDropFolder }: CardProps & { coverUrl: string | null }) {
  const drop = useDropTarget(folder, onDropItems, onDropFolder);
  return (
    <article
      {...drop.props}
      {...folderDragProps(folder, Boolean(onDropFolder))}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        drop.over ? "border-accent ring-2 ring-accent/30" : "border-border"
      )}
    >
      <Link href={folderHref(folder.id)} className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Open folder ${folder.name}`} />
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-subtle">
        {coverUrl ? (
          <RemoteImage
            src={coverUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-subtle to-subtle">
            <Folder className="h-12 w-12 text-accent/60" aria-hidden />
          </div>
        )}
        <div className="absolute right-2 top-2 z-[2]">
          <ShareIndicator folder={folder} />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3 px-4 py-3.5">
        <FolderGlyph className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-heading" title={folder.name}>
            {folder.name}
          </h3>
          <p className="text-sm text-muted">{folderContentsLabel(folder)}</p>
        </div>
        <MenuButton folder={folder} onMenu={onMenu} className="relative z-[2]" />
      </div>
    </article>
  );
}

/** Row for the Folders tab list view. */
export function FolderListRow({ folder, coverUrl, onMenu, onDropItems, onDropFolder, updatedLabel }: CardProps & { coverUrl: string | null; updatedLabel: string }) {
  const drop = useDropTarget(folder, onDropItems, onDropFolder);
  return (
    <li {...drop.props} {...folderDragProps(folder, Boolean(onDropFolder))} className={cn("relative flex min-w-0 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-subtle/60 sm:px-4", drop.over && "bg-accent-subtle")}>
      <Link href={folderHref(folder.id)} className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" aria-label={`Open folder ${folder.name}`} />
      <div className="relative h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-subtle">
        {coverUrl ? (
          <RemoteImage src={coverUrl} alt="" fill sizes="72px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Folder className="h-5 w-5 text-accent/70" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-heading" title={folder.name}>
            {folder.name}
          </span>
          <ShareIndicator folder={folder} />
        </p>
        <p className="truncate text-xs text-muted">
          {folderContentsLabel(folder)} · Updated {updatedLabel}
        </p>
      </div>
      <MenuButton folder={folder} onMenu={onMenu} className="relative" />
    </li>
  );
}
