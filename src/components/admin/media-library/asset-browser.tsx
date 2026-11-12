"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckSquare,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FolderMinus,
  FolderPlus,
  ImageIcon,
  ImagePlus,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Play,
  Share2,
  SlidersHorizontal,
  Square,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RemoteImage } from "@/components/ui/remote-image";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import type { CheckboxOption } from "@/components/ui/checkbox-dropdown";
import { dateRangeToIso } from "@/components/ui/date-range-filter";
import { LibraryVideoPoster } from "@/components/ui/library-video-poster";
import { AssetDrawer, submitZipDownload, zipBatches, type ResolvedItem } from "@/components/admin/media-library-client";
import { usePhotoShareDialog } from "@/components/photos/photo-share-dialog";
import { usePhotoEditor } from "@/components/photo-editor/use-photo-editor";
import { isEditablePhotoAsset, photoEditorLabel } from "@/lib/photo-editor/shared";
import { formatFileSize } from "@/lib/brand";
import type { LibraryAsset, LibraryAssetKind, LibrarySort } from "@/lib/media-library";
import type { LibraryFolderSummary } from "@/lib/library-folder-types";
import { isVideoLibraryAsset, shouldFetchLibraryThumbnail } from "@/lib/media-preview";
import { mediaDisplayName } from "@/lib/media-display-name";
import { createThumbRequestQueue } from "@/lib/media-thumb-client";
import { UNFILED_FOLDER_SCOPE } from "@/lib/project-zip-assets";
import { cn } from "@/lib/utils";
import {
  ActiveFilterChips,
  DesktopFilterBar,
  EMPTY_FILTERS,
  FilterSheet,
  FilterSheetButton,
  LibrarySearch,
  activeFilterChips,
  type FilterOptionSets,
  type LibraryFilterState,
} from "@/components/admin/media-library/library-filters";
import {
  KIND_LABEL,
  LIBRARY_DRAG_MIME,
  ViewModeToggle,
  assetKey,
  assetLocation,
  fileExtension,
  formatDuration,
  kindIcon,
  parseAssetKey,
  plural,
  shortDate,
  useStoredViewMode,
} from "@/components/admin/media-library/library-ui";
import { AddToFolderDialog, FolderNameDialog } from "@/components/admin/media-library/folder-dialogs";
import {
  addedToFolderMessage,
  changeFolderItems,
  createLibraryFolderRequest,
  type FolderPermissions,
} from "@/components/admin/media-library/folder-client";

export type LibraryFilterOptions = {
  clients: { id: string; name: string; full_name: string | null; company: string | null }[];
  properties: { id: string; address: string; nickname: string | null }[];
  projects: { id: string; project_name: string; property_address: string }[];
  services?: string[];
};

type KindCounts = Partial<Record<LibraryAssetKind, number>>;

type Selection = { mode: "ids"; keys: Set<string> } | { mode: "all"; query: string; excluded: Set<string> };
const EMPTY_SELECTION: Selection = { mode: "ids", keys: new Set() };

const PAGE_SIZE = 48;
const BULK_CHUNK = 100;

const SORT_OPTIONS: { value: LibrarySort; label: string; folderOnly?: boolean }[] = [
  { value: "added", label: "Recently Added", folderOnly: true },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name", label: "Name A–Z" },
  { value: "size", label: "Largest First" },
];

function buildQuery(params: Record<string, string | string[] | boolean | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((item) => item && sp.append(k, item));
    else if (v !== undefined && v !== "" && v !== false) sp.set(k, String(v));
  });
  return sp.toString();
}

function isFileKind(kind: LibraryAssetKind) {
  return kind === "photo" || kind === "video" || kind === "document";
}

function canShareAsset(a: Pick<LibraryAsset, "kind" | "media_source" | "has_file" | "embed_url" | "kuula_url">): boolean {
  if (a.kind === "photo") return a.media_source !== "youtube" && a.has_file;
  if (a.kind === "video" || a.kind === "document") return a.has_file || Boolean(a.embed_url);
  if (a.kind === "tour") return Boolean(a.kuula_url);
  return Boolean(a.embed_url);
}

function projectHref(a: LibraryAsset): string | null {
  if (!a.project_id) return null;
  return a.kind === "photo" ? `/admin/projects/${a.project_id}?folder=${a.folder_id ?? UNFILED_FOLDER_SCOPE}#photos` : `/admin/projects/${a.project_id}`;
}

export type AssetBrowserScope = { kind: "all" } | { kind: "folder"; folder: { id: string; name: string } };

export type AssetBrowserProps = {
  scope: AssetBrowserScope;
  initialAssets: LibraryAsset[];
  initialTotal: number;
  initialKindCounts: KindCounts;
  initialQuery?: string;
  filterOptions: LibraryFilterOptions;
  folders: LibraryFolderSummary[];
  foldersReady: boolean;
  permissions: FolderPermissions;
  /** Bumped by the workspace after uploads / folder changes to reload page 1. */
  reloadSignal: number;
  /** Folder changes made here (counts, covers) — workspace refreshes folder cards. */
  onFoldersChanged: () => void;
  /** Open a library folder's share dialog (workspace owns it). */
  onShareFolder: (folder: { id: string; name: string }) => void;
  onUpload: () => void;
  /** "Add from library" mode: pick media for this folder, then return to it. */
  pickForFolder?: { id: string; name: string } | null;
  onTotalChange?: (total: number) => void;
};

