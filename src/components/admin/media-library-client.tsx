"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RemoteImage } from "@/components/ui/remote-image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckboxDropdown, type CheckboxOption } from "@/components/ui/checkbox-dropdown";
import {
  ALL_TIME,
  DateRangeFilter,
  dateRangeToIso,
  describeDateRange,
  isDateRangeActive,
  type DateRangeValue,
} from "@/components/ui/date-range-filter";
import { formatDate } from "@/lib/utils";
import { formatFileSize } from "@/lib/brand";
import { DAM_SUGGESTED_TAGS } from "@/lib/constants";
import type { LibraryAsset, LibraryAssetKind } from "@/lib/media-library";
import {
  Search, Star, ImageIcon, Video, FileText, Globe, Download, ExternalLink, Box,
  X, Filter, ChevronDown, Trash2, Tag, Pencil, Loader2, CheckSquare, Square, Upload, Share2,
  ListChecks, AlertTriangle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePhotoShareDialog } from "@/components/photos/photo-share-dialog";
import { UNFILED_FOLDER_LABEL, UNFILED_FOLDER_SCOPE } from "@/lib/project-zip-assets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MediaUploadModal } from "@/components/admin/media-upload-modal";
import { PropertyLineToolButton } from "@/components/admin/property-line-tool-button";
import { LibraryVideoPoster } from "@/components/ui/library-video-poster";
import { VideoMediaPlaceholder } from "@/components/ui/video-media-placeholder";
import { EXTERNAL_3D_PROVIDER_LABELS, isExternal3dProvider } from "@/lib/external-3d-models";
import {
  isVideoLibraryAsset,
  shouldFetchLibraryThumbnail,
  libraryKindLabel,
} from "@/lib/media-preview";
import { useRouter } from "next/navigation";
import { useIsStandalonePwaMobile } from "@/lib/use-is-standalone-pwa-mobile";
import { mediaDisplayName } from "@/lib/media-display-name";
import {
  createThumbRequestQueue,
  fetchThumbUrls,
  invalidateThumbUrl,
} from "@/lib/media-thumb-client";

interface FilterOptions {
  clients: { id: string; name: string; full_name: string | null; company: string | null }[];
  properties: { id: string; address: string; nickname: string | null }[];
  projects: { id: string; project_name: string; property_address: string }[];
  services?: string[];
}

interface MediaLibraryClientProps {
  initialAssets: LibraryAsset[];
  initialTotal: number;
  initialKindCounts?: Partial<Record<LibraryAssetKind, number>>;
  filterOptions: FilterOptions;
  openUploadOnMount?: boolean;
  initialQuery?: string;
  /** Which kinds of photo sharing this user may manage. */
  photoSharing?: { email: boolean; link: boolean };
}

const TYPE_OPTIONS: CheckboxOption[] = [
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "tour", label: "360° Tours" },
  { value: "model", label: "3D Models" },
  { value: "document", label: "Documents" },
];

const PAGE_SIZE = 48;
/** Bulk PATCH chunk size (the bulk route checks access per id). */
const BULK_CHUNK = 100;
/** ZIP parts: the download route accepts up to 200 ids; keep parts well under its time limit. */
const ZIP_MAX_FILES = 100;
const ZIP_MAX_BYTES = 1024 * 1024 * 1024;

type KindCounts = Partial<Record<LibraryAssetKind, number>>;

/** Selection is either explicit keys, or "everything matching `query`" minus exclusions. */
type Selection =
  | { mode: "ids"; keys: Set<string> }
  | { mode: "all"; query: string; excluded: Set<string> };

const EMPTY_SELECTION: Selection = { mode: "ids", keys: new Set() };

type ResolvedItem = { id: string; kind: LibraryAssetKind; has_file: boolean; file_size: number | null };

type BulkKind = "favorite" | "download" | "delete";

interface PendingBulk {
  action: BulkKind;
  items: ResolvedItem[];
  /** Count the toolbar showed when the action was clicked. */
  expected: number;
}

function assetKey(a: { kind: LibraryAssetKind; id: string }) {
  return `${a.kind}:${a.id}`;
}

function parseKey(key: string): { kind: LibraryAssetKind; id: string } {
  const i = key.indexOf(":");
  return { kind: key.slice(0, i) as LibraryAssetKind, id: key.slice(i + 1) };
}

function isFileKind(kind: LibraryAssetKind) {
  return kind === "photo" || kind === "video" || kind === "document";
}

function kindIcon(kind: LibraryAssetKind) {
  if (kind === "photo") return ImageIcon;
  if (kind === "video") return Video;
  if (kind === "tour") return Globe;
  if (kind === "model") return Box;
  return FileText;
}

