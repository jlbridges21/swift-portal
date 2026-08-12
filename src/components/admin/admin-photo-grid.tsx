"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { mediaDisplayName } from "@/lib/media-display-name";
import { cn } from "@/lib/utils";
import type { MediaAsset, MediaFolder } from "@/lib/types";
import { AdminPhotoLightbox } from "@/components/admin/admin-photo-lightbox";
import {
  Eye,
  EyeOff,
  FolderInput,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

type FolderFilter = "all" | "unfiled" | string;

interface AdminPhotoGridProps {
  projectId: string;
  photos: MediaAsset[];
  folders: MediaFolder[];
  isHero: (id: string) => boolean;
  onSetHero: (id: string) => void;
  onDelete: (id: string) => void;
  onPhotosChange: (photos: MediaAsset[]) => void;
  onFoldersChange: (folders: MediaFolder[]) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onPropertyLineSaved?: (asset: Record<string, unknown>) => void;
  onRefresh?: () => void;
}

function isClientVisible(asset: MediaAsset) {
  return asset.visibility !== "admin";
}

function sortPhotos(list: MediaAsset[]) {
  return [...list].sort((a, b) => {
    const fa = a.folder_id ?? "";
    const fb = b.folder_id ?? "";
    if (fa !== fb) {
      if (!a.folder_id && b.folder_id) return -1;
      if (a.folder_id && !b.folder_id) return 1;
      return fa.localeCompare(fb);
    }
    const order = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (order !== 0) return order;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function PhotoThumb({
  assetId,
  selected,
  onOpen,
}: {
  assetId: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/media/download/${assetId}?thumb=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setUrl(d.url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="relative aspect-square w-full bg-slate-100"
      aria-label="Open photo"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="h-full w-full animate-pulse bg-slate-200" />
      )}
      {selected && <div className="absolute inset-0 bg-slate-900/45" />}
    </button>
  );
}

function SortablePhotoCard({
  photo,
  index,
  selected,
  isHeroPhoto,
  onSelectClick,
  onOpen,
  onSetHero,
  onToggleVisibility,
  onDelete,
  onRename,
}: {
  photo: MediaAsset;
  index: number;
  selected: boolean;
  isHeroPhoto: boolean;
  onSelectClick: (e: React.MouseEvent, id: string, index: number) => void;
  onOpen: () => void;
  onSetHero: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-photo-id={photo.id}
      onClick={(e) => onSelectClick(e, photo.id, index)}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-white transition-shadow",
        selected
          ? "border-accent ring-2 ring-accent shadow-md"
          : "border-border hover:border-slate-300",
        isDragging && "opacity-40"
      )}
    >
      <PhotoThumb assetId={photo.id} selected={selected} onOpen={onOpen} />
      <div className="space-y-2 p-2">
        <div className="flex items-start gap-1">
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none text-muted active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <p className="line-clamp-2 flex-1 text-xs text-foreground">{mediaDisplayName(photo)}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {isHeroPhoto && (
            <span className="inline-block rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              Hero
            </span>
          )}
          {!isClientVisible(photo) && (
            <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              Hidden
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            title={isClientVisible(photo) ? "Hide from client" : "Show to client"}
            onClick={onToggleVisibility}
          >
            {isClientVisible(photo) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onSetHero}>
            Hero
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRename} title="Rename">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminPhotoGrid({
  projectId,
  photos,
  folders,
  isHero,
  onSetHero,
  onDelete,
  onPhotosChange,
  onFoldersChange,
  onToggleVisibility,
  onPropertyLineSaved,
  onRefresh,
}: AdminPhotoGridProps) {
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<MediaAsset | null>(null);
  const [activeDragIds, setActiveDragIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveFolderId, setMoveFolderId] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const marqueeStart = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const selectionBeforeMarquee = useRef<Set<string>>(new Set());
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const visiblePhotos = useMemo(() => {
    let list = photos.filter((p) => p.media_type === "photo");
    if (folderFilter === "unfiled") list = list.filter((p) => !p.folder_id);
    else if (folderFilter !== "all") list = list.filter((p) => p.folder_id === folderFilter);
    return sortPhotos(list);
  }, [photos, folderFilter]);

  const visibleIds = useMemo(() => visiblePhotos.map((p) => p.id), [visiblePhotos]);

  const folderCounts = useMemo(() => {
    const map = new Map<string | "null", number>();
    for (const p of photos) {
      if (p.media_type !== "photo") continue;
      const key = (p.folder_id ?? "null") as string | "null";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [photos]);

  const currentFolderId =
    folderFilter === "all" || folderFilter === "unfiled" ? null : folderFilter;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAnchorIndex(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        clearSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setSelectedIds(new Set(visibleIds));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection, visibleIds]);

  function handleSelectClick(e: React.MouseEvent, id: string, index: number) {
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchorIndex(index);
      return;
    }
    if (e.shiftKey && anchorIndex != null) {
      const from = Math.min(anchorIndex, index);
      const to = Math.max(anchorIndex, index);
      const range = visiblePhotos.slice(from, to + 1).map((p) => p.id);
      setSelectedIds(new Set(range));
      return;
    }
    setSelectedIds(new Set([id]));
    setAnchorIndex(index);
  }

  function rectsIntersect(
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number }
  ) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function onGridPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-photo-id]") || target.closest("button") || target.closest("a")) {
      return;
    }

    const container = scrollRef.current;
    if (!container) return;

    const bounds = container.getBoundingClientRect();
    const startX = e.clientX - bounds.left + container.scrollLeft;
    const startY = e.clientY - bounds.top + container.scrollTop;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    marqueeStart.current = { x: startX, y: startY, additive };
    selectionBeforeMarquee.current = additive ? new Set(selectedIds) : new Set();
    if (!additive) setSelectedIds(new Set());

    const pointerId = e.pointerId;
    container.setPointerCapture(pointerId);

    function onMove(ev: PointerEvent) {
      if (!marqueeStart.current || !scrollRef.current) return;
      const c = scrollRef.current;
      const b = c.getBoundingClientRect();
      const curX = ev.clientX - b.left + c.scrollLeft;
      const curY = ev.clientY - b.top + c.scrollTop;
      const dx = curX - marqueeStart.current.x;
      const dy = curY - marqueeStart.current.y;
      if (Math.hypot(dx, dy) < 4 && !marquee) return;

      const x = Math.min(marqueeStart.current.x, curX);
      const y = Math.min(marqueeStart.current.y, curY);
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      setMarquee({ x, y, w, h });

      const selRect = { left: x, top: y, right: x + w, bottom: y + h };
      const next = new Set(selectionBeforeMarquee.current);
      c.querySelectorAll<HTMLElement>("[data-photo-id]").forEach((el) => {
        const id = el.dataset.photoId;
        if (!id) return;
        const r = el.getBoundingClientRect();
        const local = {
          left: r.left - b.left + c.scrollLeft,
          top: r.top - b.top + c.scrollTop,
          right: r.right - b.left + c.scrollLeft,
          bottom: r.bottom - b.top + c.scrollTop,
        };
        if (rectsIntersect(selRect, local)) next.add(id);
      });
      setSelectedIds(next);
    }

    function onUp() {
      marqueeStart.current = null;
      setMarquee(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        container?.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function persistOrder(ordered: MediaAsset[], folderId: string | null) {
    const previous = photosRef.current;
    const withOrder = ordered.map((p, i) => ({ ...p, display_order: i, folder_id: folderId }));
    const others = previous.filter((m) => !ordered.some((p) => p.id === m.id));
    onPhotosChange(sortPhotos([...others, ...withOrder]));

    const res = await fetch("/api/media/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: projectId,
        folder_id: folderId,
        ordered_ids: ordered.map((p) => p.id),
      }),
    });

    if (!res.ok) {
      onPhotosChange(previous);
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || "Failed to save order");
      return false;
    }
    onRefresh?.();
    return true;
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const selected = selectedIds.has(id) ? Array.from(selectedIds) : [id];
    const ordered = visibleIds.filter((vid) => selected.includes(vid));
    setActiveDragIds(ordered);
    if (!selectedIds.has(id)) setSelectedIds(new Set([id]));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const dragging = activeDragIds;
    setActiveDragIds([]);
    if (!over || dragging.length === 0) return;
    if (folderFilter === "all") {
      toast.message("Switch to a folder or Unfiled to reorder photos");
      return;
    }

    const current = [...visiblePhotos];

    if (dragging.length === 1 && active.id !== over.id) {
      const oldIndex = current.findIndex((p) => p.id === active.id);
      const newIndex = current.findIndex((p) => p.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        await persistOrder(arrayMove(current, oldIndex, newIndex), currentFolderId);
        return;
      }
    }

    const overId = String(over.id);
    const fromIndexes = dragging
      .map((id) => current.findIndex((p) => p.id === id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    if (!fromIndexes.length) return;

    const moving = fromIndexes.map((i) => current[i]);
    const remaining = current.filter((p) => !dragging.includes(p.id));
    let toIndex = remaining.findIndex((p) => p.id === overId);
    if (toIndex < 0) toIndex = remaining.length;

    const next = [...remaining.slice(0, toIndex), ...moving, ...remaining.slice(toIndex)];
    await persistOrder(next, currentFolderId);
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/media-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project_id: projectId, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create folder");
        return;
      }
      onFoldersChange(
        [...folders, data as MediaFolder].sort((a, b) => a.display_order - b.display_order)
      );
      setNewFolderOpen(false);
      setNewFolderName("");
      setFolderFilter(data.id);
      toast.success("Folder created");
      onRefresh?.();
    } finally {
      setCreatingFolder(false);
    }
  }

  async function deleteFolder(folder: MediaFolder) {
    if (
      !confirm(
        `Delete folder "${folder.name}"? Photos inside will not be deleted — they will move to Unfiled.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/media-folders?id=${folder.id}&project_id=${projectId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || "Failed to delete folder");
      return;
    }
    onFoldersChange(folders.filter((f) => f.id !== folder.id));
    onPhotosChange(photos.map((p) => (p.folder_id === folder.id ? { ...p, folder_id: null } : p)));
    if (folderFilter === folder.id) setFolderFilter("all");
    toast.success("Folder deleted — photos moved to Unfiled");
    onRefresh?.();
  }

  async function renameFolder(folder: MediaFolder) {
    const name = window.prompt("Rename folder", folder.name)?.trim();
    if (!name || name === folder.name) return;
    const res = await fetch("/api/media-folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: folder.id, project_id: projectId, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error((data as { error?: string }).error || "Failed to rename");
      return;
    }
    onFoldersChange(folders.map((f) => (f.id === folder.id ? { ...f, name } : f)));
    toast.success("Folder renamed");
  }

  async function moveSelectedToFolder(targetFolderId: string | null) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const previous = photos;
    onPhotosChange(
      photos.map((p) => (ids.includes(p.id) ? { ...p, folder_id: targetFolderId } : p))
    );
    const res = await fetch("/api/media/move-to-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: projectId,
        folder_id: targetFolderId,
        photo_ids: ids,
      }),
    });
    if (!res.ok) {
      onPhotosChange(previous);
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || "Failed to move photos");
      return;
    }
    clearSelection();
    toast.success(
      targetFolderId
        ? `Moved ${ids.length} photo${ids.length === 1 ? "" : "s"}`
        : `Removed ${ids.length} photo${ids.length === 1 ? "" : "s"} from folder`
    );
    onRefresh?.();
  }

  async function saveRename() {
    if (!renameId) return;
    const title = renameValue.trim();
    if (!title) {
      toast.error("Title cannot be empty");
      return;
    }
    const res = await fetch(`/api/media/${renameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: renameId, title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error((data as { error?: string }).error || "Failed to rename");
      return;
    }
    onPhotosChange(photos.map((p) => (p.id === renameId ? { ...p, ...(data as MediaAsset) } : p)));
    setRenameId(null);
    toast.success("Photo renamed");
    onRefresh?.();
  }

  const canReorder = folderFilter !== "all";
  const photoCount = photos.filter((p) => p.media_type === "photo").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFolderFilter("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            folderFilter === "all" ? "bg-accent text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          )}
        >
          All photos ({photoCount})
        </button>
        <button
          type="button"
          onClick={() => setFolderFilter("unfiled")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            folderFilter === "unfiled" ? "bg-accent text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          )}
        >
          Unfiled ({folderCounts.get("null") ?? 0})
        </button>
        {folders.map((folder) => (
          <div key={folder.id} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setFolderFilter(folder.id)}
              onDragOver={(e) => {
                if (selectedIds.size) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (selectedIds.size) void moveSelectedToFolder(folder.id);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                folderFilter === folder.id
                  ? "bg-accent text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {folder.name} ({folderCounts.get(folder.id) ?? 0})
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Rename folder"
              onClick={() => void renameFolder(folder)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-500"
              title="Delete folder"
              onClick={() => void deleteFolder(folder)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-8" onClick={() => setNewFolderOpen(true)}>
          <FolderPlus className="h-3.5 w-3.5" /> New folder
        </Button>
      </div>

      {!canReorder && visiblePhotos.length > 1 && (
        <p className="text-xs text-muted">
          Open Unfiled or a folder to drag-reorder. Selection and Move to folder work in All photos.
        </p>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
          <Button variant="ghost" size="sm" className="h-8" onClick={clearSelection}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="min-w-[10rem]"
              value={moveFolderId}
              onChange={(e) => setMoveFolderId(e.target.value)}
              placeholder="Move to folder…"
              options={[
                { value: "__unfiled__", label: "Remove from folder (Unfiled)" },
                ...folders.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!moveFolderId}
              onClick={() => {
                const target = moveFolderId === "__unfiled__" ? null : moveFolderId;
                void moveSelectedToFolder(target);
                setMoveFolderId("");
              }}
            >
              <FolderInput className="h-3.5 w-3.5" /> Move
            </Button>
          </div>
        </div>
      )}

      {visiblePhotos.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">No photos in this view</p>
      ) : (
        <div
          ref={scrollRef}
          className="relative max-h-[70vh] overflow-auto rounded-lg"
          onPointerDown={onGridPointerDown}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={(e) => void handleDragEnd(e)}
            autoScroll
          >
            <SortableContext items={visibleIds} strategy={rectSortingStrategy} disabled={!canReorder}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visiblePhotos.map((p, i) => (
                  <SortablePhotoCard
                    key={p.id}
                    photo={p}
                    index={i}
                    selected={selectedIds.has(p.id)}
                    isHeroPhoto={isHero(p.id)}
                    onSelectClick={handleSelectClick}
                    onOpen={() => setLightboxPhoto(p)}
                    onSetHero={() => onSetHero(p.id)}
                    onToggleVisibility={() => onToggleVisibility(p.id, !isClientVisible(p))}
                    onDelete={() => onDelete(p.id)}
                    onRename={() => {
                      setRenameId(p.id);
                      setRenameValue(mediaDisplayName(p));
                    }}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragIds.length > 0 ? (
                <div className="relative h-28 w-28">
                  <div className="absolute inset-0 rotate-[-4deg] rounded-lg bg-slate-200 shadow" />
                  <div className="absolute inset-0 rotate-[3deg] rounded-lg bg-slate-100 shadow" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-accent bg-white text-sm font-semibold text-primary shadow-lg">
                    {activeDragIds.length} photo{activeDragIds.length === 1 ? "" : "s"}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {marquee && (
            <div
              className="pointer-events-none absolute z-20 border border-accent/80 bg-accent/15"
              style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
            />
          )}
        </div>
      )}

      <Modal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="New photo folder"
        footer={
          <Button
            variant="accent"
            className="w-full min-h-11"
            disabled={creatingFolder}
            onClick={() => void createFolder()}
          >
            {creatingFolder ? "Creating…" : "Create folder"}
          </Button>
        }
      >
        <Input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="e.g. Interior"
          className="min-h-11"
          onKeyDown={(e: ReactKeyboardEvent) => {
            if (e.key === "Enter") void createFolder();
          }}
        />
      </Modal>

      <Modal
        open={!!renameId}
        onClose={() => setRenameId(null)}
        title="Rename photo"
        footer={
          <Button variant="accent" className="w-full min-h-11" onClick={() => void saveRename()}>
            Save name
          </Button>
        }
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          maxLength={120}
          className="min-h-11"
          onKeyDown={(e: ReactKeyboardEvent) => {
            if (e.key === "Enter") void saveRename();
          }}
        />
      </Modal>

      {lightboxPhoto && (
        <AdminPhotoLightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onSavedPropertyLine={onPropertyLineSaved}
        />
      )}
    </div>
  );
}
