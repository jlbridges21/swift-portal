"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  Eye,
  EyeOff,
  FolderInput,
  FolderPlus,
  GripVertical,
  Move,
  Pencil,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { createThumbRequestQueue } from "@/lib/media-thumb-client";
import { isClientVisibleMedia } from "@/lib/client-media";

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
  return isClientVisibleMedia(asset);
}

/** Project-wide photo order — folders are a filter, not a sort key. */
function sortByDisplayOrder(list: MediaAsset[]) {
  return [...list].sort((a, b) => {
    const order = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (order !== 0) return order;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/**
 * Reorder a visible subset into the same display_order slots it occupied.
 * Non-visible photos keep their display_order unchanged.
 */
function applySlotReorder(
  allPhotos: MediaAsset[],
  previousVisible: MediaAsset[],
  nextVisibleOrdered: MediaAsset[]
): MediaAsset[] {
  const slots = previousVisible
    .map((p) => p.display_order ?? 0)
    .sort((a, b) => a - b);

  const newOrderById = new Map<string, number>();
  nextVisibleOrdered.forEach((p, i) => {
    newOrderById.set(p.id, slots[i] ?? i);
  });

  return sortByDisplayOrder(
    allPhotos.map((p) =>
      newOrderById.has(p.id) ? { ...p, display_order: newOrderById.get(p.id)! } : p
    )
  );
}

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return coarse;
}

function PhotoThumb({
  assetId,
  selected,
  url,
  onVisible,
}: {
  assetId: string;
  selected: boolean;
  url: string | null;
  onVisible: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || url) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onVisible(assetId);
      },
      { rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [assetId, onVisible, url]);

  return (
    <div ref={ref} className="relative aspect-square w-full bg-slate-100">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="pointer-events-none h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-slate-200" />
      )}
      {selected && <div className="absolute inset-0 bg-slate-900/45" />}
    </div>
  );
}

function InsertionGap({ onInsert, label }: { onInsert: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onInsert}
      aria-label={label}
      className="flex min-h-[2.75rem] w-full items-center justify-center rounded-lg border-2 border-dashed border-accent/50 bg-accent/5 px-2 text-xs font-medium text-accent active:bg-accent/15 sm:aspect-square sm:min-h-0"
    >
      Move here
    </button>
  );
}