function buildQuery(params: Record<string, string | string[] | boolean | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((item) => item && sp.append(k, item));
    else if (v !== undefined && v !== "" && v !== false) sp.set(k, String(v));
  });
  return sp.toString();
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** Split downloadable files into ZIP parts bounded by file count and bytes. */
function zipBatches(items: ResolvedItem[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = item.file_size ?? 0;
    if (current.length && (current.length >= ZIP_MAX_FILES || bytes + size > ZIP_MAX_BYTES)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item.id);
    bytes += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

/**
 * Start a ZIP download without buffering it in JS: POST a form into a hidden iframe so
 * the browser streams the attachment. If the server answers with a JSON error instead,
 * the iframe loads it and we surface the message.
 */
function submitZipDownload(ids: string[], part: number, parts: number) {
  const name = `media-zip-${Date.now()}-${part}`;
  const iframe = document.createElement("iframe");
  iframe.name = name;
  iframe.style.display = "none";
  iframe.onload = () => {
    try {
      const text = iframe.contentDocument?.body?.innerText?.trim();
      if (text) {
        const data = JSON.parse(text) as { message?: string };
        toast.error(
          parts > 1
            ? `ZIP part ${part} of ${parts} failed: ${data.message ?? "Download failed"}`
            : data.message ?? "Download failed"
        );
      }
    } catch {
      // Not JSON / not readable → the download itself started.
    }
  };
  document.body.appendChild(iframe);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/media/library/download-zip";
  form.target = name;
  form.style.display = "none";
  for (const [k, v] of [["ids", ids.join(",")], ["part", String(part)], ["parts", String(parts)]]) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
  // Leave the iframe long enough for the response to start streaming.
  window.setTimeout(() => iframe.remove(), 10 * 60 * 1000);
}

export function MediaLibraryClient({
  initialAssets,
  initialTotal,
  initialKindCounts = {},
  filterOptions,
  openUploadOnMount = false,
  initialQuery = "",
  photoSharing = { email: false, link: false },
}: MediaLibraryClientProps) {
  const router = useRouter();
  const photoShare = usePhotoShareDialog();
  const canSharePhotos = photoSharing.email || photoSharing.link;
  const [assets, setAssets] = useState(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [kindCounts, setKindCounts] = useState<KindCounts>(initialKindCounts);
  const [uploadOpen, setUploadOpen] = useState(openUploadOnMount);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialAssets.length < initialTotal);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery);
  const [types, setTypes] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeValue>(ALL_TIME);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [selectMode, setSelectMode] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [pendingBulk, setPendingBulk] = useState<PendingBulk | null>(null);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [drawerAsset, setDrawerAsset] = useState<LibraryAsset | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const loaderRef = useRef<HTMLDivElement>(null);
  const thumbQueueRef = useRef(
    createThumbRequestQueue((urls) => {
      setThumbUrls((prev) => ({ ...prev, ...urls }));
    })
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  /** Canonical query string for the current filters + search (no paging). */
  const filterQuery = useMemo(() => {
    const range = dateRangeToIso(dateRange);
    return buildQuery({
      q: debouncedQ.trim(),
      type: types,
      service: services,
      client_id: clientIds,
      property_id: propertyIds,
      date_from: range.from,
      date_to: range.to,
      favorites: favoritesOnly ? "1" : undefined,
    });
  }, [debouncedQ, types, services, clientIds, propertyIds, dateRange, favoritesOnly]);

  const fetchPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      setLoading(true);
      try {
        const paging = buildQuery({ page: pageNum, limit: PAGE_SIZE });
        const qs = filterQuery ? `${filterQuery}&${paging}` : paging;
        const res = await fetch(`/api/media/library?${qs}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setAssets((prev) => (replace ? data.assets : [...prev, ...data.assets]));
        setTotal(data.total);
        setKindCounts(data.kindCounts ?? {});
        setHasMore(data.hasMore);
        setPage(pageNum);
      } catch {
        toast.error("Failed to load media library");
      } finally {
        setLoading(false);
      }
    },
    [filterQuery]
  );

  // Filters or search changed → reload, and drop any selection made under the old
  // filters so a bulk action can never reach assets the user didn't pick.
  const lastQueryRef = useRef(filterQuery);
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  useEffect(() => {
    fetchPage(1, true);
    if (lastQueryRef.current !== filterQuery) {
      lastQueryRef.current = filterQuery;
      const prev = selectionRef.current;
      if (prev.mode === "all" || prev.keys.size > 0) {
        toast.info("Selection cleared because the filters or search changed.");
        setSelection(EMPTY_SELECTION);
      }
    }
  }, [fetchPage, filterQuery]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          fetchPage(page + 1, false);
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, page, fetchPage]);

  async function loadThumb(asset: LibraryAsset) {
    if (thumbUrls[asset.id] || !shouldFetchLibraryThumbnail(asset)) return;
    thumbQueueRef.current.request(asset.id);
  }

  async function refreshThumbForAsset(assetId: string, force = true) {
    invalidateThumbUrl(assetId);
    if (force) {
      setThumbUrls((prev) => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
    }
    const urls = await fetchThumbUrls([assetId], { force: true });
    const url = urls[assetId];
    if (url) {
      // Cache-bust only after an edit/replace so the browser picks up the new bytes.
      const separator = url.includes("?") ? "&" : "?";
      setThumbUrls((prev) => ({
        ...prev,
        [assetId]: force ? `${url}${separator}v=${Date.now()}` : url,
      }));
    }
  }

  // ---- Selection -------------------------------------------------------------

  const isSelected = useCallback(
    (a: LibraryAsset) =>
      selection.mode === "all" ? !selection.excluded.has(assetKey(a)) : selection.keys.has(assetKey(a)),
    [selection]
  );

  const selectedKindCounts = useMemo<KindCounts>(() => {
    if (selection.mode === "ids") {
      const counts: KindCounts = {};
      selection.keys.forEach((k) => {
        const { kind } = parseKey(k);
        counts[kind] = (counts[kind] ?? 0) + 1;
      });
      return counts;
    }
    const counts: KindCounts = { ...kindCounts };
    selection.excluded.forEach((k) => {
      const { kind } = parseKey(k);
      counts[kind] = Math.max(0, (counts[kind] ?? 0) - 1);
    });
    return counts;
  }, [selection, kindCounts]);

  const selectedCount =
    selection.mode === "all" ? Math.max(0, total - selection.excluded.size) : selection.keys.size;
  const selectedLinks = (selectedKindCounts.tour ?? 0) + (selectedKindCounts.model ?? 0);
  const selectedModels = selectedKindCounts.model ?? 0;
  const selectedTours = selectedKindCounts.tour ?? 0;
  const allMatchingSelected = selection.mode === "all" && selection.excluded.size === 0;
  const bulkBusy = resolving || bulkProgress !== null;

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
  }

  function selectAllMatching() {
    setSelection({ mode: "all", query: filterQuery, excluded: new Set() });
  }

  function clearSelection() {
    setSelection(EMPTY_SELECTION);
  }

  /** Turn the current selection into concrete ids (server-resolved for "all matching"). */
  async function resolveSelection(): Promise<ResolvedItem[] | null> {
    if (selection.mode === "ids") {
      const byKey = new Map(assets.map((a) => [assetKey(a), a]));
      return [...selection.keys].map((key) => {
        const { kind, id } = parseKey(key);
        const a = byKey.get(key);
        return {
          id,
          kind,
          has_file: a ? a.has_file : isFileKind(kind),
          file_size: a?.file_size ?? null,
        };
      });
    }
    if (selection.query !== filterQuery) {
      // Should not happen (selection is cleared on filter change) — refuse rather than guess.
      toast.error("Filters changed since you selected all. Please select again.");
      clearSelection();
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
      const data = (await res.json()) as { items: ResolvedItem[] };
      return data.items;
    } catch {
      toast.error("Couldn't load the selected assets. Please try again.");
      return null;
    } finally {
      setResolving(false);
    }
  }

  async function startBulk(action: BulkKind) {
    const expected = selectedCount;
    const items = await resolveSelection();
    if (!items) return;
    if (!items.length) {
      toast.error("Nothing is selected.");
      return;
    }
    const pending = { action, items, expected };
    // Delete always confirms; other actions confirm only if the matching set moved.
    if (action === "delete" || items.length !== expected) setPendingBulk(pending);
    else void runBulk(pending);
  }

  async function patchBulk(action: string, ids: string[], kind: "media" | "tour") {
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += BULK_CHUNK) {
      const chunk = ids.slice(i, i + BULK_CHUNK);
      if (action === "delete") {
        setBulkProgress(`Deleting ${Math.min(i + chunk.length, ids.length).toLocaleString()} of ${ids.length.toLocaleString()}…`);
      }
      const res = await fetch("/api/media/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ids: chunk, kind }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { deleted?: number };
        ok += action === "delete" ? data.deleted ?? chunk.length : chunk.length;
      } else {
        failed += chunk.length;
        if (res.status === 403) break;
      }
    }
    return { ok, failed };
  }

  async function runBulk({ action, items }: PendingBulk) {
    setPendingBulk(null);
    const files = items.filter((i) => isFileKind(i.kind));
    const tours = items.filter((i) => i.kind === "tour");
    const models = items.filter((i) => i.kind === "model");
    try {
      if (action === "favorite") {
        setBulkProgress("Starring…");
        const a = await patchBulk("favorite", files.map((i) => i.id), "media");
        const b = await patchBulk("favorite", tours.map((i) => i.id), "tour");
        const starred = a.ok + b.ok;
        const failed = a.failed + b.failed;
        const notes = [
          models.length ? `${plural(models.length, "3D model")} skipped (can't be starred)` : null,
          failed ? `${failed.toLocaleString()} failed` : null,
        ].filter(Boolean);
        if (starred) toast.success(`Starred ${plural(starred, "item")}${notes.length ? ` · ${notes.join(" · ")}` : ""}`);
        else toast.error(notes.join(" · ") || "Nothing to star");
        const starredKeys = new Set([
          ...files.map((i) => assetKey(i)),
          ...tours.map((i) => assetKey(i)),
        ]);
        setAssets((prev) => prev.map((x) => (starredKeys.has(assetKey(x)) ? { ...x, is_favorite: true } : x)));
        return;
      }

      if (action === "download") {
        const downloadable = files.filter((i) => i.has_file);
        const skippedLinks = items.length - files.length;
        const skippedNoFile = files.length - downloadable.length;
        if (!downloadable.length) {
          toast.error("None of the selected items are files — 360° tours, 3D models and YouTube links can't be downloaded.");
          return;
        }
        const batches = zipBatches(downloadable);
        const skippedNote = [
          skippedLinks ? `${plural(skippedLinks, "tour/3D model link")} skipped` : null,
          skippedNoFile ? `${plural(skippedNoFile, "linked video")} skipped` : null,
        ].filter(Boolean).join(" · ");
        toast.success(
          batches.length > 1
            ? `Preparing ${plural(downloadable.length, "file")} in ${batches.length} ZIP parts. Allow multiple downloads if your browser asks.`
            : `Preparing ZIP of ${plural(downloadable.length, "file")}…`,
          skippedNote ? { description: skippedNote } : undefined
        );
        for (let i = 0; i < batches.length; i++) {
          setBulkProgress(batches.length > 1 ? `Starting ZIP part ${i + 1} of ${batches.length}…` : "Starting ZIP…");
          submitZipDownload(batches[i], i + 1, batches.length);
          // Stagger parts so the browser treats them as separate downloads.
          if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 2500));
        }
        return;
      }

      // delete — stored files only; links are managed from their project.
      if (!files.length) {
        toast.error("Nothing deleted — 360° tours and 3D models are removed from their project page.");
        return;
      }
      const result = await patchBulk("delete", files.map((i) => i.id), "media");
      if (result.ok) {
        toast.success(
          `Deleted ${plural(result.ok, "file")}${result.failed ? ` · ${result.failed.toLocaleString()} failed` : ""}`
        );
      } else {
        toast.error("Bulk delete failed");
      }
      clearSelection();
      void fetchPage(1, true);
    } finally {
      setBulkProgress(null);
    }
  }

  async function toggleFavorite(asset: LibraryAsset) {
    if (asset.kind === "model") return;
    const action = asset.is_favorite ? "unfavorite" : "favorite";
    const res = await fetch("/api/media/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, ids: [asset.id], kind: asset.kind === "tour" ? "tour" : "media" }),
    });
    if (res.ok) {
      setAssets((prev) =>
        prev.map((a) => (a.id === asset.id ? { ...a, is_favorite: !a.is_favorite } : a))
      );
      if (drawerAsset?.id === asset.id) {
        setDrawerAsset({ ...drawerAsset, is_favorite: !drawerAsset.is_favorite });
      }
    }
  }

  // ---- Filters ---------------------------------------------------------------

  const serviceOptions = useMemo<CheckboxOption[]>(
    () => (filterOptions.services ?? []).map((s) => ({ value: s, label: s })),
    [filterOptions.services]
  );
  const clientOptions = useMemo<CheckboxOption[]>(
    () =>
      filterOptions.clients.map((c) => ({
        value: c.id,
        label: c.full_name || c.name,
        hint: c.company ?? undefined,
      })),
    [filterOptions.clients]
  );
  const propertyOptions = useMemo<CheckboxOption[]>(
    () =>
      filterOptions.properties.map((p) => ({
        value: p.id,
        label: p.nickname || p.address,
        hint: p.nickname ? p.address : undefined,
      })),
    [filterOptions.properties]
  );

  const activeFilters = useMemo(() => {
    const labelsFor = (values: string[], options: CheckboxOption[]) =>
      values.map((v) => options.find((o) => o.value === v)?.label ?? v);
    const list: { key: string; label: string; values: string[]; clear: () => void }[] = [];
    if (types.length) list.push({ key: "type", label: "Type", values: labelsFor(types, TYPE_OPTIONS), clear: () => setTypes([]) });
    if (services.length) list.push({ key: "service", label: "Service", values: services, clear: () => setServices([]) });
    if (clientIds.length) list.push({ key: "client", label: "Client", values: labelsFor(clientIds, clientOptions), clear: () => setClientIds([]) });
    if (propertyIds.length) list.push({ key: "property", label: "Property", values: labelsFor(propertyIds, propertyOptions), clear: () => setPropertyIds([]) });
    if (isDateRangeActive(dateRange)) list.push({ key: "date", label: "Date", values: [describeDateRange(dateRange) ?? ""], clear: () => setDateRange(ALL_TIME) });
    if (favoritesOnly) list.push({ key: "fav", label: "Favorites", values: ["Only"], clear: () => setFavoritesOnly(false) });
    return list;
  }, [types, services, clientIds, propertyIds, dateRange, favoritesOnly, clientOptions, propertyOptions]);

  const panelFilterCount = activeFilters.filter((f) => f.key !== "fav").length;

  function resetAllFilters() {
    setTypes([]);
    setServices([]);
    setClientIds([]);
    setPropertyIds([]);
    setDateRange(ALL_TIME);
    setFavoritesOnly(false);
  }

  const pendingFiles = pendingBulk?.items.filter((i) => isFileKind(i.kind)).length ?? 0;
  const pendingLinks = (pendingBulk?.items.length ?? 0) - pendingFiles;

  return (
    <div className="space-y-4">
      {/* Search + toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search address, client, project, filename, tags..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" size="sm" className="min-h-11" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Add Media
          </Button>
          <Button
            variant={favoritesOnly ? "accent" : "outline"}
            size="sm"
            onClick={() => setFavoritesOnly((f) => !f)}
          >
            <Star className={cn("h-4 w-4", favoritesOnly && "fill-current")} /> Favorites
          </Button>
          <Button
            variant={selectMode ? "accent" : "outline"}
            size="sm"
            onClick={() => { setSelectMode((m) => !m); clearSelection(); }}
          >
            {selectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            Select
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((f) => !f)} aria-expanded={showFilters}>
            <Filter className="h-4 w-4" /> Filters
            {panelFilterCount > 0 ? (
              <Badge className="ml-1 border border-accent/40 bg-white surface-dark:bg-card text-heading">
                {panelFilterCount}
              </Badge>
            ) : null}
            <ChevronDown className={cn("h-3 w-3 transition", showFilters && "rotate-180")} />
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="space-y-3 rounded-xl border border-border bg-white surface-dark:bg-card p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <CheckboxDropdown label="Media Type" options={TYPE_OPTIONS} selected={types} onChange={setTypes} searchable={false} />
            <CheckboxDropdown label="Services" options={serviceOptions} selected={services} onChange={setServices} emptyText="No services yet" />
            <CheckboxDropdown label="Clients" options={clientOptions} selected={clientIds} onChange={setClientIds} emptyText="No clients yet" />
            <CheckboxDropdown label="Properties" options={propertyOptions} selected={propertyIds} onChange={setPropertyIds} emptyText="No properties yet" />
            <DateRangeFilter label="Date Range" value={dateRange} onChange={setDateRange} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Filters combine — assets must match every filter you set.</span>
            {activeFilters.length > 0 ? (
              <button type="button" onClick={resetAllFilters} className="font-medium text-accent hover:underline">
                Reset all
              </button>
            ) : null}
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <span
              key={f.key}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/5 py-0.5 pl-3 pr-1 text-xs"
            >
              <span className="text-muted">{f.label}:</span>
              <span className="truncate font-medium text-heading" title={f.values.join(", ")}>
                {f.values.join(", ")}
              </span>
              <button
                type="button"
                onClick={f.clear}
                aria-label={`Clear ${f.label} filter`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-accent/10 hover:text-heading"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={resetAllFilters}>
            Reset all
          </Button>
        </div>
      )}

      {selectMode && (
        <div className="space-y-1.5 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {selection.mode === "all"
                ? allMatchingSelected
                  ? `All ${selectedCount.toLocaleString()} matching selected`
                  : `${selectedCount.toLocaleString()} of ${total.toLocaleString()} matching selected`
                : `${selectedCount.toLocaleString()} selected`}
            </span>
            {!allMatchingSelected && total > 0 ? (
              <Button variant="ghost" size="sm" onClick={selectAllMatching} disabled={bulkBusy}>
                <ListChecks className="h-4 w-4" /> Select all {total.toLocaleString()}
              </Button>
            ) : null}
            {selectedCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearSelection} disabled={bulkBusy}>
                <X className="h-4 w-4" /> Clear selection
              </Button>
            ) : null}
            {selectedCount > 0 ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {bulkProgress || resolving ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {bulkProgress ?? "Loading selection…"}
                  </span>
                ) : null}
                <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => void startBulk("favorite")}>
                  <Star className="h-4 w-4" /> Star
                </Button>
                <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => void startBulk("download")}>
                  <Download className="h-4 w-4" /> Download
                </Button>
                <Button variant="outline" size="sm" className="text-red-600" disabled={bulkBusy} onClick={() => void startBulk("delete")}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            ) : (
              <span className="text-xs text-muted">Tap items to select them.</span>
            )}
          </div>
          {selectedLinks > 0 ? (
            <p className="text-xs text-muted">
              Includes {[selectedTours ? plural(selectedTours, "360° tour") : null, selectedModels ? plural(selectedModels, "3D model") : null].filter(Boolean).join(" and ")}.
              {" "}These are links, not files: Download and Delete skip them{selectedModels ? ", and 3D models can't be starred" : ""}.
            </p>
          ) : null}
        </div>
      )}

      <p className="text-xs text-muted">{plural(total, "asset")}</p>

      {assets.length === 0 && !loading ? (
        <EmptyState icon={ImageIcon} title="No assets found" description="Try adjusting your search or filters." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset) => (
            <AssetCard
              key={`${asset.kind}-${asset.id}`}
              asset={asset}
              thumbUrl={thumbUrls[asset.id]}
              onLoadThumb={() => loadThumb(asset)}
              selected={selectMode && isSelected(asset)}
              selectMode={selectMode}
              onSelect={() => toggleSelect(asset)}
              onOpen={() => setDrawerAsset(asset)}
              onFavorite={() => toggleFavorite(asset)}
            />
          ))}
        </div>
      )}

      <div ref={loaderRef} className="flex justify-center py-6">
        {loading && <Loader2 className="h-6 w-6 animate-spin text-muted" />}
      </div>

      <ConfirmDialog
        open={pendingBulk !== null}
        onClose={() => setPendingBulk(null)}
        onConfirm={() => pendingBulk && void runBulk(pendingBulk)}
        title={
          pendingBulk?.action === "delete"
            ? `Delete ${plural(pendingFiles, "file")}?`
            : pendingBulk?.action === "download"
              ? "Download selection?"
              : "Star selection?"
        }
        confirmLabel={
          pendingBulk?.action === "delete"
            ? pendingFiles
              ? `Delete ${plural(pendingFiles, "file")}`
              : "OK"
            : "Continue"
        }
        destructive={pendingBulk?.action === "delete" && pendingFiles > 0}
      >
        {pendingBulk ? (
          <div className="space-y-2 text-sm text-foreground">
            {pendingBulk.items.length !== pendingBulk.expected ? (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-amber-800 surface-dark:bg-amber-500/10 surface-dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                The matching assets changed since you selected them: this will apply to{" "}
                {plural(pendingBulk.items.length, "item")}, not {pendingBulk.expected.toLocaleString()}.
              </p>
            ) : null}
            {pendingBulk.action === "delete" ? (
              pendingFiles ? (
                <p>
                  {plural(pendingFiles, "file")} will be permanently removed, including the original files. Share links
                  for these photos stop working. This can&apos;t be undone.
                </p>
              ) : (
                <p>Nothing will be deleted.</p>
              )
            ) : null}
            {pendingBulk.action === "delete" && pendingLinks > 0 ? (
              <p className="text-muted">
                {plural(pendingLinks, "tour/3D model link")} in your selection will be skipped. Remove those from
                their project page.
              </p>
            ) : null}
          </div>
        ) : (
          <span />
        )}
      </ConfirmDialog>

      {drawerAsset && (
        <AssetDrawer
          asset={drawerAsset}
          projects={filterOptions.projects}
          onClose={() => setDrawerAsset(null)}
          onUpdate={(updated) => {
            setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            setDrawerAsset(updated);
          }}
          onFavorite={() => toggleFavorite(drawerAsset)}
          onShare={
            canSharePhotos
              ? () =>
                  photoShare.openShare({
                    id: drawerAsset.id,
                    name: mediaDisplayName(drawerAsset),
                    thumbUrl: thumbUrls[drawerAsset.id] ?? null,
                  })
              : undefined
          }
          onDeleted={() => {
            setAssets((prev) => prev.filter((a) => a.id !== drawerAsset.id));
            setDrawerAsset(null);
          }}
          onPropertyLineSaved={async (savedAsset) => {
            const savedId =
              savedAsset && typeof savedAsset.id === "string" ? savedAsset.id : drawerAsset.id;

            const detailRes = await fetch(`/api/media/library/${drawerAsset.id}?kind=${drawerAsset.kind}`, {
              credentials: "include",
            });
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.asset) {
                const updated = detailData.asset as LibraryAsset;
                setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                setDrawerAsset(updated);
              }
            }

            await refreshThumbForAsset(savedId);
            if (savedId !== drawerAsset.id) {
              await refreshThumbForAsset(drawerAsset.id);
            }

            void fetchPage(1, true);
          }}
        />
      )}

      <MediaUploadModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          if (openUploadOnMount) router.replace("/admin/media");
        }}
        projects={filterOptions.projects}
        onUploaded={() => {
          fetchPage(1, true);
        }}
      />
      {photoShare.dialog}
    </div>
  );
}

function AssetCard({
  asset, thumbUrl, onLoadThumb, selected, selectMode, onSelect, onOpen, onFavorite,
}: {
  asset: LibraryAsset;
  thumbUrl?: string;
  onLoadThumb: () => void;
  selected: boolean;
  selectMode: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  const Icon = kindIcon(asset.kind);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) onLoadThumb(); },
      { rootMargin: "100px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onLoadThumb]);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-white surface-dark:bg-card shadow-sm transition hover:shadow-md",
        selected ? "border-accent ring-2 ring-accent/30" : "border-border"
      )}
    >
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => (selectMode ? onSelect() : onOpen())}
      >
        <div className="relative aspect-[4/3] bg-slate-100 surface-dark:bg-subtle">
          {isVideoLibraryAsset(asset) ? (
            <LibraryVideoPoster asset={asset} thumbUrl={thumbUrl} className="absolute inset-0" />
          ) : thumbUrl ? (
            <RemoteImage src={thumbUrl} alt={asset.title} fill className="object-cover" sizes="200px" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Icon className="h-10 w-10 text-muted" />
            </div>
          )}
          {asset.is_cover && (
            <Badge className="absolute left-2 top-2 text-[10px] bg-accent text-accent-foreground">Cover</Badge>
          )}
          {(asset.kind === "tour" || asset.kind === "model") && (
            <Badge className="absolute bottom-2 left-2 bg-white/90 text-[10px] text-heading surface-dark:bg-card/90">
              {libraryKindLabel(asset.kind)} · Link
            </Badge>
          )}
          {asset.is_favorite && (
            <Star className="absolute right-2 top-2 h-4 w-4 fill-amber-400 text-amber-400" />
          )}
        </div>
        <div className="p-2.5">
          <p className="truncate text-sm font-medium text-heading">{asset.title}</p>
          <p className="truncate text-xs text-muted">{asset.property_address}</p>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted">
            <span>{asset.client_name}</span>
            {asset.file_size ? <span>· {formatFileSize(asset.file_size)}</span> : null}
            {asset.width && asset.height ? <span>· {asset.width}×{asset.height}</span> : null}
          </div>
        </div>
      </button>
      {selectMode && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border shadow-sm",
            selected ? "border-accent bg-accent text-accent-foreground" : "border-border bg-white/90 surface-dark:bg-card/90"
          )}
        >
          {selected ? <CheckSquare className="h-3.5 w-3.5" /> : null}
        </span>
      )}
      {!selectMode && asset.kind !== "model" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className="absolute right-2 top-2 rounded-full bg-white/90 surface-dark:bg-card/90 p-1.5 opacity-0 shadow transition group-hover:opacity-100"
        >
          <Star className={cn("h-3.5 w-3.5", asset.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted")} />
        </button>
      )}
    </div>
  );
}

function isVideoAsset(asset: LibraryAsset): boolean {
  return isVideoLibraryAsset(asset);
}

function AssetDrawer({
  asset, projects, onClose, onUpdate, onFavorite, onShare, onDeleted, onPropertyLineSaved,
}: {
  asset: LibraryAsset;
  projects: { id: string; project_name: string; property_address: string }[];
  onClose: () => void;
  onUpdate: (a: LibraryAsset) => void;
  onFavorite: () => void;
  /** Present when this user may share photos. */
  onShare?: () => void;
  onDeleted: () => void;
  onPropertyLineSaved?: (asset: Record<string, unknown>) => void;
}) {
  const isSharablePhoto = asset.kind === "photo" && asset.media_source !== "youtube";
  const isModel = asset.kind === "model";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const projectHref = asset.project_id
    ? asset.kind === "photo"
      ? `/admin/projects/${asset.project_id}?folder=${asset.folder_id ?? UNFILED_FOLDER_SCOPE}#photos`
      : `/admin/projects/${asset.project_id}`
    : null;
  const [detail, setDetail] = useState<{
    events: { id: string; event_type: string; description: string | null; created_at: string }[];
    downloads: { id: string; downloaded_by_email: string | null; created_at: string }[];
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isPwaMobile = useIsStandalonePwaMobile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: asset.title,
    description: asset.description ?? "",
    alt_text: asset.alt_text ?? "",
    notes: asset.notes ?? "",
    tags: asset.tags.join(", "),
    project_id: asset.project_id ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/media/library/${asset.id}?kind=${asset.kind}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setDetail({ events: d.events ?? [], downloads: d.downloads ?? [] }));
    if (isVideoAsset(asset) || asset.kind === "model") return;
    if (asset.kind !== "tour" && asset.media_source !== "youtube") {
      void fetchThumbUrls([asset.id]).then((urls) => {
        const url = urls[asset.id];
        if (url) setPreviewUrl(url);
      });
    } else if (asset.embed_url || asset.kuula_url) {
      setPreviewUrl(asset.embed_url || asset.kuula_url);
    }
  }, [asset]);

  async function saveMetadata() {
    if (asset.kind === "tour") return;
    setSaving(true);
    try {
      const res = await fetch("/api/media/" + asset.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: asset.id,
          title: form.title,
          description: form.description || null,
          alt_text: form.alt_text || null,
          notes: form.notes || null,
          project_id: form.project_id || null,
        }),
      });
      if (!res.ok) throw new Error();
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      await fetch("/api/media/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "set_tags", ids: [asset.id], tags }),
      });

      const detailRes = await fetch(`/api/media/library/${asset.id}?kind=${asset.kind}`, {
        credentials: "include",
      });
      const detailData = detailRes.ok ? await detailRes.json() : null;
      const refreshed = detailData?.asset as LibraryAsset | undefined;

      onUpdate(
        refreshed
          ? { ...refreshed, tags }
          : {
              ...asset,
              ...form,
              tags,
              title: form.title,
              project_id: form.project_id || null,
              project_name: form.project_id
                ? projects.find((p) => p.id === form.project_id)?.project_name ?? asset.project_name
                : "Unassigned",
            }
      );
      setEditing(false);
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    window.open(`/api/media/download/${asset.id}?file=1`, "_blank");
  }

  async function setAsCover() {
    const res = await fetch("/api/media/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "set_cover",
        ids: [asset.id],
        project_id: asset.project_id,
        cover_asset_id: asset.id,
      }),
    });
    if (!res.ok) {
      toast.error("Couldn't update the project cover");
      return;
    }
    toast.success("Project cover updated");
    onUpdate({ ...asset, is_cover: true });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${asset.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      setConfirmDelete(false);
      onDeleted();
      toast.success("Deleted");
    } catch {
      toast.error("Couldn't delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white surface-dark:bg-card shadow-2xl safe-area-x"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="truncate pr-2 font-semibold text-heading">{asset.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 surface-dark:hover:bg-subtle"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className={cn("flex-1 overflow-y-auto p-4 space-y-6", isPwaMobile && "admin-pwa-fixed-bottom-pad")}
        >
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100 surface-dark:bg-subtle">
            {asset.kind === "model" && asset.embed_url ? (
              <iframe
                src={asset.embed_url}
                className="h-full w-full"
                title={asset.title}
                sandbox="allow-scripts allow-same-origin allow-popups"
                allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
                allowFullScreen
              />
            ) : asset.kind === "tour" && asset.kuula_url ? (
              <iframe src={asset.kuula_url} className="h-full w-full" title={asset.title} />
            ) : asset.media_source === "youtube" && asset.embed_url ? (
              <iframe src={asset.embed_url} className="h-full w-full" title={asset.title} allowFullScreen />
            ) : isVideoAsset(asset) ? (
              <MediaDetailVideoPlayer asset={asset} />
            ) : previewUrl ? (
              <RemoteImage src={previewUrl} alt={asset.title} fill className="object-contain" sizes="500px" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">No preview</div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {isModel ? (
              asset.embed_url ? (
                <a
                  href={asset.embed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink className="h-4 w-4" /> Open viewer
                </a>
              ) : null
            ) : (
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={asset.kind === "tour"}>
                <Download className="h-4 w-4" /> Download
              </Button>
            )}
            {isSharablePhoto && onShare ? (
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            ) : null}
            {projectHref && (
              <Link href={projectHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <ExternalLink className="h-4 w-4" /> Open in project
              </Link>
            )}
            {!isModel ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onFavorite}
                aria-label={asset.is_favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star className={cn("h-4 w-4", asset.is_favorite && "fill-amber-400 text-amber-400")} />
              </Button>
            ) : null}
            {asset.kind === "photo" && asset.project_id && !asset.is_cover && (
              <Button variant="outline" size="sm" onClick={setAsCover}>Set as project cover</Button>
            )}
            {!isModel ? (
              <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            ) : null}
          </div>

          {editing ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <Select
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                placeholder="Assign to project"
                options={[
                  { value: "", label: "Unassigned" },
                  ...projects.map((p) => ({
                    value: p.id,
                    label: p.property_address ? `${p.project_name} — ${p.property_address}` : p.project_name,
                  })),
                ]}
              />
              {asset.kind === "photo" && form.project_id !== (asset.project_id ?? "") ? (
                <p className="text-xs text-amber-700 surface-dark:text-amber-300">
                  Moving this photo to another project takes it out of its folder and ends any share links or invites.
                </p>
              ) : null}
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" />
              <Input value={form.alt_text} onChange={(e) => setForm((f) => ({ ...f, alt_text: e.target.value }))} placeholder="Alt text" />
              <textarea
                className="w-full rounded-lg border border-border p-2 text-sm"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description"
              />
              <textarea
                className="w-full rounded-lg border border-border p-2 text-sm"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Admin notes"
              />
              <Input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder={`Tags (comma-separated). Suggested: ${DAM_SUGGESTED_TAGS.slice(0, 4).join(", ")}`}
              />
              {asset.kind === "photo" && asset.media_source !== "youtube" && (
                <PropertyLineToolButton
                  mediaId={asset.id}
                  fileName={mediaDisplayName(asset)}
                  title={asset.title}
                  projectId={asset.project_id}
                  onSaved={(savedAsset) => {
                    onPropertyLineSaved?.(savedAsset);
                  }}
                />
              )}
              <Button variant="accent" size="sm" disabled={saving} onClick={saveMetadata}>
                {saving ? "Saving..." : "Save Metadata"}
              </Button>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Client" value={asset.client_name} />
              <Meta label="Company" value={asset.client_company ?? "—"} />
              <Meta label="Property" value={asset.property_address} className="col-span-2" />
              <Meta
                label={asset.kind === "photo" && asset.project_id ? "Location" : "Project"}
                value={
                  asset.kind === "photo" && asset.project_id
                    ? `${asset.project_name} › ${asset.folder_name ?? UNFILED_FOLDER_LABEL}`
                    : asset.project_name
                }
                className="col-span-2"
              />
              {isModel ? (
                <Meta
                  label="Provider"
                  value={isExternal3dProvider(asset.media_source) ? EXTERNAL_3D_PROVIDER_LABELS[asset.media_source] : asset.media_source}
                />
              ) : null}
              <Meta label="Service" value={asset.service_type} />
              <Meta label="Uploaded" value={formatDate(asset.created_at)} />
              <Meta label="Downloads" value={String(asset.download_count)} />
              {asset.file_size ? <Meta label="Size" value={formatFileSize(asset.file_size)} /> : null}
              {asset.width && asset.height ? <Meta label="Dimensions" value={`${asset.width}×${asset.height}`} /> : null}
              {asset.tags.length > 0 && (
                <div className="col-span-2 flex flex-wrap gap-1">
                  {asset.tags.map((t) => (
                    <Badge key={t} className="text-xs bg-slate-100 surface-dark:bg-subtle"><Tag className="h-3 w-3" />{t}</Badge>
                  ))}
                </div>
              )}
            </dl>
          )}

          {detail && detail.downloads.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-heading mb-2">Download History</h3>
              <ul className="space-y-1 text-xs text-muted">
                {detail.downloads.map((d) => (
                  <li key={d.id}>{d.downloaded_by_email ?? "Unknown"} · {formatDate(d.created_at)}</li>
                ))}
              </ul>
            </section>
          )}

          {detail && detail.events.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-heading mb-2">Timeline</h3>
              <ul className="space-y-2 text-sm">
                {detail.events.map((e) => (
                  <li key={e.id} className="border-l-2 border-border pl-3">
                    <p className="text-foreground">{e.description || e.event_type}</p>
                    <p className="text-xs text-muted">{formatDate(e.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isModel ? (
            <p className="border-t border-border pt-4 text-xs text-muted">
              3D models are external viewer links. Edit or remove them from the project page.
            </p>
          ) : (
          <div className="border-t border-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 text-red-600"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete {libraryKindLabel(asset.kind).toLowerCase()}…
            </Button>
          </div>
          )}
        </div>
      </aside>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
        title={`Delete ${libraryKindLabel(asset.kind).toLowerCase()}?`}
        confirmLabel="Delete permanently"
        destructive
        busy={deleting}
      >
        <p className="text-sm text-foreground">
          <span className="font-medium">{asset.title}</span>{" "}
          will be permanently removed, including the original file. This can&apos;t be undone.
        </p>
        {isSharablePhoto ? (
          <p className="mt-2 text-sm text-muted">Any share links or invites for this photo stop working.</p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

function MediaDetailVideoPlayer({ asset }: { asset: LibraryAsset }) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  async function startPlayback() {
    if (playing || loading) return;
    setLoading(true);
    setLoadError(false);
    try {
      const streamRes = await fetch(`/api/media/download/${asset.id}?preview=1`, { credentials: "include" });
      const streamData = await streamRes.json();
      if (!streamRes.ok || !streamData.url) {
        setLoadError(true);
        return;
      }
      setStreamUrl(streamData.url);
      setPlaying(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  if (playing && streamUrl) {
    return (
      <video
        key={streamUrl}
        src={streamUrl}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
        onError={() => setLoadError(true)}
      />
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted">
        <Video className="h-8 w-8 opacity-50" />
        <p>Video preview unavailable.</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startPlayback}
      className="relative flex h-full w-full items-stretch"
      aria-label={`Play ${asset.title}`}
    >
      <VideoMediaPlaceholder fileName={mediaDisplayName(asset)} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
    </button>
  );
}

function Meta({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium text-heading truncate">{value}</dd>
    </div>
  );
}
