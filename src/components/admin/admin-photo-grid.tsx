"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
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
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
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
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GripVertical,
  ImageOff,
  ImagePlus,
  Images,
  Link2,
  MoreHorizontal,
  Move,
  Pencil,
  RotateCw,
  Share2,
  Star,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPhotoLightbox } from "@/components/admin/admin-photo-lightbox";
import { DownloadQualityDialog } from "@/components/projects/download-quality-dialog";
import { useProjectZipDownload } from "@/components/projects/project-zip-download";
import {
  FOLDER_DROP_PREFIX,
  NewFolderTile,
  PhotoFolderTile,
  photoCountLabel,
} from "@/components/admin/photo-folder-tile";
import { MoveToFolderDialog, NameDialog } from "@/components/admin/photo-grid-dialogs";
import { mediaDisplayName } from "@/lib/media-display-name";
import { downloadMediaAsset } from "@/lib/download";
import { cn } from "@/lib/utils";
import type { MediaAsset, MediaFolder } from "@/lib/types";
import type { PhotoShareSummary } from "@/lib/media-share-types";
import { createThumbRequestQueue, getCachedThumbUrl, invalidateThumbUrl } from "@/lib/media-thumb-client";
import { isClientVisibleMedia } from "@/lib/client-media";
import {
  countFolderDownloadableAssets,
  UNFILED_FOLDER_LABEL,
  UNFILED_FOLDER_SCOPE,
} from "@/lib/project-zip-assets";

/** `all` = every photo; `unfiled` = General Photos; otherwise a folder id. */
type PhotoView = "all" | typeof UNFILED_FOLDER_SCOPE | string;

const PHOTO_ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const VIEW_QUERY_PARAM = "folder";
const THUMB_FAIL_LIMIT = 2;

interface AdminPhotoGridProps {
  projectId: string;
  photos: MediaAsset[];
  folders: MediaFolder[];
  isHero: (id: string) => boolean;
  onSetHero: (id: string) => void;
  /** Called after the grid has confirmed the deletion with the user. */
  onDelete: (id: string) => Promise<boolean> | void;
  onPhotosChange: (photos: MediaAsset[]) => void;
  onFoldersChange: (folders: MediaFolder[]) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onUploadFiles: (files: File[], folderId: string | null) => void;
  onPropertyLineSaved?: (asset: Record<string, unknown>) => void;
  onRefresh?: () => void;
  /** Active individual shares by asset id — drives the Shared badge and move/delete warnings. */
  shareSummary?: Record<string, PhotoShareSummary>;
  onShare?: (photo: MediaAsset) => void;
  /** Rendered beside the breadcrumb (e.g. client visibility toggle). */
  headerSlot?: React.ReactNode;
  maxFileSizeLabel?: string;
}

function isClientVisible(asset: MediaAsset) {
  return isClientVisibleMedia(asset);
}

/** Project-wide photo order. Folder views show a subset in that same order. */
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
  const slots = previousVisible.map((p) => p.display_order ?? 0).sort((a, b) => a - b);

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

/** Folder tiles take priority while the pointer is over one; otherwise sort among photos. */
const photoCollision: CollisionDetection = (args) => {
  const folderTargets = args.droppableContainers.filter((c) =>
    String(c.id).startsWith(FOLDER_DROP_PREFIX)
  );
  if (folderTargets.length) {
    const hits = pointerWithin({ ...args, droppableContainers: folderTargets });
    if (hits.length) return hits;
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => !String(c.id).startsWith(FOLDER_DROP_PREFIX)
    ),
  });
};