export function AssetBrowser({
  scope,
  initialAssets,
  initialTotal,
  initialKindCounts,
  initialQuery = "",
  filterOptions,
  folders,
  foldersReady,
  permissions,
  reloadSignal,
  onFoldersChanged,
  onShareFolder,
  onUpload,
  pickForFolder = null,
  onTotalChange,
}: AssetBrowserProps) {
  const router = useRouter();
  const inFolder = scope.kind === "folder" ? scope.folder : null;
  const photoShare = usePhotoShareDialog();
  const photoEditor = usePhotoEditor();
  const canShareItems = permissions.shareItems.email || permissions.shareItems.link;

  const [assets, setAssets] = useState(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [kindCounts, setKindCounts] = useState<KindCounts>(initialKindCounts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialAssets.length < initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery);
  const [filters, setFilters] = useState<LibraryFilterState>(EMPTY_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<LibrarySort>(inFolder ? "added" : "newest");
  const [view, setView] = useStoredViewMode("sp:media:view");
  const [selectMode, setSelectMode] = useState(Boolean(pickForFolder));
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [resolving, setResolving] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [drawerAsset, setDrawerAsset] = useState<LibraryAsset | null>(null);
  const [drawerFolders, setDrawerFolders] = useState<{ id: string; name: string }[] | null>(null);
  const [menu, setMenu] = useState<{ asset: LibraryAsset; anchor: ActionMenuAnchor } | null>(null);
  const [addDialog, setAddDialog] = useState<{ keys: string[] } | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "delete"; items: ResolvedItem[] }
    | { kind: "remove"; keys: string[] }
    | null
  >(null);
  const [shareAsFolder, setShareAsFolder] = useState<{ keys: string[] } | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const loaderRef = useRef<HTMLDivElement>(null);
  const thumbQueueRef = useRef(createThumbRequestQueue((urls) => setThumbUrls((prev) => ({ ...prev, ...urls }))));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  const optionSets = useMemo<FilterOptionSets>(
    () => ({
      services: (filterOptions.services ?? []).map((s) => ({ value: s, label: s })),
      clients: filterOptions.clients.map((c) => ({ value: c.id, label: c.full_name || c.name, hint: c.company ?? undefined }) as CheckboxOption),
      properties: filterOptions.properties.map((p) => ({ value: p.id, label: p.nickname || p.address, hint: p.nickname ? p.address : undefined }) as CheckboxOption),
    }),
    [filterOptions]
  );
  const chips = activeFilterChips(filters, optionSets, setFilters);
  const filtered = chips.length > 0 || Boolean(debouncedQ.trim());

  /** Canonical query for the current scope + filters + search + sort (no paging). */
  const filterQuery = useMemo(() => {
    const range = dateRangeToIso(filters.dateRange);
    return buildQuery({
      library_folder: inFolder?.id,
      q: debouncedQ.trim(),
      type: filters.types,
      service: filters.services,
      client_id: filters.clientIds,
      property_id: filters.propertyIds,
      date_from: range.from,
      date_to: range.to,
      sort,
    });
  }, [inFolder?.id, debouncedQ, filters, sort]);

  const fetchPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      setLoading(true);
      setLoadError(false);
      try {
        const paging = buildQuery({ page: pageNum, limit: PAGE_SIZE });
        const res = await fetch(`/api/media/library?${filterQuery}&${paging}`, { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { assets: LibraryAsset[]; total: number; kindCounts?: KindCounts; hasMore: boolean };
        setAssets((prev) => (replace ? data.assets : [...prev, ...data.assets.filter((a) => !prev.some((p) => p.kind === a.kind && p.id === a.id))]));
        setTotal(data.total);
        setKindCounts(data.kindCounts ?? {});
        setHasMore(data.hasMore);
        setPage(pageNum);
      } catch {
        setLoadError(true);
        if (!replace) toast.error("Couldn't load more media.");
      } finally {
        setLoading(false);
      }
    },
    [filterQuery]
  );

  // Reload when the query changes (skip the very first render: server data is current) and
  // drop any selection made under the old query so bulk actions never reach unseen assets.
  const lastQueryRef = useRef<string | null>(null);
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  useEffect(() => {
    if (lastQueryRef.current === null) {
      // The server rendered page 1 with this exact scope, search and sort.
      lastQueryRef.current = filterQuery;
      return;
    }
    void fetchPage(1, true);
    if (lastQueryRef.current !== filterQuery) {
      lastQueryRef.current = filterQuery;
      const prev = selectionRef.current;
      if (prev.mode === "all" || prev.keys.size > 0) setSelection(EMPTY_SELECTION);
    }
  }, [fetchPage, filterQuery]);

  const firstReload = useRef(true);
  useEffect(() => {
    if (firstReload.current) {
      firstReload.current = false;
      return;
    }
    void fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore || loading || loadError) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchPage(page + 1, false);
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadError, page, fetchPage]);

  const loadThumb = useCallback(
    (asset: LibraryAsset) => {
      if (!shouldFetchLibraryThumbnail(asset)) return;
      thumbQueueRef.current.request(asset.id);
    },
    []
  );

  // ── Selection ────────────────────────────────────────────────────────────
  const isSelected = useCallback(
    (a: LibraryAsset) => (selection.mode === "all" ? !selection.excluded.has(assetKey(a)) : selection.keys.has(assetKey(a))),
    [selection]
  );
  const selectedCount = selection.mode === "all" ? Math.max(0, total - selection.excluded.size) : selection.keys.size;
  const allMatchingSelected = selection.mode === "all" && selection.excluded.size === 0;
  const selectedPhotoCount = useMemo(() => {
    if (selection.mode === "ids") return [...selection.keys].filter((k) => k.startsWith("photo:")).length;
    return Math.max(0, (kindCounts.photo ?? 0) - [...selection.excluded].filter((k) => k.startsWith("photo:")).length);
  }, [selection, kindCounts]);
  const bulkBusy = resolving || busyLabel !== null;

  function toggleSelect(asset: LibraryAsset) {
    const key = assetKey(asset);
    setSelection((prev) => {
      if (prev.mode === "all") {
        const excluded = new Set(prev.excluded);
        if (excluded.has(key)) excluded.delete(key);
        else excluded.add(key);
        return { ...prev, excluded };
      }
      const keys = new Set(prev.keys);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      return { mode: "ids", keys };
    });
    if (!selectMode) setSelectMode(true);
  }

  function exitSelect() {
    setSelectMode(false);
    setSelection(EMPTY_SELECTION);
  }

  async function resolveSelection(): Promise<ResolvedItem[] | null> {
    if (selection.mode === "ids") {
      const byKey = new Map(assets.map((a) => [assetKey(a), a]));
      return [...selection.keys].map((key) => {
        const { kind, id } = parseAssetKey(key);
        const a = byKey.get(key);
        return { id, kind, has_file: a ? a.has_file : isFileKind(kind), file_size: a?.file_size ?? null };
      });
    }
    if (selection.query !== filterQuery) {
      toast.error("Filters changed since you selected all. Please select again.");
      setSelection(EMPTY_SELECTION);
      return null;
    }
    setResolving(true);
    try {
      const res = await fetch("/api/media/library/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: selection.query, exclude: [...selection.excluded] }),
      });
      if (!res.ok) throw new Error();
      return ((await res.json()) as { items: ResolvedItem[] }).items;
    } catch {
      toast.error("Couldn't load the selected media. Please try again.");
      return null;
    } finally {
      setResolving(false);
    }
  }

  // ── Folder actions ───────────────────────────────────────────────────────
  async function addKeysToFolder(folder: { id: string; name: string }, keys: string[]): Promise<boolean> {
    if (!keys.length) return false;
    setBusyLabel(`Adding to “${folder.name}”…`);
    try {
      const r = await changeFolderItems(folder.id, keys, "add");
      toast.success(addedToFolderMessage(folder.name, r), {
        action: inFolder?.id === folder.id ? undefined : { label: "Open", onClick: () => router.push(`/admin/media/folders/${folder.id}`) },
      });
      onFoldersChanged();
      if (inFolder?.id === folder.id) void fetchPage(1, true);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add to the folder.");
      return false;
    } finally {
      setBusyLabel(null);
    }
  }

  async function removeKeysFromFolder(keys: string[]) {
    if (!inFolder || !keys.length) return;
    setConfirm(null);
    setBusyLabel("Removing from folder…");
    try {
      const r = await changeFolderItems(inFolder.id, keys, "remove");
      toast.success(`Removed ${plural(r.changed, "item")} from “${inFolder.name}”. The originals weren't touched.`);
      const gone = new Set(keys);
      setAssets((prev) => prev.filter((a) => !gone.has(assetKey(a))));
      setTotal((t) => Math.max(0, t - r.changed));
      setSelection(EMPTY_SELECTION);
      if (drawerAsset && gone.has(assetKey(drawerAsset))) setDrawerAsset(null);
      onFoldersChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove from the folder.");
    } finally {
      setBusyLabel(null);
    }
  }

  async function bulkAddToFolder() {
    const items = await resolveSelection();
    if (!items?.length) return;
    setAddDialog({ keys: items.map((i) => assetKey(i)) });
  }

  async function bulkRemoveFromFolder() {
    const items = await resolveSelection();
    if (!items?.length) return;
    setConfirm({ kind: "remove", keys: items.map((i) => assetKey(i)) });
  }

  async function confirmPickForFolder() {
    if (!pickForFolder) return;
    const items = await resolveSelection();
    if (!items?.length) {
      toast.error("Select at least one item.");
      return;
    }
    const ok = await addKeysToFolder(pickForFolder, items.map((i) => assetKey(i)));
    if (ok) router.push(`/admin/media/folders/${pickForFolder.id}`);
  }

  // ── Share ────────────────────────────────────────────────────────────────
  function openItemShare(a: LibraryAsset) {
    const name = mediaDisplayName(a);
    if (a.kind === "photo") photoShare.openShare({ id: a.id, name, thumbUrl: thumbUrls[a.id] ?? null });
    else photoShare.openShare({ id: a.id, name, kind: "item", itemKind: a.kind, thumbUrl: thumbUrls[a.id] ?? null });
  }

  async function bulkShare() {
    const items = await resolveSelection();
    if (!items?.length) return;
    if (items.length === 1) {
      const a = assets.find((x) => x.kind === items[0].kind && x.id === items[0].id);
      if (a && canShareAsset(a)) openItemShare(a);
      else toast.error("This item can't be shared on its own.");
      return;
    }
    if (inFolder && selectedCount === total && permissions.shareFolders) {
      onShareFolder(inFolder);
      return;
    }
    setShareAsFolder({ keys: items.map((i) => assetKey(i)) });
  }

  // ── Download / delete / favorite ─────────────────────────────────────────
  async function bulkDownload() {
    const items = await resolveSelection();
    if (!items?.length) return;
    const files = items.filter((i) => isFileKind(i.kind) && i.has_file);
    if (!files.length) {
      toast.error("None of the selected items are files — 360° tours, 3D models and YouTube links can't be downloaded.");
      return;
    }
    const batches = zipBatches(files);
    const skipped = items.length - files.length;
    toast.success(
      batches.length > 1
        ? `Preparing ${plural(files.length, "file")} in ${batches.length} ZIP parts. Allow multiple downloads if your browser asks.`
        : `Preparing ZIP of ${plural(files.length, "file")}…`,
      skipped ? { description: `${plural(skipped, "link")} skipped (tours, 3D models, YouTube)` } : undefined
    );
    setBusyLabel("Starting download…");
    try {
      for (let i = 0; i < batches.length; i++) {
        submitZipDownload(batches[i], i + 1, batches.length);
        if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 2500));
      }
    } finally {
      setBusyLabel(null);
    }
  }

  async function bulkDelete() {
    const items = await resolveSelection();
    if (!items?.length) return;
    setConfirm({ kind: "delete", items });
  }

  async function runDelete(items: ResolvedItem[]) {
    setConfirm(null);
    const files = items.filter((i) => isFileKind(i.kind));
    if (!files.length) {
      toast.error("Nothing deleted — 360° tours and 3D models are removed from their project page.");
      return;
    }
    let ok = 0;
    let failed = 0;
    try {
      for (let i = 0; i < files.length; i += BULK_CHUNK) {
        const chunk = files.slice(i, i + BULK_CHUNK).map((f) => f.id);
        setBusyLabel(`Deleting ${Math.min(i + chunk.length, files.length).toLocaleString()} of ${files.length.toLocaleString()}…`);
        const res = await fetch("/api/media/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "delete", ids: chunk, kind: "media" }),
        });
        if (res.ok) ok += ((await res.json().catch(() => ({}))) as { deleted?: number }).deleted ?? chunk.length;
        else {
          failed += chunk.length;
          if (res.status === 403) break;
        }
      }
    } finally {
      setBusyLabel(null);
    }
    if (ok) toast.success(`Deleted ${plural(ok, "file")}${failed ? ` · ${failed.toLocaleString()} failed` : ""}`);
    else toast.error("Delete failed.");
    setSelection(EMPTY_SELECTION);
    onFoldersChanged();
    void fetchPage(1, true);
  }

  async function toggleFavorite(asset: LibraryAsset) {
    if (asset.kind === "model") return;
    const res = await fetch("/api/media/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: asset.is_favorite ? "unfavorite" : "favorite", ids: [asset.id], kind: asset.kind === "tour" ? "tour" : "media" }),
    });
    if (!res.ok) {
      toast.error("Couldn't update favorites.");
      return;
    }
    const flip = (a: LibraryAsset) => (a.id === asset.id && a.kind === asset.kind ? { ...a, is_favorite: !a.is_favorite } : a);
    setAssets((prev) => prev.map(flip));
    setDrawerAsset((d) => (d ? flip(d) : d));
  }

  async function setFolderCover(asset: LibraryAsset) {
    if (!inFolder) return;
    const res = await fetch(`/api/library-folders/${inFolder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ coverAssetId: asset.id }),
    });
    if (res.ok) {
      toast.success("Folder cover updated");
      onFoldersChanged();
    } else toast.error("Couldn't update the cover.");
  }

  // ── Drawer: which folders contain this asset ────────────────────────────
  useEffect(() => {
    setDrawerFolders(null);
    if (!drawerAsset || !foldersReady) return;
    let cancelled = false;
    void fetch(`/api/library-items/${drawerAsset.kind}/${drawerAsset.id}/folders`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { folders?: { id: string; name: string }[] } | null) => {
        if (!cancelled) setDrawerFolders(d?.folders ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [drawerAsset, foldersReady]);

  // ── Card menu ────────────────────────────────────────────────────────────
  const menuItems: ActionMenuItem[] = menu
    ? (() => {
        const a = menu.asset;
        const href = projectHref(a);
        const items: ActionMenuItem[] = [
          { id: "open", label: "Preview", icon: Eye, onSelect: () => setDrawerAsset(a) },
        ];
        if (canShareItems && canShareAsset(a)) items.push({ id: "share", label: "Share", icon: Share2, onSelect: () => openItemShare(a) });
        if (permissions.organize && foldersReady)
          items.push({ id: "add", label: "Add to folder", icon: FolderPlus, onSelect: () => setAddDialog({ keys: [assetKey(a)] }) });
        if (a.has_file && isFileKind(a.kind))
          items.push({ id: "download", label: "Download", icon: Download, onSelect: () => window.open(`/api/media/download/${a.id}?file=1`, "_blank") });
        if (href) items.push({ id: "project", label: "View original project", icon: ExternalLink, onSelect: () => router.push(href) });
        if (a.kind !== "model")
          items.push({ id: "fav", label: a.is_favorite ? "Remove from favorites" : "Add to favorites", icon: Star, onSelect: () => void toggleFavorite(a) });
        if (inFolder && permissions.organize) {
          if (a.kind === "photo" && a.media_source !== "youtube")
            items.push({ id: "cover", label: "Use as folder cover", icon: ImagePlus, onSelect: () => void setFolderCover(a) });
          items.push({ type: "separator", id: "sep-folder" });
          items.push({
            id: "remove",
            label: "Remove from folder",
            description: "Keeps the original in its project",
            icon: FolderMinus,
            onSelect: () => setConfirm({ kind: "remove", keys: [assetKey(a)] }),
          });
        }
        if (permissions.deleteMedia && isFileKind(a.kind)) {
          if (!inFolder) items.push({ type: "separator", id: "sep-del" });
          items.push({
            id: "delete",
            label: "Delete permanently…",
            icon: Trash2,
            destructive: true,
            onSelect: () => setConfirm({ kind: "delete", items: [{ id: a.id, kind: a.kind, has_file: a.has_file, file_size: a.file_size }] }),
          });
        }
        return items;
      })()
    : [];

  // ── Drag (desktop): drop media cards onto folder cards ──────────────────
  function dragKeysFor(a: LibraryAsset): string[] {
    const key = assetKey(a);
    if (selection.mode === "ids" && selection.keys.has(key)) return [...selection.keys];
    return [key];
  }

  const pendingDelete = confirm?.kind === "delete" ? confirm.items : null;
  const pendingDeleteFiles = pendingDelete?.filter((i) => isFileKind(i.kind)).length ?? 0;
  const sortOptions = SORT_OPTIONS.filter((o) => !o.folderOnly || inFolder).map((o) => ({ value: o.value, label: o.label }));
  const libraryEmpty = !filtered && total === 0 && !loading && !loadError;

  return (
    <div className={cn("min-w-0 space-y-4", selectMode && "pb-36 sm:pb-24")}>
      {pickForFolder ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent-subtle/60 p-3 sm:flex-row sm:items-center sm:p-4">
          <FolderPlus className="hidden h-5 w-5 shrink-0 text-accent sm:block" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-heading">
            Select media to add to <span className="font-semibold">“{pickForFolder.name}”</span>. Originals stay in their projects.
          </p>
          <div className="flex shrink-0 gap-2">
            <Link href={`/admin/media/folders/${pickForFolder.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-heading hover:bg-subtle">
              Cancel
            </Link>
            <Button variant="accent" className="min-h-10" disabled={!selectedCount || bulkBusy} onClick={() => void confirmPickForFolder()}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              Add {selectedCount ? selectedCount.toLocaleString() : ""} to folder
            </Button>
          </div>
        </div>
      ) : null}

      {/* Filters: desktop row; phones/tablets get search + a Filters sheet. */}
      <DesktopFilterBar filters={filters} onChange={setFilters} sets={optionSets} expanded={filtersExpanded} onToggle={() => setFiltersExpanded((v) => !v)} />

      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <LibrarySearch
          value={q}
          onChange={setQ}
          placeholder={inFolder ? `Search in ${inFolder.name}…` : "Search by file name, project, address, client…"}
          className="min-w-0 flex-1 basis-full sm:basis-64 lg:max-w-md"
        />
        <FilterSheetButton count={chips.length} onClick={() => setSheetOpen(true)} />
        <p className="hidden text-sm text-muted lg:block" aria-live="polite">
          {loading && page === 1 ? "Loading…" : plural(total, "asset")}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={cn("h-11 rounded-xl px-3.5", selectMode && "border-accent/40 bg-accent-subtle text-accent")}
            aria-pressed={selectMode}
          >
            {selectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            <span className="hidden sm:inline">{selectMode ? "Done" : "Select"}</span>
          </Button>
          <SortControl value={sort} onChange={setSort} options={sortOptions} />
          <ViewModeToggle value={view} onChange={setView} />
        </div>
      </div>

      <ActiveFilterChips chips={chips} onClearAll={() => setFilters(EMPTY_FILTERS)} />
      <p className="text-sm text-muted lg:hidden" aria-live="polite">
        {loading && page === 1 ? "Loading…" : plural(total, "asset")}
      </p>

      {/* Selection toolbar */}
      {selectMode ? (
        <div className="media-bulk-bar fixed left-[calc(var(--admin-sidebar-w,0px)+0.75rem)] right-3 z-40 mx-auto max-w-5xl rounded-2xl border border-accent/30 bg-card/95 p-2.5 shadow-xl backdrop-blur" role="toolbar" aria-label="Selection actions">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button type="button" onClick={exitSelect} aria-label="Exit selection" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-heading">
              <X className="h-5 w-5" aria-hidden />
            </button>
            <span className="min-w-0 text-sm font-semibold text-heading">
              {selection.mode === "all"
                ? allMatchingSelected
                  ? `All ${selectedCount.toLocaleString()} selected`
                  : `${selectedCount.toLocaleString()} of ${total.toLocaleString()} selected`
                : `${selectedCount.toLocaleString()} selected`}
            </span>
            {!allMatchingSelected && total > 0 ? (
              <Button variant="ghost" size="sm" className="min-h-10" onClick={() => setSelection({ mode: "all", query: filterQuery, excluded: new Set() })} disabled={bulkBusy}>
                <ListChecks className="h-4 w-4" /> <span className="hidden sm:inline">Select all</span> {total.toLocaleString()}
              </Button>
            ) : null}
            {busyLabel || resolving ? (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {busyLabel ?? "Loading selection…"}
              </span>
            ) : null}
            {selectedCount > 0 && !pickForFolder ? (
              <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
                {permissions.organize && foldersReady ? (
                  <Button variant="accent" size="sm" className="min-h-10" disabled={bulkBusy} onClick={() => void bulkAddToFolder()}>
                    <FolderPlus className="h-4 w-4" /> Add to folder
                  </Button>
                ) : null}
                {inFolder && permissions.organize ? (
                  <Button variant="outline" size="sm" className="min-h-10" disabled={bulkBusy} onClick={() => void bulkRemoveFromFolder()}>
                    <FolderMinus className="h-4 w-4" /> Remove
                  </Button>
                ) : null}
                {canShareItems && (selectedCount === 1 || permissions.shareFolders) ? (
                  <Button variant="outline" size="sm" className="min-h-10" disabled={bulkBusy} onClick={() => void bulkShare()}>
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" className="min-h-10" disabled={bulkBusy} onClick={() => void bulkDownload()}>
                  <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
                </Button>
                {selectedPhotoCount > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    disabled={bulkBusy || photoEditor.opening}
                    onClick={() =>
                      void resolveSelection().then((items) => {
                        const ids = items?.filter((i) => i.kind === "photo").map((i) => i.id) ?? [];
                        if (ids.length) void photoEditor.open({ mediaIds: ids });
                      })
                    }
                  >
                    <SlidersHorizontal className="h-4 w-4" /> <span className="hidden md:inline">{photoEditorLabel(selectedPhotoCount)}</span>
                  </Button>
                ) : null}
                {permissions.deleteMedia ? (
                  <Button variant="outline" size="sm" className="min-h-10 text-red-600 hover:text-red-700" disabled={bulkBusy} onClick={() => void bulkDelete()} aria-label="Delete permanently">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ) : selectedCount === 0 ? (
              <span className="text-xs text-muted sm:ml-auto">Tap items to select them.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Results */}
      {loadError && assets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden />
          <p className="text-sm text-muted">Media couldn&apos;t be loaded.</p>
          <Button variant="outline" className="min-h-10" onClick={() => void fetchPage(1, true)}>
            Try again
          </Button>
        </div>
      ) : libraryEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
            {inFolder ? <FolderPlus className="h-5 w-5" aria-hidden /> : <ImageIcon className="h-5 w-5" aria-hidden />}
          </span>
          <h3 className="text-base font-semibold text-heading">{inFolder ? "This folder is empty" : "Your media library is empty"}</h3>
          <p className="max-w-md text-sm text-muted">
            {inFolder
              ? "Add photos, videos, tours and files from any project. Folders hold references, so nothing is copied."
              : "Upload media here or to a project. Everything you upload shows up in one place."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {inFolder && permissions.organize ? (
              <Link href={`/admin/media?addTo=${inFolder.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90">
                <FolderPlus className="h-4 w-4" aria-hidden /> Add from library
              </Link>
            ) : null}
            {permissions.upload ? (
              <Button variant={inFolder ? "outline" : "accent"} className="min-h-11" onClick={onUpload}>
                <Upload className="h-4 w-4" /> {inFolder ? "Upload to folder" : "Upload media"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : assets.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <p className="text-sm text-muted">{inFolder ? "Nothing in this folder matches your search or filters." : "No media matches your search or filters."}</p>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setQ("");
            }}
            className="mt-2 min-h-10 text-sm font-medium text-accent hover:underline"
          >
            Clear search and filters
          </button>
        </div>
      ) : view === "grid" ? (
        <ul className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
          {assets.map((asset) => (
            <li key={assetKey(asset)} className="min-w-0">
              <MediaCard
                asset={asset}
                thumbUrl={thumbUrls[asset.id]}
                onVisible={loadThumb}
                selectMode={selectMode}
                selected={isSelected(asset)}
                onToggle={() => toggleSelect(asset)}
                onOpen={() => setDrawerAsset(asset)}
                onMenu={(el) => setMenu({ asset, anchor: { kind: "element", element: el } })}
                dragKeys={permissions.organize && foldersReady ? () => dragKeysFor(asset) : undefined}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {assets.map((asset) => (
            <MediaRow
              key={assetKey(asset)}
              asset={asset}
              thumbUrl={thumbUrls[asset.id]}
              onVisible={loadThumb}
              selectMode={selectMode}
              selected={isSelected(asset)}
              onToggle={() => toggleSelect(asset)}
              onOpen={() => setDrawerAsset(asset)}
              onMenu={(el) => setMenu({ asset, anchor: { kind: "element", element: el } })}
              dragKeys={permissions.organize && foldersReady ? () => dragKeysFor(asset) : undefined}
            />
          ))}
        </ul>
      )}

      <div ref={loaderRef} className="flex justify-center py-6">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted" aria-label="Loading" /> : null}
        {loadError && assets.length > 0 ? (
          <Button variant="outline" size="sm" className="min-h-10" onClick={() => void fetchPage(page + 1, false)}>
            Load more
          </Button>
        ) : null}
      </div>

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} filters={filters} onApply={setFilters} sets={optionSets} />

      <ActionMenu anchor={menu?.anchor ?? null} onClose={() => setMenu(null)} items={menuItems} title={menu ? mediaDisplayName(menu.asset) : "Media"} />

      <AddToFolderDialog
        open={addDialog !== null}
        count={addDialog?.keys.length ?? 0}
        folders={folders}
        excludeFolderId={inFolder?.id}
        onClose={() => setAddDialog(null)}
        onPick={(folder) => addKeysToFolder(folder, addDialog?.keys ?? [])}
        onCreate={async (name) => {
          const result = await createLibraryFolderRequest(name);
          if (typeof result !== "string") onFoldersChanged();
          return result;
        }}
      />

      <FolderNameDialog
        open={shareAsFolder !== null}
        mode="create"
        initialName={`Shared media – ${shortDate(new Date().toISOString())}`}
        onClose={() => setShareAsFolder(null)}
        onSubmit={async (name) => {
          const created = await createLibraryFolderRequest(name);
          if (typeof created === "string") return created;
          try {
            await changeFolderItems(created.id, shareAsFolder?.keys ?? [], "add");
          } catch (err) {
            return err instanceof Error ? err.message : "Couldn't add the media to the new folder.";
          }
          setShareAsFolder(null);
          onFoldersChanged();
          toast.success(`Created “${created.name}” with ${plural(shareAsFolder?.keys.length ?? 0, "item")}`);
          onShareFolder(created);
          return null;
        }}
      />

      <ConfirmDialog
        open={confirm?.kind === "remove"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.kind === "remove" && void removeKeysFromFolder(confirm.keys)}
        title={`Remove ${plural(confirm?.kind === "remove" ? confirm.keys.length : 0, "item")} from this folder?`}
        confirmLabel="Remove from folder"
      >
        <p>
          They&apos;ll stay in their projects and in the rest of your library — nothing is deleted. If this folder is shared, they
          disappear from the shared view right away.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => pendingDelete && void runDelete(pendingDelete)}
        title={`Permanently delete ${plural(pendingDeleteFiles, "file")}?`}
        confirmLabel={pendingDeleteFiles ? "Delete permanently" : "OK"}
        destructive={pendingDeleteFiles > 0}
        busy={busyLabel !== null}
      >
        {pendingDeleteFiles ? (
          <>
            <p>
              This removes the original {pendingDeleteFiles === 1 ? "file" : "files"} from {pendingDeleteFiles === 1 ? "its project" : "their projects"}, every
              folder, and every share link. This can&apos;t be undone.
            </p>
            {inFolder ? (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900 surface-dark:bg-amber-500/10 surface-dark:text-amber-200">
                Only want it out of “{inFolder.name}”? Use <strong>Remove from folder</strong> instead.
              </p>
            ) : null}
          </>
        ) : (
          <p>360° tours and 3D models are links managed on their project page — nothing will be deleted.</p>
        )}
      </ConfirmDialog>

      {drawerAsset ? (
        <AssetDrawer
          asset={drawerAsset}
          projects={filterOptions.projects}
          onClose={() => setDrawerAsset(null)}
          onUpdate={(updated) => {
            setAssets((prev) => prev.map((a) => (a.id === updated.id && a.kind === updated.kind ? updated : a)));
            setDrawerAsset(updated);
          }}
          onFavorite={() => void toggleFavorite(drawerAsset)}
          onDeleted={() => {
            setAssets((prev) => prev.filter((a) => !(a.id === drawerAsset.id && a.kind === drawerAsset.kind)));
            setTotal((t) => Math.max(0, t - 1));
            setDrawerAsset(null);
            onFoldersChanged();
          }}
          onEditPhoto={
            isEditablePhotoAsset({ media_type: drawerAsset.kind, media_source: drawerAsset.media_source, mime_type: drawerAsset.mime_type })
              ? () => void photoEditor.open({ projectId: drawerAsset.project_id, mediaIds: [drawerAsset.id], activeMediaId: drawerAsset.id })
              : undefined
          }
          editOpening={photoEditor.opening}
          extraActions={
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {canShareItems && canShareAsset(drawerAsset) ? (
                  <Button variant="accent" size="sm" onClick={() => openItemShare(drawerAsset)}>
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                ) : null}
                {permissions.organize && foldersReady ? (
                  <Button variant="outline" size="sm" onClick={() => setAddDialog({ keys: [assetKey(drawerAsset)] })}>
                    <FolderPlus className="h-4 w-4" /> Add to folder
                  </Button>
                ) : null}
                {inFolder && permissions.organize ? (
                  <Button variant="outline" size="sm" onClick={() => setConfirm({ kind: "remove", keys: [assetKey(drawerAsset)] })}>
                    <FolderMinus className="h-4 w-4" /> Remove from folder
                  </Button>
                ) : null}
              </div>
              {drawerFolders && drawerFolders.length ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted">In folders:</span>
                  {drawerFolders.map((f) => (
                    <Link key={f.id} href={`/admin/media/folders/${f.id}`} className="rounded-full border border-border bg-subtle px-2 py-0.5 font-medium text-heading hover:border-accent/40 hover:text-accent">
                      {f.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          }
        />
      ) : null}

      {photoShare.dialog}
    </div>
  );
}

/** Native select under a compact button: icon-only on phones, labeled from sm. */
function SortControl({ value, onChange, options }: { value: LibrarySort; onChange: (v: LibrarySort) => void; options: { value: string; label: string }[] }) {
  const label = options.find((o) => o.value === value)?.label ?? "Sort";
  return (
    <label className="relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-heading shadow-sm hover:bg-subtle focus-within:ring-2 focus-within:ring-accent/30 sm:min-w-44">
      <ArrowUpDown className="h-4 w-4 text-muted" aria-hidden />
      <span className="hidden flex-1 truncate sm:inline">{label}</span>
      <ChevronDown className="hidden h-4 w-4 text-muted sm:block" aria-hidden />
      <select
        aria-label="Sort media"
        value={value}
        onChange={(e) => onChange(e.target.value as LibrarySort)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type CardBaseProps = {
  asset: LibraryAsset;
  thumbUrl?: string;
  onVisible: (a: LibraryAsset) => void;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onMenu: (el: HTMLElement) => void;
  dragKeys?: () => string[];
};

function useVisible(ref: React.RefObject<HTMLElement | null>, asset: LibraryAsset, onVisible: (a: LibraryAsset) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onVisible(asset);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, asset, onVisible]);
}

function Thumb({ asset, thumbUrl, sizes }: { asset: LibraryAsset; thumbUrl?: string; sizes: string }) {
  const Icon = kindIcon(asset.kind);
  if (isVideoLibraryAsset(asset)) return <LibraryVideoPoster asset={asset} thumbUrl={thumbUrl} className="absolute inset-0" />;
  if (thumbUrl) return <RemoteImage src={thumbUrl} alt="" fill className="object-cover" sizes={sizes} />;
  const ext = asset.kind === "document" ? fileExtension(asset) : null;
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-1.5",
        asset.kind === "tour" || asset.kind === "model" ? "bg-gradient-to-br from-accent-subtle to-subtle text-accent" : "bg-subtle text-muted"
      )}
    >
      <Icon className="h-9 w-9" aria-hidden />
      {ext ? <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">{ext}</span> : null}
    </div>
  );
}

function dragProps(dragKeys: (() => string[]) | undefined) {
  if (!dragKeys) return {};
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      const keys = dragKeys();
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(keys));
      e.dataTransfer.setData("text/plain", keys.length === 1 ? "1 item" : `${keys.length} items`);
    },
  };
}

function SelectBox({ selected, visible, onToggle, label }: { selected: boolean; visible: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      role="checkbox"
      aria-checked={selected}
      aria-label={label}
      className={cn(
        "absolute left-1.5 top-1.5 z-[2] flex h-9 w-9 items-center justify-center rounded-lg transition-opacity focus-visible:opacity-100",
        visible || selected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border-2 shadow-sm",
          selected ? "border-accent bg-accent text-accent-foreground" : "border-white bg-black/20 backdrop-blur-sm"
        )}
      >
        {selected ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

function MediaCard({ asset, thumbUrl, onVisible, selectMode, selected, onToggle, onOpen, onMenu, dragKeys }: CardBaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  useVisible(ref, asset, onVisible);
  const Icon = kindIcon(asset.kind);
  const duration = asset.kind === "video" ? formatDuration(asset.duration_seconds) : null;
  const size = asset.file_size ? formatFileSize(asset.file_size) : null;
  const date = shortDate(asset.created_at);
  return (
    <div
      ref={ref}
      {...dragProps(dragKeys)}
      className={cn(
        "group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md",
        selected ? "border-accent ring-2 ring-accent/30" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={() => (selectMode ? onToggle() : onOpen())}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        aria-label={selectMode ? `${selected ? "Deselect" : "Select"} ${asset.title}` : `Preview ${asset.title}`}
      >
        <Thumb asset={asset} thumbUrl={thumbUrl} sizes="(min-width: 1536px) 18vw, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 48vw" />
        {asset.kind === "video" ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
              <Play className="ml-0.5 h-5 w-5" aria-hidden />
            </span>
          </span>
        ) : null}
        <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          <Icon className="h-3 w-3" aria-hidden />
          {KIND_LABEL[asset.kind]}
        </span>
        {duration ? (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {duration}
          </span>
        ) : null}
        {asset.is_favorite ? <Star className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 fill-amber-400 text-amber-400 drop-shadow" aria-label="Favorite" /> : null}
      </button>
      <SelectBox selected={selected} visible={selectMode} onToggle={onToggle} label={`Select ${asset.title}`} />
      <div className="flex min-w-0 flex-1 items-start gap-1 px-3 pb-2.5 pt-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-heading" title={asset.title}>
            {asset.title}
          </p>
          <p className="truncate text-xs text-muted" title={assetLocation(asset)}>
            {assetLocation(asset)}
          </p>
          <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-1 text-xs text-muted">
            {size ? <span className="whitespace-nowrap">{size}</span> : null}
            {size && date ? <span aria-hidden>•</span> : null}
            {date ? <span className="whitespace-nowrap">{date}</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => onMenu(e.currentTarget)}
          aria-label={`Actions for ${asset.title}`}
          aria-haspopup="menu"
          className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-heading"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function MediaRow({ asset, thumbUrl, onVisible, selectMode, selected, onToggle, onOpen, onMenu, dragKeys }: CardBaseProps) {
  const ref = useRef<HTMLLIElement>(null);
  useVisible(ref, asset, onVisible);
  return (
    <li ref={ref} {...dragProps(dragKeys)} className={cn("group relative flex min-w-0 items-center gap-3 px-2 py-2 sm:px-3", selected && "bg-accent-subtle/50")}>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => (selectMode ? onToggle() : onOpen())}
          className="relative block h-12 w-16 overflow-hidden rounded-lg bg-subtle sm:h-14 sm:w-20"
          aria-label={selectMode ? `${selected ? "Deselect" : "Select"} ${asset.title}` : `Preview ${asset.title}`}
        >
          <Thumb asset={asset} thumbUrl={thumbUrl} sizes="80px" />
        </button>
        <SelectBox selected={selected} visible={selectMode} onToggle={onToggle} label={`Select ${asset.title}`} />
      </div>
      <button type="button" onClick={() => (selectMode ? onToggle() : onOpen())} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-heading" title={asset.title}>
          {asset.title}
        </p>
        <p className="truncate text-xs text-muted">
          {KIND_LABEL[asset.kind]} · {assetLocation(asset)}
        </p>
      </button>
      <span className="hidden w-24 shrink-0 text-right text-xs text-muted md:block">{asset.file_size ? formatFileSize(asset.file_size) : "—"}</span>
      <span className="hidden w-28 shrink-0 text-right text-xs text-muted sm:block">{shortDate(asset.created_at)}</span>
      <button
        type="button"
        onClick={(e) => onMenu(e.currentTarget)}
        aria-label={`Actions for ${asset.title}`}
        aria-haspopup="menu"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-heading"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
    </li>
  );
}