function SortablePhotoCard({
  photo,
  index,
  selected,
  isHeroPhoto,
  coarsePointer,
  selectMode,
  placementMode,
  showHandle,
  thumbUrl,
  onThumbVisible,
  onActivate,
  onOpen,
  onSetHero,
  onToggleVisibility,
  onDelete,
  onRename,
  onLongPressSelect,
  onToggleSelect,
  onPaintSelectEnter,
  onPaintSelectMove,
  onPaintSelectEnd,
}: {
  photo: MediaAsset;
  index: number;
  selected: boolean;
  isHeroPhoto: boolean;
  coarsePointer: boolean;
  selectMode: boolean;
  placementMode: boolean;
  showHandle: boolean;
  thumbUrl: string | null;
  onThumbVisible: (id: string) => void;
  onActivate: (e: ReactMouseEvent, id: string, index: number) => void;
  onOpen: () => void;
  onSetHero: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onRename: () => void;
  onLongPressSelect: (id: string, index: number) => void;
  onToggleSelect: (id: string, index: number) => void;
  onPaintSelectEnter: (id: string, index: number) => void;
  onPaintSelectMove: (clientX: number, clientY: number) => void;
  onPaintSelectEnd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
    disabled: placementMode,
  });

  const longPressTimer = useRef<number | null>(null);
  const longPressMoved = useRef(false);
  const paintStarted = useRef(false);
  const paintMoved = useRef(false);
  const skipNextClick = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Outside select mode: allow vertical scroll through the tile.
    // In select mode: none so paint-select isn't stolen by the browser.
    // Drag handle always uses touch-action: none separately.
    touchAction: (selectMode || placementMode ? "none" : "pan-y") as "none" | "pan-y",
    userSelect: "none" as const,
  };

  // Split activators: mouse on whole tile, touch only on handle
  const mouseListeners = listeners
    ? { onMouseDown: listeners.onMouseDown as React.MouseEventHandler | undefined }
    : {};
  const touchListeners = listeners
    ? { onTouchStart: listeners.onTouchStart as React.TouchEventHandler | undefined }
    : {};
  const keyListeners = listeners
    ? { onKeyDown: listeners.onKeyDown as React.KeyboardEventHandler | undefined }
    : {};

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function onTouchStartTile(e: ReactTouchEvent) {
    if (!coarsePointer || placementMode) return;
    // Don't compete with the drag handle
    if ((e.target as HTMLElement).closest("[data-drag-handle]")) return;

    longPressMoved.current = false;
    paintStarted.current = false;
    paintMoved.current = false;
    const t = e.touches[0];
    touchStartPos.current = t ? { x: t.clientX, y: t.clientY } : null;

    if (selectMode) {
      paintStarted.current = true;
      skipNextClick.current = true;
      // Defer toggle until touchend if this is a tap; paint-move will select a run
      return;
    }

    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      if (!longPressMoved.current) {
        skipNextClick.current = true;
        onLongPressSelect(photo.id, index);
      }
    }, 450);
  }

  function onTouchMoveTile(e: ReactTouchEvent) {
    if (!coarsePointer) return;
    const t = e.touches[0];
    if (!t || !touchStartPos.current) return;

    const dist = Math.hypot(
      t.clientX - touchStartPos.current.x,
      t.clientY - touchStartPos.current.y
    );
    if (dist <= 8) return;

    if (!longPressMoved.current) {
      longPressMoved.current = true;
      skipNextClick.current = true; // scrolling — don't open via synthetic click
    }
    clearLongPress();

    if (!paintStarted.current) return;

    if (!paintMoved.current) {
      paintMoved.current = true;
      onPaintSelectEnter(photo.id, index);
    }
    onPaintSelectMove(t.clientX, t.clientY);
  }

  function onTouchEndTile() {
    clearLongPress();
    if (paintStarted.current) {
      if (!paintMoved.current) {
        onToggleSelect(photo.id, index);
      }
      paintStarted.current = false;
      paintMoved.current = false;
      onPaintSelectEnd();
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-photo-id={photo.id}
      data-photo-index={index}
      {...attributes}
      {...(placementMode || (coarsePointer && selectMode) ? {} : mouseListeners)}
      {...keyListeners}
      onClick={(e) => {
        if (placementMode) return;
        if (skipNextClick.current) {
          skipNextClick.current = false;
          return;
        }
        onActivate(e, photo.id, index);
      }}
      onTouchStart={onTouchStartTile}
      onTouchMove={onTouchMoveTile}
      onTouchEnd={onTouchEndTile}
      onTouchCancel={onTouchEndTile}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-white transition-shadow select-none",
        !coarsePointer && !placementMode && "cursor-grab active:cursor-grabbing",
        selected
          ? "border-accent ring-2 ring-accent shadow-md"
          : "border-border hover:border-slate-300",
        isDragging && "opacity-40",
        placementMode && selected && "scale-[0.97] opacity-30",
        placementMode && !selected && "opacity-80"
      )}
    >
      {coarsePointer && selectMode && (
        <div
          className={cn(
            "absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow",
            selected
              ? "border-accent bg-accent text-accent-foreground"
              : "border-white bg-black/30 text-transparent"
          )}
          aria-hidden
        >
          <Check className="h-4 w-4" />
        </div>
      )}

      {showHandle && !placementMode && (
        <button
          type="button"
          data-drag-handle
          aria-label="Drag to reorder"
          className="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-lg bg-black/45 text-white"
          style={{ touchAction: "none" }}
          {...touchListeners}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}

      <PhotoThumb
        assetId={photo.id}
        selected={selected}
        url={thumbUrl}
        onVisible={onThumbVisible}
      />
      <div className="space-y-2 p-2">
        <p className="line-clamp-2 text-xs text-foreground">{mediaDisplayName(photo)}</p>
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
        {!selectMode && !placementMode && (
          <div
            className="flex flex-wrap gap-1"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              title="Open fullscreen"
              onClick={onOpen}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              title={isClientVisible(photo) ? "Hide from client" : "Show to client"}
              onClick={onToggleVisibility}
            >
              {isClientVisible(photo) ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onSetHero}>
              Hero
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onRename}
              title="Rename"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-500"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
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
  const coarsePointer = useCoarsePointer();
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<MediaAsset | null>(null);
  const [activeDragIds, setActiveDragIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveFolderId, setMoveFolderId] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const thumbQueueRef = useRef(
    createThumbRequestQueue((urls) => {
      setThumbUrls((prev) => ({ ...prev, ...urls }));
    })
  );
  const onThumbVisible = useCallback((id: string) => {
    thumbQueueRef.current.request(id);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const marqueeStart = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const selectionBeforeMarquee = useRef<Set<string>>(new Set());
  const photosRef = useRef(photos);
  const justDraggedRef = useRef(false);
  const paintSelectActive = useRef(false);
  const undoSnapshotRef = useRef<MediaAsset[] | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const allProjectPhotos = useMemo(
    () => sortByDisplayOrder(photos.filter((p) => p.media_type === "photo")),
    [photos]
  );

  const visiblePhotos = useMemo(() => {
    let list = allProjectPhotos;
    if (folderFilter === "unfiled") list = list.filter((p) => !p.folder_id);
    else if (folderFilter !== "all") list = list.filter((p) => p.folder_id === folderFilter);
    return list;
  }, [allProjectPhotos, folderFilter]);

  const visibleIds = useMemo(() => visiblePhotos.map((p) => p.id), [visiblePhotos]);

  const folderCounts = useMemo(() => {
    const map = new Map<string | "null", number>();
    for (const p of allProjectPhotos) {
      const key = (p.folder_id ?? "null") as string | "null";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [allProjectPhotos]);

  // Mount all sensors always — hybrid devices need both mouse and touch paths
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAnchorIndex(null);
    setSelectMode(false);
    setPlacementMode(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (placementMode) {
          setPlacementMode(false);
          return;
        }
        clearSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setSelectedIds(new Set(visibleIds));
        if (coarsePointer) setSelectMode(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection, visibleIds, placementMode, coarsePointer]);

  async function persistFullOrder(
    orderedPhotos: MediaAsset[],
    opts?: { undoable?: boolean }
  ): Promise<boolean> {
    const previous = photosRef.current;
    if (opts?.undoable) undoSnapshotRef.current = previous;

    const withOrder = orderedPhotos.map((p, i) => ({ ...p, display_order: i }));
    const others = previous.filter((m) => m.media_type !== "photo");
    onPhotosChange([...others, ...withOrder]);

    const res = await fetch("/api/media/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: projectId,
        ordered_ids: withOrder.map((p) => p.id),
      }),
    });

    if (!res.ok) {
      onPhotosChange(previous);
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || "Failed to save order");
      return false;
    }

    if (opts?.undoable) {
      toast.success("Photos moved", {
        action: {
          label: "Undo",
          onClick: () => {
            const snap = undoSnapshotRef.current;
            if (!snap) return;
            void persistFullOrder(
              sortByDisplayOrder(snap.filter((p) => p.media_type === "photo")),
              { undoable: false }
            );
          },
        },
      });
    }

    onRefresh?.();
    return true;
  }

  async function moveSelectionToInsertIndex(insertIndex: number) {
    if (!selectedIds.size) return;
    const previousVisible = [...visiblePhotos];
    const selectedOrdered = previousVisible.filter((p) => selectedIds.has(p.id));
    const remaining = previousVisible.filter((p) => !selectedIds.has(p.id));
    const clamped = Math.max(0, Math.min(insertIndex, remaining.length));
    const nextVisible = [
      ...remaining.slice(0, clamped),
      ...selectedOrdered,
      ...remaining.slice(clamped),
    ];
    const merged = applySlotReorder(allProjectPhotos, previousVisible, nextVisible);
    const ok = await persistFullOrder(merged, { undoable: true });
    if (ok) {
      setPlacementMode(false);
      if (coarsePointer) {
        setSelectMode(false);
        setSelectedIds(new Set());
        setAnchorIndex(null);
      }
    }
  }

  function handleActivate(e: ReactMouseEvent, id: string, index: number) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (placementMode) return;

    // Coarse pointer: tap opens photo unless Select mode is on
    if (coarsePointer) {
      if (selectMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        setAnchorIndex(index);
        return;
      }
      setLightboxPhoto(visiblePhotos[index] ?? null);
      return;
    }

    // Desktop — Cmd/Shift/click selection (unchanged)
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
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
      e.preventDefault();
      const from = Math.min(anchorIndex, index);
      const to = Math.max(anchorIndex, index);
      setSelectedIds(new Set(visiblePhotos.slice(from, to + 1).map((p) => p.id)));
      return;
    }
    setSelectedIds(new Set([id]));
    setAnchorIndex(index);
  }

  function onLongPressSelect(id: string, index: number) {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
    setAnchorIndex(index);
  }

  function onToggleSelect(id: string, index: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchorIndex(index);
  }

  function onPaintSelectEnter(id: string, index: number) {
    paintSelectActive.current = true;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setAnchorIndex(index);
  }

  function onPaintSelectMove(clientX: number, clientY: number) {
    if (!paintSelectActive.current) return;
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const tile = el?.closest?.("[data-photo-id]") as HTMLElement | null;
    const id = tile?.dataset.photoId;
    if (!id) return;
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function onPaintSelectEnd() {
    paintSelectActive.current = false;
  }

  function rectsIntersect(
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number }
  ) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  /** Marquee — mouse only. Never binds to touch. */
  function onGridMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if (placementMode) return;
    if (coarsePointer && selectMode) return;

    const target = e.target as HTMLElement;
    if (target.closest("[data-photo-id]")) return;
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;

    const container = scrollRef.current;
    if (!container) return;

    const bounds = container.getBoundingClientRect();
    const startX = e.clientX - bounds.left + container.scrollLeft;
    const startY = e.clientY - bounds.top + container.scrollTop;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    marqueeStart.current = { x: startX, y: startY, additive };
    selectionBeforeMarquee.current = additive ? new Set(selectedIds) : new Set();
    if (!additive) setSelectedIds(new Set());

    function onMove(ev: MouseEvent) {
      if (!marqueeStart.current || !scrollRef.current) return;
      const c = scrollRef.current;
      const b = c.getBoundingClientRect();
      const curX = ev.clientX - b.left + c.scrollLeft;
      const curY = ev.clientY - b.top + c.scrollTop;
      const dx = curX - marqueeStart.current.x;
      const dy = curY - marqueeStart.current.y;
      if (Math.hypot(dx, dy) < 4) return;

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
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    justDraggedRef.current = true;
    const selected = selectedIds.has(id) ? Array.from(selectedIds) : [id];
    const ordered = visibleIds.filter((vid) => selected.includes(vid));
    setActiveDragIds(ordered);
    if (!selectedIds.has(id)) setSelectedIds(new Set([id]));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const dragging = activeDragIds;
    setActiveDragIds([]);
    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);

    if (!over || dragging.length === 0) return;
    if (String(active.id) === String(over.id) && dragging.length === 1) return;

    const previousVisible = [...visiblePhotos];
    let nextVisible = [...previousVisible];

    if (dragging.length === 1) {
      const oldIndex = nextVisible.findIndex((p) => p.id === active.id);
      const newIndex = nextVisible.findIndex((p) => p.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      nextVisible = arrayMove(nextVisible, oldIndex, newIndex);
    } else {
      const overId = String(over.id);
      const fromIndexes = dragging
        .map((id) => nextVisible.findIndex((p) => p.id === id))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      if (!fromIndexes.length) return;

      const moving = fromIndexes.map((i) => nextVisible[i]);
      const remaining = nextVisible.filter((p) => !dragging.includes(p.id));
      let toIndex = remaining.findIndex((p) => p.id === overId);
      if (toIndex < 0) toIndex = remaining.length;
      nextVisible = [...remaining.slice(0, toIndex), ...moving, ...remaining.slice(toIndex)];
    }

    const merged = applySlotReorder(allProjectPhotos, previousVisible, nextVisible);
    await persistFullOrder(merged);
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
    onPhotosChange(
      photos.map((p) => (p.folder_id === folder.id ? { ...p, folder_id: null } : p))
    );
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

  const selectionCount = selectedIds.size;
  const showSelectionChrome = selectionCount > 0 || (coarsePointer && selectMode);
  const remainingCount = visiblePhotos.length - selectionCount;

  const selectionActions = (
    <>
      <span className="text-sm font-medium text-primary">
        {selectionCount} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {selectionCount > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => void moveSelectionToInsertIndex(0)}
            >
              <ArrowUpToLine className="h-3.5 w-3.5" /> Top
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => void moveSelectionToInsertIndex(remainingCount)}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> Bottom
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPlacementMode(true)}
            >
              <Move className="h-3.5 w-3.5" /> Move
            </Button>
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
              type="button"
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
              <FolderInput className="h-3.5 w-3.5" /> Folder
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => {
            setSelectedIds(new Set(visibleIds));
            if (coarsePointer) setSelectMode(true);
          }}
        >
          Select all
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={clearSelection}>
          <X className="h-3.5 w-3.5" /> {coarsePointer ? "Done" : "Clear"}
        </Button>
      </div>
    </>
  );

  return (
    <div className={cn("space-y-3", coarsePointer && showSelectionChrome && "pb-28")}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFolderFilter("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            folderFilter === "all"
              ? "bg-accent text-accent-foreground"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          )}
        >
          All photos ({allProjectPhotos.length})
        </button>
        <button
          type="button"
          onClick={() => setFolderFilter("unfiled")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            folderFilter === "unfiled"
              ? "bg-accent text-accent-foreground"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                  ? "bg-accent text-accent-foreground"
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

        {coarsePointer && !placementMode && (
          <Button
            type="button"
            variant={selectMode ? "accent" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => {
              if (selectMode) clearSelection();
              else setSelectMode(true);
            }}
          >
            {selectMode ? "Selecting…" : "Select"}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted">
        {coarsePointer
          ? "Tap Select (or long-press a photo) to multi-select. Use Move, Top, or Bottom to reorder. Press-and-hold the grip to drag one photo."
          : "Drag photos to reorder. Cmd/Ctrl-click or marquee to multi-select, then drag the group. Use Move for placement."}
      </p>

      {placementMode && (
        <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2">
          <p className="text-sm font-medium text-primary">
            Tap where to move {selectionCount} photo{selectionCount === 1 ? "" : "s"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setPlacementMode(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Desktop selection bar (top) */}
      {!coarsePointer && showSelectionChrome && !placementMode && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2">
          {selectionActions}
        </div>
      )}

      {visiblePhotos.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">No photos in this view</p>
      ) : (
        <div
          ref={scrollRef}
          className="relative max-h-[70vh] overflow-auto rounded-lg"
          onMouseDown={onGridMouseDown}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={(e) => void handleDragEnd(e)}
            onDragCancel={() => {
              setActiveDragIds([]);
              window.setTimeout(() => {
                justDraggedRef.current = false;
              }, 0);
            }}
            autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 12 }}
          >
            <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {placementMode && (
                  <InsertionGap
                    onInsert={() => void moveSelectionToInsertIndex(0)}
                    label="Move here (start)"
                  />
                )}
                {visiblePhotos.map((p, i) => (
                  <div key={p.id} className="contents">
                    <SortablePhotoCard
                      photo={p}
                      index={i}
                      selected={selectedIds.has(p.id)}
                      isHeroPhoto={isHero(p.id)}
                      coarsePointer={coarsePointer}
                      selectMode={Boolean(coarsePointer && selectMode)}
                      placementMode={placementMode}
                      showHandle
                      thumbUrl={thumbUrls[p.id] ?? null}
                      onThumbVisible={onThumbVisible}
                      onActivate={handleActivate}
                      onOpen={() => {
                        if (placementMode) return;
                        if (coarsePointer && selectMode) return;
                        setLightboxPhoto(p);
                      }}
                      onSetHero={() => onSetHero(p.id)}
                      onToggleVisibility={() =>
                        onToggleVisibility(p.id, !isClientVisible(p))
                      }
                      onDelete={() => onDelete(p.id)}
                      onRename={() => {
                        setRenameId(p.id);
                        setRenameValue(mediaDisplayName(p));
                      }}
                      onLongPressSelect={onLongPressSelect}
                      onToggleSelect={onToggleSelect}
                      onPaintSelectEnter={onPaintSelectEnter}
                      onPaintSelectMove={onPaintSelectMove}
                      onPaintSelectEnd={onPaintSelectEnd}
                    />
                    {placementMode && (
                      <InsertionGap
                        onInsert={() =>
                          void moveSelectionToInsertIndex(
                            visiblePhotos
                              .slice(0, i + 1)
                              .filter((photo) => !selectedIds.has(photo.id)).length
                          )
                        }
                        label="Move here"
                      />
                    )}
                  </div>
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeDragIds.length > 0 ? (
                <div className="relative h-28 w-28 select-none">
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

      {/* Mobile selection bar (bottom, thumb-reachable) */}
      {coarsePointer && showSelectionChrome && !placementMode && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-accent/30 bg-accent/5 px-3 py-3 backdrop-blur"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-2">{selectionActions}</div>
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