function PhotoThumb({
  assetId,
  selected,
  url,
  failed,
  onVisible,
  onImageError,
  onRetry,
  scrollRoot,
}: {
  assetId: string;
  selected: boolean;
  url: string | null;
  failed: boolean;
  onVisible: (id: string) => void;
  onImageError: (id: string) => void;
  onRetry: (id: string) => void;
  /** Nested overflow scroller — required so IO fires inside max-h overflow-auto. */
  scrollRoot: Element | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || url || failed) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onVisible(assetId);
      },
      // Root must be the grid scroller (not the viewport). Viewport-rooted IO
      // often never crosses threshold for tiles inside max-h-[70vh] overflow-auto.
      { root: scrollRoot, rootMargin: "160px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [assetId, onVisible, url, failed, scrollRoot]);

  return (
    <div
      ref={ref}
      className="relative aspect-square w-full bg-subtle"
      onMouseEnter={() => {
        if (!url && !failed) onVisible(assetId);
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="pointer-events-none h-full w-full object-cover"
          draggable={false}
          onError={() => onImageError(assetId)}
        />
      ) : failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted">
          <ImageOff className="h-6 w-6 opacity-70" />
          <span className="text-[11px]">Preview unavailable</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent-subtle"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(assetId);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <RotateCw className="h-3 w-3" /> Retry
          </button>
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-border/60" />
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

function PhotoBadge({ children, tone }: { children: React.ReactNode; tone: "accent" | "amber" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur",
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "amber" && "bg-amber-400/95 text-amber-950",
        tone === "neutral" && "bg-black/60 text-white"
      )}
    >
      {children}
    </span>
  );
}

function SortablePhotoCard({
  photo,
  index,
  selected,
  isHeroPhoto,
  shared,
  folderName,
  coarsePointer,
  selectMode,
  placementMode,
  thumbUrl,
  thumbFailed,
  onThumbVisible,
  onThumbError,
  onThumbRetry,
  scrollRoot,
  onActivate,
  onOpen,
  onMenu,
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
  shared: boolean;
  folderName: string | null;
  coarsePointer: boolean;
  selectMode: boolean;
  placementMode: boolean;
  thumbUrl: string | null;
  thumbFailed: boolean;
  onThumbVisible: (id: string) => void;
  onThumbError: (id: string) => void;
  onThumbRetry: (id: string) => void;
  scrollRoot: Element | null;
  onActivate: (e: ReactMouseEvent, id: string, index: number) => void;
  onOpen: () => void;
  onMenu: (photo: MediaAsset, anchor: ActionMenuAnchor) => void;
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
    const target = e.target as HTMLElement;
    if (target.closest("[data-drag-handle]") || target.closest("[data-photo-menu]")) return;

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

    const dist = Math.hypot(t.clientX - touchStartPos.current.x, t.clientY - touchStartPos.current.y);
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

  const name = mediaDisplayName(photo);
  const hidden = !isClientVisible(photo);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-photo-id={photo.id}
      data-photo-index={index}
      {...attributes}
      aria-label={`${name}${selected ? ", selected" : ""}`}
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
      onDoubleClick={() => {
        if (!coarsePointer && !placementMode) onOpen();
      }}
      onContextMenu={(e) => {
        if (placementMode || coarsePointer) return;
        e.preventDefault();
        onMenu(photo, { kind: "point", x: e.clientX, y: e.clientY, element: e.currentTarget });
      }}
      onTouchStart={onTouchStartTile}
      onTouchMove={onTouchMoveTile}
      onTouchEnd={onTouchEndTile}
      onTouchCancel={onTouchEndTile}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card transition-shadow select-none",
        !coarsePointer && !placementMode && "cursor-grab active:cursor-grabbing",
        selected ? "border-accent ring-2 ring-accent shadow-md" : "border-border hover:border-accent/40",
        isDragging && "opacity-40",
        placementMode && selected && "scale-[0.97] opacity-30",
        placementMode && !selected && "opacity-80"
      )}
    >
      {(coarsePointer && selectMode) || (!coarsePointer && selected) ? (
        <div
          className={cn(
            "absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow",
            selected ? "border-accent bg-accent text-accent-foreground" : "border-white bg-black/30 text-transparent"
          )}
          aria-hidden
        >
          <Check className="h-4 w-4" />
        </div>
      ) : null}

      {coarsePointer && !placementMode && !selectMode && (
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

      <div className="relative">
        <PhotoThumb
          assetId={photo.id}
          selected={selected}
          url={thumbUrl}
          failed={thumbFailed}
          onVisible={onThumbVisible}
          onImageError={onThumbError}
          onRetry={onThumbRetry}
          scrollRoot={scrollRoot}
        />
        {(isHeroPhoto || hidden || shared) && (
          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-1">
            {isHeroPhoto && (
              <PhotoBadge tone="accent">
                <Star className="h-2.5 w-2.5" /> Cover
              </PhotoBadge>
            )}
            {hidden && (
              <PhotoBadge tone="amber">
                <EyeOff className="h-2.5 w-2.5" /> Hidden
              </PhotoBadge>
            )}
            {shared && (
              <PhotoBadge tone="neutral">
                <Link2 className="h-2.5 w-2.5" /> Shared
              </PhotoBadge>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 py-1.5 pl-2.5 pr-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground" title={name}>
            {name}
          </p>
          {folderName ? <p className="truncate text-[11px] text-muted">{folderName}</p> : null}
        </div>
        {!placementMode && !(coarsePointer && selectMode) && (
          <button
            type="button"
            data-photo-menu
            aria-label={`Actions for ${name}`}
            aria-haspopup="menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-accent-subtle hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMenu(photo, { kind: "element", element: e.currentTarget });
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

type MenuState = { anchor: ActionMenuAnchor; title: string; items: ActionMenuItem[] };

type DeleteTarget = { kind: "photos"; ids: string[] } | { kind: "folder"; folder: MediaFolder };

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
  onUploadFiles,
  onPropertyLineSaved,
  onRefresh,
  shareSummary,
  onShare,
  headerSlot,
  maxFileSizeLabel,
}: AdminPhotoGridProps) {
  const coarsePointer = useCoarsePointer();
  const [view, setView] = useState<PhotoView>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<MediaAsset | null>(null);
  const [activeDragIds, setActiveDragIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [thumbFailures, setThumbFailures] = useState<Record<string, number>>({});
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [folderDialog, setFolderDialog] = useState<
    { mode: "create"; moveIds?: string[] } | { mode: "rename"; folder: MediaFolder } | null
  >(null);
  const [renamePhoto, setRenamePhoto] = useState<MediaAsset | null>(null);
  const [moveIds, setMoveIds] = useState<string[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [downloadPhoto, setDownloadPhoto] = useState<MediaAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [zipTarget, setZipTarget] = useState<{ scope: string; label: string; count: number } | null>(null);
  const zipStartPending = useRef(false);

  const thumbQueueRef = useRef(
    createThumbRequestQueue((urls, attempted) => {
      setThumbUrls((prev) => ({ ...prev, ...urls }));
      const missed = (attempted ?? []).filter((id) => !urls[id]);
      if (missed.length) {
        setThumbFailures((prev) => {
          const next = { ...prev };
          for (const id of missed) next[id] = (next[id] ?? 0) + 1;
          return next;
        });
      }
    })
  );
  const onThumbVisible = useCallback((id: string) => {
    thumbQueueRef.current.request(id);
  }, []);
  const onThumbRetry = useCallback((id: string) => {
    invalidateThumbUrl(id);
    setThumbFailures((prev) => ({ ...prev, [id]: 0 }));
    setThumbUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    thumbQueueRef.current.request(id);
  }, []);
  const onThumbError = useCallback((id: string) => {
    invalidateThumbUrl(id);
    setThumbUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setThumbFailures((prev) => {
      const count = (prev[id] ?? 0) + 1;
      if (count < THUMB_FAIL_LIMIT) window.setTimeout(() => thumbQueueRef.current.request(id), 400);
      return { ...prev, [id]: count };
    });
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderRef = useRef<string | null>(null);
  const marqueeStart = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const selectionBeforeMarquee = useRef<Set<string>>(new Set());
  const photosRef = useRef(photos);
  const justDraggedRef = useRef(false);
  const paintSelectActive = useRef(false);
  const undoSnapshotRef = useRef<MediaAsset[] | null>(null);
  const fileDragDepth = useRef(0);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const allProjectPhotos = useMemo(
    () => sortByDisplayOrder(photos.filter((p) => p.media_type === "photo")),
    [photos]
  );

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const currentFolder = view !== "all" && view !== UNFILED_FOLDER_SCOPE ? folderById.get(view) ?? null : null;

  // Restore the open folder from ?folder= (deep links from the Media library).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(VIEW_QUERY_PARAM);
    if (!requested) return;
    if (requested === UNFILED_FOLDER_SCOPE || folders.some((f) => f.id === requested)) {
      setView(requested);
    }
    // Only on mount — later navigation is driven by the UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A deleted folder (here or in another tab) drops back to All photos.
  useEffect(() => {
    if (view !== "all" && view !== UNFILED_FOLDER_SCOPE && !folderById.has(view)) setView("all");
  }, [view, folderById]);

  const navigate = useCallback((next: PhotoView) => {
    setView(next);
    setSelectedIds(new Set());
    setAnchorIndex(null);
    setSelectMode(false);
    setPlacementMode(false);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete(VIEW_QUERY_PARAM);
    else url.searchParams.set(VIEW_QUERY_PARAM, next);
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const visiblePhotos = useMemo(() => {
    if (view === "all") return allProjectPhotos;
    if (view === UNFILED_FOLDER_SCOPE) return allProjectPhotos.filter((p) => !p.folder_id);
    return allProjectPhotos.filter((p) => p.folder_id === view);
  }, [allProjectPhotos, view]);

  const visibleIds = useMemo(() => visiblePhotos.map((p) => p.id), [visiblePhotos]);

  const folderStats = useMemo(() => {
    const stats = new Map<string, { count: number; coverId: string | null }>();
    for (const p of allProjectPhotos) {
      const key = p.folder_id ?? UNFILED_FOLDER_SCOPE;
      const entry = stats.get(key) ?? { count: 0, coverId: null };
      entry.count += 1;
      if (!entry.coverId) entry.coverId = p.id;
      stats.set(key, entry);
    }
    return stats;
  }, [allProjectPhotos]);

  const showFolderTiles = view === "all" && folders.length > 0;

  // Bind IO root once the overflow scroller mounts.
  useEffect(() => {
    setScrollRoot(scrollRef.current);
  }, [visiblePhotos.length]);

  // Eager batch (restore pre-IO mount fetch). Do not rely solely on IntersectionObserver
  // inside max-h overflow-auto — a one-shot miss/failed batch left tiles blank forever.
  useEffect(() => {
    const ids = visiblePhotos.map((p) => p.id);
    if (showFolderTiles) {
      for (const s of folderStats.values()) if (s.coverId) ids.push(s.coverId);
    }
    for (const id of ids) thumbQueueRef.current.request(id);
    const retry = window.setTimeout(() => {
      for (const id of ids) {
        if (!getCachedThumbUrl(id)) thumbQueueRef.current.request(id);
      }
    }, 1500);
    return () => window.clearTimeout(retry);
  }, [visibleIds, visiblePhotos, showFolderTiles, folderStats]);

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

  const dialogOpen = Boolean(menu || folderDialog || renamePhoto || moveIds || deleteTarget || downloadPhoto || lightboxPhoto);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (dialogOpen) return;
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
        if (!target?.closest?.("[data-photo-grid]")) return;
        e.preventDefault();
        setSelectedIds(new Set(visibleIds));
        if (coarsePointer) setSelectMode(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection, visibleIds, placementMode, coarsePointer, dialogOpen]);

  const zip = useProjectZipDownload({
    projectId,
    folderId: zipTarget?.scope,
    folderLabel: zipTarget?.label,
    expectedFileCount: zipTarget?.count,
  });

  useEffect(() => {
    if (zipStartPending.current && zipTarget) {
      zipStartPending.current = false;
      zip.start();
    }
  }, [zipTarget, zip]);

  function downloadFolder(scope: string) {
    if (zip.active) {
      toast.info("A folder download is already in progress");
      return;
    }
    const label = scope === UNFILED_FOLDER_SCOPE ? UNFILED_FOLDER_LABEL : folderById.get(scope)?.name ?? "Folder";
    const count = countFolderDownloadableAssets(allProjectPhotos, scope, true);
    if (count <= 0) {
      toast.info(`${label} has no photos to download`);
      return;
    }
    zipStartPending.current = true;
    setZipTarget({ scope, label, count });
  }

  function startUpload(folderId: string | null) {
    uploadFolderRef.current = folderId;
    uploadInputRef.current?.click();
  }

  function submitFiles(files: File[], folderId: string | null) {
    const accepted = files.filter((f) => PHOTO_ACCEPT.includes(f.type));
    const rejected = files.length - accepted.length;
    if (rejected > 0) {
      toast.error(`${rejected} file${rejected === 1 ? "" : "s"} skipped — photos must be JPEG, PNG, or WebP`);
    }
    if (accepted.length) onUploadFiles(accepted, folderId);
  }

  const viewUploadFolder = view === "all" || view === UNFILED_FOLDER_SCOPE ? null : view;
  const viewLabel =
    view === "all" ? "All photos" : view === UNFILED_FOLDER_SCOPE ? UNFILED_FOLDER_LABEL : currentFolder?.name ?? "Folder";

  function hasFiles(e: ReactDragEvent) {
    return Array.from(e.dataTransfer?.types ?? []).includes("Files");
  }

  async function persistFullOrder(orderedPhotos: MediaAsset[], opts?: { undoable?: boolean }): Promise<boolean> {
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
            void persistFullOrder(sortByDisplayOrder(snap.filter((p) => p.media_type === "photo")), {
              undoable: false,
            });
          },
        },
      });
    }

    onRefresh?.();
    return true;
  }

  async function moveIdsToInsertIndex(ids: Set<string>, insertIndex: number) {
    if (!ids.size) return;
    const previousVisible = [...visiblePhotos];
    const selectedOrdered = previousVisible.filter((p) => ids.has(p.id));
    const remaining = previousVisible.filter((p) => !ids.has(p.id));
    const clamped = Math.max(0, Math.min(insertIndex, remaining.length));
    const nextVisible = [...remaining.slice(0, clamped), ...selectedOrdered, ...remaining.slice(clamped)];
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

    const overId = String(over.id);
    if (overId.startsWith(FOLDER_DROP_PREFIX)) {
      const scope = overId.slice(FOLDER_DROP_PREFIX.length);
      requestMove(dragging, scope === UNFILED_FOLDER_SCOPE ? null : scope);
      return;
    }

    if (String(active.id) === overId && dragging.length === 1) return;

    const previousVisible = [...visiblePhotos];
    let nextVisible = [...previousVisible];

    if (dragging.length === 1) {
      const oldIndex = nextVisible.findIndex((p) => p.id === active.id);
      const newIndex = nextVisible.findIndex((p) => p.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      nextVisible = arrayMove(nextVisible, oldIndex, newIndex);
    } else {
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

  async function createFolderRequest(name: string): Promise<MediaFolder | null> {
    const res = await fetch("/api/media-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ project_id: projectId, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error((data as { error?: string }).error || "Failed to create folder");
      return null;
    }
    return data as MediaFolder;
  }

  async function createFolder(name: string, moveAfter?: string[]) {
    setBusy(true);
    try {
      const folder = await createFolderRequest(name);
      if (!folder) return;
      const nextFolders = [...folders, folder].sort((a, b) => a.display_order - b.display_order);
      onFoldersChange(nextFolders);
      setFolderDialog(null);
      if (moveAfter?.length) {
        await moveToFolder(moveAfter, folder.id, folder.name);
      } else {
        toast.success(`Folder “${folder.name}” created`);
        navigate(folder.id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function renameFolder(folder: MediaFolder, name: string) {
    if (name === folder.name) {
      setFolderDialog(null);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/media-folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: folder.id, project_id: projectId, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to rename folder");
        return;
      }
      onFoldersChange(folders.map((f) => (f.id === folder.id ? { ...f, name } : f)));
      setFolderDialog(null);
      toast.success("Folder renamed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(folder: MediaFolder) {
    setBusy(true);
    try {
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
        photosRef.current.map((p) => (p.folder_id === folder.id ? { ...p, folder_id: null } : p))
      );
      if (view === folder.id) navigate("all");
      setDeleteTarget(null);
      toast.success(`Folder deleted — its photos are now in ${UNFILED_FOLDER_LABEL}`);
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  }

  function requestMove(ids: string[], targetFolderId?: string | null) {
    if (!ids.length) return;
    if (targetFolderId === undefined) {
      setMoveIds(ids);
      return;
    }
    const sharedCount = ids.filter((id) => shareSummary?.[id]).length;
    if (sharedCount > 0) {
      // Dropping onto a tile still needs the shared-photo warning.
      setMoveIds(ids);
      return;
    }
    void moveToFolder(ids, targetFolderId);
  }

  async function moveToFolder(ids: string[], targetFolderId: string | null, targetName?: string) {
    const previous = photosRef.current;
    const actuallyMoving = ids.filter((id) => previous.find((p) => p.id === id)?.folder_id !== targetFolderId);
    if (!actuallyMoving.length) {
      setMoveIds(null);
      return;
    }
    onPhotosChange(
      previous.map((p) => (actuallyMoving.includes(p.id) ? { ...p, folder_id: targetFolderId } : p))
    );
    setBusy(true);
    try {
      const res = await fetch("/api/media/move-to-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project_id: projectId, folder_id: targetFolderId, photo_ids: actuallyMoving }),
      });
      if (!res.ok) {
        onPhotosChange(previous);
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || "Failed to move photos");
        return;
      }
      setMoveIds(null);
      clearSelection();
      const name =
        targetName ?? (targetFolderId ? folderById.get(targetFolderId)?.name ?? "folder" : UNFILED_FOLDER_LABEL);
      toast.success(`Moved ${photoCountLabel(actuallyMoving.length)} to ${name}`);
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  }

  async function savePhotoName(photo: MediaAsset, title: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/media/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: photo.id, title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to rename");
        return;
      }
      onPhotosChange(photosRef.current.map((p) => (p.id === photo.id ? { ...p, ...(data as MediaAsset) } : p)));
      setRenamePhoto(null);
      toast.success("Photo renamed");
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  }

  async function setVisibility(ids: string[], visible: boolean) {
    if (ids.length === 1) {
      onToggleVisibility(ids[0], visible);
      return;
    }
    const previous = photosRef.current;
    const visibility = visible ? "client" : "admin";
    onPhotosChange(previous.map((p) => (ids.includes(p.id) ? { ...p, visibility } : p)));
    const res = await fetch("/api/media/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "set_visibility", ids, visibility }),
    });
    if (!res.ok) {
      onPhotosChange(previous);
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || "Failed to update visibility");
      return;
    }
    toast.success(
      visible ? `${photoCountLabel(ids.length)} visible to client` : `${photoCountLabel(ids.length)} hidden from client`
    );
    onRefresh?.();
  }

  async function deletePhotos(ids: string[]) {
    setBusy(true);
    try {
      if (ids.length === 1) {
        const ok = await onDelete(ids[0]);
        if (ok === false) return;
      } else {
        const res = await fetch("/api/media/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "delete", ids }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error((data as { error?: string }).error || "Failed to delete photos");
          return;
        }
        onPhotosChange(photosRef.current.filter((p) => !ids.includes(p.id)));
        toast.success(`${photoCountLabel(ids.length)} deleted`);
        onRefresh?.();
      }
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  const selectionCount = selectedIds.size;
  const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const showSelectionChrome = selectionCount > 0 || (coarsePointer && selectMode);
  const remainingCount = visiblePhotos.length - selectionCount;
  const selectedAllVisible = selectedList.length > 0 && selectedList.every((id) => {
    const p = allProjectPhotos.find((x) => x.id === id);
    return p ? isClientVisible(p) : true;
  });

  function openPhotoMenu(photo: MediaAsset, anchor: ActionMenuAnchor) {
    if (selectedIds.has(photo.id) && selectedIds.size > 1) {
      setMenu({ anchor, title: `${photoCountLabel(selectedIds.size)} selected`, items: selectionMenuItems() });
      return;
    }
    if (!coarsePointer && !selectedIds.has(photo.id)) {
      setSelectedIds(new Set([photo.id]));
    }
    setMenu({ anchor, title: mediaDisplayName(photo), items: photoMenuItems(photo) });
  }

  function photoMenuItems(photo: MediaAsset): ActionMenuItem[] {
    const visible = isClientVisible(photo);
    const cover = isHero(photo.id);
    const items: ActionMenuItem[] = [
      { id: "open", label: "Open", icon: ZoomIn, onSelect: () => setLightboxPhoto(photo) },
      { id: "download", label: "Download", icon: Download, onSelect: () => setDownloadPhoto(photo) },
    ];
    if (onShare) {
      items.push({
        id: "share",
        label: shareSummary?.[photo.id] ? "Manage sharing…" : "Share…",
        icon: Share2,
        onSelect: () => onShare(photo),
      });
    }
    items.push(
      { type: "separator", id: "s1" },
      { id: "rename", label: "Rename…", icon: Pencil, onSelect: () => setRenamePhoto(photo) },
      { id: "move", label: "Move to folder…", icon: FolderInput, onSelect: () => requestMove([photo.id]) },
      {
        id: "cover",
        label: cover ? "Project cover" : "Set as project cover",
        icon: Star,
        disabled: cover,
        onSelect: () => onSetHero(photo.id),
      },
      {
        id: "visibility",
        label: visible ? "Hide from client" : "Show to client",
        icon: visible ? EyeOff : Eye,
        onSelect: () => void setVisibility([photo.id], !visible),
      },
      { type: "separator", id: "s2" },
      {
        id: "delete",
        label: "Delete photo…",
        icon: Trash2,
        destructive: true,
        onSelect: () => setDeleteTarget({ kind: "photos", ids: [photo.id] }),
      }
    );
    return items;
  }

  function selectionMenuItems(): ActionMenuItem[] {
    const ids = selectedList;
    return [
      { type: "label", id: "l", label: `${photoCountLabel(ids.length)} selected` },
      { id: "move", label: "Move to folder…", icon: FolderInput, onSelect: () => requestMove(ids) },
      { id: "top", label: "Move to top", icon: ArrowUpToLine, onSelect: () => void moveIdsToInsertIndex(new Set(ids), 0) },
      {
        id: "bottom",
        label: "Move to bottom",
        icon: ArrowDownToLine,
        onSelect: () => void moveIdsToInsertIndex(new Set(ids), remainingCount),
      },
      { id: "show", label: "Show to client", icon: Eye, onSelect: () => void setVisibility(ids, true) },
      { id: "hide", label: "Hide from client", icon: EyeOff, onSelect: () => void setVisibility(ids, false) },
      { type: "separator", id: "s" },
      {
        id: "delete",
        label: `Delete ${photoCountLabel(ids.length)}…`,
        icon: Trash2,
        destructive: true,
        onSelect: () => setDeleteTarget({ kind: "photos", ids }),
      },
    ];
  }

  function folderMenuItems(folder: MediaFolder): ActionMenuItem[] {
    const count = folderStats.get(folder.id)?.count ?? 0;
    return [
      { id: "open", label: "Open", icon: FolderOpen, onSelect: () => navigate(folder.id) },
      { id: "upload", label: "Upload photos here…", icon: Upload, onSelect: () => startUpload(folder.id) },
      {
        id: "download",
        label: "Download folder",
        icon: Download,
        disabled: count === 0,
        onSelect: () => downloadFolder(folder.id),
      },
      { id: "rename", label: "Rename…", icon: Pencil, onSelect: () => setFolderDialog({ mode: "rename", folder }) },
      { type: "separator", id: "s" },
      {
        id: "delete",
        label: "Delete folder…",
        icon: Trash2,
        destructive: true,
        onSelect: () => setDeleteTarget({ kind: "folder", folder }),
      },
    ];
  }

  function generalMenuItems(): ActionMenuItem[] {
    const count = folderStats.get(UNFILED_FOLDER_SCOPE)?.count ?? 0;
    return [
      { id: "open", label: "Open", icon: FolderOpen, onSelect: () => navigate(UNFILED_FOLDER_SCOPE) },
      { id: "upload", label: "Upload photos here…", icon: Upload, onSelect: () => startUpload(null) },
      {
        id: "download",
        label: `Download ${UNFILED_FOLDER_LABEL}`,
        icon: Download,
        disabled: count === 0,
        onSelect: () => downloadFolder(UNFILED_FOLDER_SCOPE),
      },
    ];
  }

  const moveCurrentFolder = useMemo<string | null | undefined>(() => {
    if (!moveIds?.length) return undefined;
    const folderIds = new Set(moveIds.map((id) => allProjectPhotos.find((p) => p.id === id)?.folder_id ?? null));
    return folderIds.size === 1 ? Array.from(folderIds)[0] : undefined;
  }, [moveIds, allProjectPhotos]);

  const deleteIds = deleteTarget?.kind === "photos" ? deleteTarget.ids : [];
  const deleteSharedCount =
    deleteTarget?.kind === "folder"
      ? allProjectPhotos.filter((p) => p.folder_id === deleteTarget.folder.id && shareSummary?.[p.id]).length
      : deleteIds.filter((id) => shareSummary?.[id]).length;
  const deleteIncludesCover = deleteIds.some((id) => isHero(id));
  const singleDeletePhoto =
    deleteIds.length === 1 ? allProjectPhotos.find((p) => p.id === deleteIds[0]) ?? null : null;

  const selectionActions = (
    <>
      <span className="text-sm font-medium text-heading">{selectionCount} selected</span>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {selectionCount > 0 && (
          <>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => requestMove(selectedList)}>
              <FolderInput className="h-3.5 w-3.5" /> Move to folder
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void moveIdsToInsertIndex(selectedIds, 0)}
            >
              <ArrowUpToLine className="h-3.5 w-3.5" /> Top
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void moveIdsToInsertIndex(selectedIds, remainingCount)}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> Bottom
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setPlacementMode(true)}>
              <Move className="h-3.5 w-3.5" /> Place…
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void setVisibility(selectedList, !selectedAllVisible)}
            >
              {selectedAllVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {selectedAllVisible ? "Hide" : "Show"}
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setSelectedIds(new Set(visibleIds));
            if (coarsePointer) setSelectMode(true);
          }}
        >
          Select all
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-9" onClick={clearSelection}>
          <X className="h-3.5 w-3.5" /> {coarsePointer ? "Done" : "Clear"}
        </Button>
        {selectionCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-9 border-red-300 text-red-600 hover:bg-red-50 surface-dark:border-red-500/40 surface-dark:text-red-400 surface-dark:hover:bg-red-500/10"
            onClick={() => setDeleteTarget({ kind: "photos", ids: selectedList })}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        )}
      </div>
    </>
  );

  const totalPhotos = allProjectPhotos.length;
  const viewCount = visiblePhotos.length;

  return (
    <div
      data-photo-grid
      className={cn("relative space-y-4", coarsePointer && showSelectionChrome && "pb-36")}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        fileDragDepth.current += 1;
        setFileDragActive(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        fileDragDepth.current = Math.max(0, fileDragDepth.current - 1);
        if (fileDragDepth.current === 0) setFileDragActive(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        fileDragDepth.current = 0;
        setFileDragActive(false);
        submitFiles(Array.from(e.dataTransfer.files), viewUploadFolder);
      }}
    >
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept={PHOTO_ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) submitFiles(files, uploadFolderRef.current);
        }}
      />

      {/* Toolbar: location on the left, actions for this location on the right */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav aria-label="Photo folders" className="flex min-w-[12rem] flex-1 items-center gap-1 text-sm">
          {view === "all" ? (
            <h3 className="flex items-center gap-2 font-semibold text-heading">
              All photos <span className="font-normal text-muted">{totalPhotos}</span>
            </h3>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("all")}
                className="shrink-0 rounded-md px-1.5 py-1 font-medium text-muted hover:bg-accent-subtle hover:text-heading"
              >
                All photos
              </button>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <h3 className="flex min-w-0 items-center gap-2 font-semibold text-heading" aria-current="page">
                <span className="truncate">{viewLabel}</span>
                <span className="shrink-0 font-normal text-muted">{viewCount}</span>
              </h3>
              {currentFolder ? (
                <button
                  type="button"
                  aria-label={`${currentFolder.name} actions`}
                  aria-haspopup="menu"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-accent-subtle hover:text-heading"
                  onClick={(e) =>
                    setMenu({
                      anchor: { kind: "element", element: e.currentTarget },
                      title: currentFolder.name,
                      items: folderMenuItems(currentFolder),
                    })
                  }
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              ) : null}
            </>
          )}
          {headerSlot ? <div className="ml-1 hidden shrink-0 sm:block">{headerSlot}</div> : null}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {view !== "all" && viewCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={zip.active}
              onClick={() => downloadFolder(view)}
            >
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          ) : null}
          {view === "all" ? (
            <Button variant="outline" size="sm" className="h-9" onClick={() => setFolderDialog({ mode: "create" })}>
              <FolderPlus className="h-3.5 w-3.5" /> New folder
            </Button>
          ) : null}
          {coarsePointer && viewCount > 0 && !placementMode ? (
            <Button
              type="button"
              variant={selectMode ? "accent" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => {
                if (selectMode) clearSelection();
                else setSelectMode(true);
              }}
            >
              {selectMode ? "Selecting…" : "Select"}
            </Button>
          ) : null}
          <Button variant="accent" size="sm" className="h-9" onClick={() => startUpload(viewUploadFolder)}>
            <Upload className="h-3.5 w-3.5" />
            {currentFolder ? "Upload to folder" : "Upload"}
          </Button>
        </div>
      </div>
      {headerSlot ? <div className="sm:hidden">{headerSlot}</div> : null}

      {zip.panel}

      <DndContext
        id={`admin-photo-grid-${projectId}`}
        sensors={sensors}
        collisionDetection={photoCollision}
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
        {showFolderTiles && (
          <section aria-label="Folders" className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Folders</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <PhotoFolderTile
                dropId={UNFILED_FOLDER_SCOPE}
                name={UNFILED_FOLDER_LABEL}
                count={folderStats.get(UNFILED_FOLDER_SCOPE)?.count ?? 0}
                coverUrl={(() => {
                  const id = folderStats.get(UNFILED_FOLDER_SCOPE)?.coverId;
                  return id ? thumbUrls[id] ?? null : null;
                })()}
                general
                onOpen={() => navigate(UNFILED_FOLDER_SCOPE)}
                onMenu={(anchor) =>
                  setMenu({ anchor, title: UNFILED_FOLDER_LABEL, items: generalMenuItems() })
                }
              />
              {folders.map((folder) => {
                const stats = folderStats.get(folder.id);
                return (
                  <PhotoFolderTile
                    key={folder.id}
                    dropId={folder.id}
                    name={folder.name}
                    count={stats?.count ?? 0}
                    coverUrl={stats?.coverId ? thumbUrls[stats.coverId] ?? null : null}
                    onOpen={() => navigate(folder.id)}
                    onMenu={(anchor) => setMenu({ anchor, title: folder.name, items: folderMenuItems(folder) })}
                  />
                );
              })}
              <NewFolderTile onClick={() => setFolderDialog({ mode: "create" })} />
            </div>
            {!coarsePointer && totalPhotos > 0 ? (
              <p className="text-xs text-muted">Drag photos onto a folder to move them.</p>
            ) : null}
          </section>
        )}

        {totalPhotos === 0 && view === "all" ? (
          <EmptyState
            icon={ImagePlus}
            title="No photos yet"
            description={`Upload JPEG, PNG, or WebP photos${maxFileSizeLabel ? ` (up to ${maxFileSizeLabel} each)` : ""}, or drag them onto this area.`}
          >
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="accent" onClick={() => startUpload(null)}>
                <Upload className="h-4 w-4" /> Upload photos
              </Button>
              <Button variant="outline" onClick={() => setFolderDialog({ mode: "create" })}>
                <FolderPlus className="h-4 w-4" /> New folder
              </Button>
            </div>
          </EmptyState>
        ) : viewCount === 0 ? (
          <EmptyState
            icon={view === UNFILED_FOLDER_SCOPE ? Images : FolderOpen}
            title={view === UNFILED_FOLDER_SCOPE ? "Every photo is in a folder" : "This folder is empty"}
            description={
              view === UNFILED_FOLDER_SCOPE
                ? "Photos that aren't in a folder appear here."
                : "Upload photos here, or move photos in from All photos."
            }
          >
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="accent" onClick={() => startUpload(viewUploadFolder)}>
                <Upload className="h-4 w-4" /> Upload photos
              </Button>
              <Button variant="outline" onClick={() => navigate("all")}>
                Back to All photos
              </Button>
            </div>
          </EmptyState>
        ) : (
          <section aria-label={viewLabel} className="space-y-2">
            {showFolderTiles ? (
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">All photos</h4>
            ) : null}
            <p className="text-xs text-muted">
              {coarsePointer
                ? "Tap a photo to open it. Tap Select (or long-press) to choose several. Hold the grip to drag."
                : "Click to select, double-click to open, right-click for actions. Drag to reorder; Cmd/Ctrl-click or drag a box to select several."}
            </p>

            {placementMode && (
              <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-card px-3 py-2 shadow-sm">
                <p className="text-sm font-medium text-heading">
                  Tap where to move {photoCountLabel(selectionCount)}
                </p>
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setPlacementMode(false)}>
                  Cancel
                </Button>
              </div>
            )}

            {!coarsePointer && showSelectionChrome && !placementMode && (
              <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-card px-3 py-2 shadow-sm">
                {selectionActions}
              </div>
            )}

            <div
              ref={scrollRef}
              className="relative max-h-[70vh] overflow-auto rounded-lg"
              onMouseDown={onGridMouseDown}
            >
              <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {placementMode && (
                    <InsertionGap onInsert={() => void moveIdsToInsertIndex(selectedIds, 0)} label="Move here (start)" />
                  )}
                  {visiblePhotos.map((p, i) => (
                    <div key={p.id} className="contents">
                      <SortablePhotoCard
                        photo={p}
                        index={i}
                        selected={selectedIds.has(p.id)}
                        isHeroPhoto={isHero(p.id)}
                        shared={Boolean(shareSummary?.[p.id])}
                        folderName={
                          view === "all" && p.folder_id ? folderById.get(p.folder_id)?.name ?? null : null
                        }
                        coarsePointer={coarsePointer}
                        selectMode={Boolean(coarsePointer && selectMode)}
                        placementMode={placementMode}
                        thumbUrl={thumbUrls[p.id] ?? null}
                        thumbFailed={!thumbUrls[p.id] && (thumbFailures[p.id] ?? 0) >= THUMB_FAIL_LIMIT}
                        onThumbVisible={onThumbVisible}
                        onThumbError={onThumbError}
                        onThumbRetry={onThumbRetry}
                        scrollRoot={scrollRoot}
                        onActivate={handleActivate}
                        onOpen={() => setLightboxPhoto(p)}
                        onMenu={openPhotoMenu}
                        onLongPressSelect={onLongPressSelect}
                        onToggleSelect={onToggleSelect}
                        onPaintSelectEnter={onPaintSelectEnter}
                        onPaintSelectMove={onPaintSelectMove}
                        onPaintSelectEnd={onPaintSelectEnd}
                      />
                      {placementMode && (
                        <InsertionGap
                          onInsert={() =>
                            void moveIdsToInsertIndex(
                              selectedIds,
                              visiblePhotos.slice(0, i + 1).filter((photo) => !selectedIds.has(photo.id)).length
                            )
                          }
                          label="Move here"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </SortableContext>

              {marquee && (
                <div
                  className="pointer-events-none absolute z-20 border border-accent/80 bg-accent/15"
                  style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
                />
              )}
            </div>
          </section>
        )}

        <DragOverlay dropAnimation={null}>
          {activeDragIds.length > 0 ? (
            <div className="relative h-28 w-28 select-none">
              <div className="absolute inset-0 rotate-[-4deg] rounded-lg bg-border shadow" />
              <div className="absolute inset-0 rotate-[3deg] rounded-lg bg-subtle shadow" />
              <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-accent bg-card text-sm font-semibold text-heading shadow-lg">
                {photoCountLabel(activeDragIds.length)}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {fileDragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-[1px]">
          <p className="rounded-lg bg-card px-4 py-2 text-sm font-semibold text-heading shadow">
            Drop to upload to {viewLabel === "All photos" ? UNFILED_FOLDER_LABEL : viewLabel}
          </p>
        </div>
      )}

      {/* Mobile selection bar (bottom, thumb-reachable) */}
      {coarsePointer && showSelectionChrome && !placementMode && (
        <div className="fixed inset-x-0 bottom-[calc(var(--admin-pwa-nav-height)+env(safe-area-inset-bottom,0px))] z-50 border-t border-border bg-card/95 px-3 py-3 shadow-lg backdrop-blur md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl flex-col gap-2">{selectionActions}</div>
        </div>
      )}

      <ActionMenu
        anchor={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        items={menu?.items ?? []}
        title={menu?.title ?? ""}
      />

      <NameDialog
        open={folderDialog !== null}
        title={folderDialog?.mode === "rename" ? "Rename folder" : "New folder"}
        initialValue={folderDialog?.mode === "rename" ? folderDialog.folder.name : ""}
        placeholder="e.g. Exterior"
        confirmLabel={folderDialog?.mode === "rename" ? "Save" : "Create folder"}
        busy={busy}
        onClose={() => setFolderDialog(null)}
        onSubmit={(name) => {
          if (folderDialog?.mode === "rename") void renameFolder(folderDialog.folder, name);
          else void createFolder(name, folderDialog?.moveIds);
        }}
      />

      <NameDialog
        open={renamePhoto !== null}
        title="Rename photo"
        initialValue={renamePhoto ? mediaDisplayName(renamePhoto) : ""}
        confirmLabel="Save"
        busy={busy}
        onClose={() => setRenamePhoto(null)}
        onSubmit={(title) => {
          if (renamePhoto) void savePhotoName(renamePhoto, title);
        }}
      />

      <MoveToFolderDialog
        open={moveIds !== null}
        count={moveIds?.length ?? 0}
        folders={folders}
        currentFolderId={moveCurrentFolder}
        sharedCount={(moveIds ?? []).filter((id) => shareSummary?.[id]).length}
        busy={busy}
        onClose={() => setMoveIds(null)}
        onMove={(folderId) => {
          if (moveIds) void moveToFolder(moveIds, folderId);
        }}
        onCreateAndMove={(name) => {
          if (moveIds) void createFolder(name, moveIds);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
        destructive
        title={
          deleteTarget?.kind === "folder"
            ? `Delete folder “${deleteTarget.folder.name}”?`
            : deleteIds.length === 1
              ? "Delete photo?"
              : `Delete ${photoCountLabel(deleteIds.length)}?`
        }
        confirmLabel={
          deleteTarget?.kind === "folder"
            ? "Delete folder"
            : deleteIds.length === 1
              ? "Delete photo"
              : `Delete ${photoCountLabel(deleteIds.length)}`
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "folder") void deleteFolder(deleteTarget.folder);
          else void deletePhotos(deleteTarget.ids);
        }}
      >
        {deleteTarget?.kind === "folder" ? (
          (() => {
            const count = folderStats.get(deleteTarget.folder.id)?.count ?? 0;
            return (
              <>
                <p>
                  {count === 0
                    ? "This folder is empty."
                    : `The ${photoCountLabel(count)} in this folder will move to ${UNFILED_FOLDER_LABEL}.`}{" "}
                  <strong className="font-semibold text-heading">No photos are deleted.</strong>
                </p>
                <p className="text-muted">
                  To delete the photos themselves, open the folder, select them, and choose Delete.
                </p>
              </>
            );
          })()
        ) : (
          <>
            <p>
              {singleDeletePhoto ? (
                <>
                  <strong className="font-semibold text-heading">{mediaDisplayName(singleDeletePhoto)}</strong>{" "}
                  will be permanently removed, including the original file.
                </>
              ) : (
                <>These photos will be permanently removed, including their original files.</>
              )}{" "}
              This can&apos;t be undone.
            </p>
            {deleteIncludesCover ? <p className="text-muted">The project cover will be cleared.</p> : null}
          </>
        )}
        {deleteSharedCount > 0 ? (
          <p className="text-muted">
            {deleteSharedCount === 1 ? "1 shared photo" : `${deleteSharedCount} shared photos`} will stop being
            available to the people and links it was shared with.
          </p>
        ) : null}
      </ConfirmDialog>

      <DownloadQualityDialog
        open={downloadPhoto !== null}
        onClose={() => setDownloadPhoto(null)}
        title="Download photo"
        onConfirm={(quality) => {
          if (downloadPhoto) void downloadMediaAsset(downloadPhoto, { quality });
          setDownloadPhoto(null);
        }}
      />

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
