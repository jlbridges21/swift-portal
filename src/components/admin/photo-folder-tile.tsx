"use client";

import { useDroppable } from "@dnd-kit/core";
import { Folder, FolderPlus, Images, MoreHorizontal } from "lucide-react";
import type { ActionMenuAnchor } from "@/components/ui/action-menu";
import { cn } from "@/lib/utils";

/** dnd-kit droppable id prefix — photos dropped on a tile move into that folder. */
export const FOLDER_DROP_PREFIX = "folder:";

function photoCountLabel(count: number) {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

interface PhotoFolderTileProps {
  dropId: string;
  name: string;
  count: number;
  coverUrl: string | null;
  general?: boolean;
  onOpen: () => void;
  onMenu: (anchor: ActionMenuAnchor) => void;
}

export function PhotoFolderTile({
  dropId,
  name,
  count,
  coverUrl,
  general = false,
  onOpen,
  onMenu,
}: PhotoFolderTileProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `${FOLDER_DROP_PREFIX}${dropId}` });
  const Icon = general ? Images : Folder;

  return (
    <div
      ref={setNodeRef}
      data-folder-tile={dropId}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ kind: "point", x: e.clientX, y: e.clientY, element: e.currentTarget });
      }}
      className={cn(
        "group relative min-w-0 rounded-xl border bg-card transition",
        isOver
          ? "border-accent ring-2 ring-accent"
          : active
            ? "border-dashed border-accent/60"
            : "border-border hover:border-accent/40"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${name}, ${photoCountLabel(count)}`}
        className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-subtle">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <Icon className="h-8 w-8 opacity-60" />
            </div>
          )}
          {isOver ? (
            <div className="absolute inset-0 flex items-center justify-center bg-accent/25 text-sm font-semibold text-heading">
              Move here
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-2 py-2 pl-3 pr-11">
          <Icon className="h-4 w-4 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-heading" title={name}>
              {name}
            </p>
            <p className="text-xs text-muted">{photoCountLabel(count)}</p>
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label={`${name} actions`}
        aria-haspopup="menu"
        onClick={(e) => onMenu({ kind: "element", element: e.currentTarget })}
        className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-accent-subtle hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

export function NewFolderTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[7.5rem] min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted transition hover:border-accent/50 hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <FolderPlus className="h-6 w-6" />
      New folder
    </button>
  );
}

export { photoCountLabel };
