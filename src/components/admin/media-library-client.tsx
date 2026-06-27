"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RemoteImage } from "@/components/ui/remote-image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { formatFileSize } from "@/lib/brand";
import {
  DAM_SERVICE_FILTERS,
  DAM_SUGGESTED_TAGS,
  PROPERTY_TYPES,
} from "@/lib/constants";
import type { LibraryAsset, LibraryAssetKind } from "@/lib/media-library";
import {
  Search, Star, ImageIcon, Video, FileText, Globe, Download, ExternalLink,
  X, Filter, ChevronDown, Trash2, Tag, Copy, Pencil, Loader2, CheckSquare, Square, Upload, Play,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MediaUploadModal } from "@/components/admin/media-upload-modal";
import { useRouter } from "next/navigation";
import { useIsStandalonePwaMobile } from "@/lib/use-is-standalone-pwa-mobile";

interface FilterOptions {
  clients: { id: string; name: string; full_name: string | null; company: string | null }[];
  properties: { id: string; address: string; nickname: string | null }[];
  projects: { id: string; project_name: string; property_address: string }[];
}

interface MediaLibraryClientProps {
  initialAssets: LibraryAsset[];
  initialTotal: number;
  filterOptions: FilterOptions;
  openUploadOnMount?: boolean;
}

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "tour", label: "360 Tours" },
  { value: "document", label: "Documents" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "upload", label: "Uploaded" },
  { value: "youtube", label: "YouTube" },
  { value: "kuula", label: "Kuula" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "awaiting_payment", label: "Awaiting Payment" },
  { value: "delivered", label: "Delivered" },
];

const DATE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "year", label: "This year" },
];

function kindIcon(kind: LibraryAssetKind) {
  if (kind === "photo") return ImageIcon;
  if (kind === "video") return Video;
  if (kind === "tour") return Globe;
  return FileText;
}

function buildQuery(params: Record<string, string | boolean | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) sp.set(k, String(v));
  });
  return sp.toString();
}

export function MediaLibraryClient({
  initialAssets,
  initialTotal,
  filterOptions,
  openUploadOnMount = false,
}: MediaLibraryClientProps) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [uploadOpen, setUploadOpen] = useState(openUploadOnMount);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialAssets.length < initialTotal);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [type, setType] = useState("");
  const [service, setService] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [drawerAsset, setDrawerAsset] = useState<LibraryAsset | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const filterParams = useMemo(
    () => ({
      q: debouncedQ,
      type,
      service,
      property_type: propertyType,
      project_status: projectStatus,
      source,
      date,
      client_id: clientId,
      property_id: propertyId,
      favorites: favoritesOnly ? "1" : undefined,
    }),
    [debouncedQ, type, service, propertyType, projectStatus, source, date, clientId, propertyId, favoritesOnly]
  );

  const fetchPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      setLoading(true);
      try {
        const qs = buildQuery({ ...filterParams, page: pageNum, limit: 48 });
        const res = await fetch(`/api/media/library?${qs}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setAssets((prev) => (replace ? data.assets : [...prev, ...data.assets]));
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(pageNum);
      } catch {
        toast.error("Failed to load media library");
      } finally {
        setLoading(false);
      }
    },
    [filterParams]
  );

  useEffect(() => {
    fetchPage(1, true);
    setSelected(new Set());
  }, [fetchPage]);

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
    if (thumbUrls[asset.id] || asset.kind === "tour") return;
    if (asset.kind === "document") return;
    if (asset.media_source === "youtube") return;
    try {
      const res = await fetch(`/api/media/download/${asset.id}?thumb=1`, { credentials: "include" });
      const data = await res.json();
      if (data.url) setThumbUrls((p) => ({ ...p, [asset.id]: data.url }));
    } catch {
      // ignore
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkAction(action: string, extra?: Record<string, unknown>) {
    const ids = [...selected];
    if (!ids.length) return;
    const res = await fetch("/api/media/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, ids, ...extra }),
    });
    if (res.ok) {
      toast.success("Bulk action completed");
      setSelected(new Set());
      fetchPage(1, true);
    } else {
      toast.error("Bulk action failed");
    }
  }

  async function toggleFavorite(asset: LibraryAsset) {
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
            onClick={() => { setSelectMode((m) => !m); setSelected(new Set()); }}
          >
            {selectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            Select
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((f) => !f)}>
            <Filter className="h-4 w-4" /> Filters <ChevronDown className={cn("h-3 w-3 transition", showFilters && "rotate-180")} />
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <Select value={type} onChange={(e) => setType(e.target.value)} options={TYPE_OPTIONS} />
          <Select
            value={service}
            onChange={(e) => setService(e.target.value)}
            options={[{ value: "", label: "All services" }, ...DAM_SERVICE_FILTERS.map((s) => ({ value: s.value, label: s.label }))]}
          />
          <Select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            options={[{ value: "", label: "All property types" }, ...PROPERTY_TYPES.map((p) => ({ value: p, label: p }))]}
          />
          <Select value={projectStatus} onChange={(e) => setProjectStatus(e.target.value)} options={STATUS_OPTIONS} />
          <Select value={source} onChange={(e) => setSource(e.target.value)} options={SOURCE_OPTIONS} />
          <Select value={date} onChange={(e) => setDate(e.target.value)} options={DATE_OPTIONS} />
          <Select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            options={[
              { value: "", label: "All clients" },
              ...filterOptions.clients.map((c) => ({
                value: c.id,
                label: c.full_name || c.name,
              })),
            ]}
          />
          <Select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            options={[
              { value: "", label: "All properties" },
              ...filterOptions.properties.map((p) => ({
                value: p.id,
                label: p.nickname || p.address,
              })),
            ]}
          />
        </div>
      )}

      {selectMode && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button variant="outline" size="sm" onClick={() => bulkAction("favorite")}>
            <Star className="h-4 w-4" /> Star
          </Button>
          <Button variant="outline" size="sm" onClick={() => bulkAction("download_urls").then(async () => {
            const res = await fetch("/api/media/bulk", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ action: "download_urls", ids: [...selected] }),
            });
            const data = await res.json();
            data.urls?.forEach((u: { url: string; file_name: string }) => {
              const a = document.createElement("a");
              a.href = u.url;
              a.download = u.file_name;
              a.click();
            });
          })}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button variant="outline" size="sm" className="text-red-600" onClick={() => {
            if (confirm(`Delete ${selected.size} assets?`)) bulkAction("delete");
          }}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      )}

      <p className="text-xs text-muted">{total} assets</p>

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
              selected={selected.has(asset.id)}
              selectMode={selectMode}
              onSelect={() => toggleSelect(asset.id)}
              onOpen={() => setDrawerAsset(asset)}
              onFavorite={() => toggleFavorite(asset)}
            />
          ))}
        </div>
      )}

      <div ref={loaderRef} className="flex justify-center py-6">
        {loading && <Loader2 className="h-6 w-6 animate-spin text-muted" />}
      </div>

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
          onDeleted={() => {
            setAssets((prev) => prev.filter((a) => a.id !== drawerAsset.id));
            setDrawerAsset(null);
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
        "group relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md",
        selected ? "border-accent ring-2 ring-accent/30" : "border-border"
      )}
    >
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => (selectMode ? onSelect() : onOpen())}
      >
        <div className="relative aspect-[4/3] bg-slate-100">
          {thumbUrl ? (
            <RemoteImage src={thumbUrl} alt={asset.title} fill className="object-cover" sizes="200px" />
          ) : asset.thumbnail_url ? (
            <RemoteImage src={asset.thumbnail_url} alt={asset.title} fill className="object-cover" sizes="200px" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Icon className="h-10 w-10 text-muted" />
            </div>
          )}
          {asset.kind === "video" && (thumbUrl || asset.thumbnail_url) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow">
                <Play className="ml-0.5 h-5 w-5 text-slate-900" fill="currentColor" />
              </div>
            </div>
          )}
          {asset.is_cover && (
            <Badge className="absolute left-2 top-2 text-[10px] bg-accent text-white">Cover</Badge>
          )}
          {asset.is_favorite && (
            <Star className="absolute right-2 top-2 h-4 w-4 fill-amber-400 text-amber-400" />
          )}
        </div>
        <div className="p-2.5">
          <p className="truncate text-sm font-medium text-primary">{asset.title}</p>
          <p className="truncate text-xs text-muted">{asset.property_address}</p>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted">
            <span>{asset.client_name}</span>
            {asset.file_size ? <span>· {formatFileSize(asset.file_size)}</span> : null}
            {asset.width && asset.height ? <span>· {asset.width}×{asset.height}</span> : null}
          </div>
        </div>
      </button>
      {!selectMode && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 opacity-0 shadow transition group-hover:opacity-100"
        >
          <Star className={cn("h-3.5 w-3.5", asset.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted")} />
        </button>
      )}
    </div>
  );
}

function isVideoAsset(asset: LibraryAsset): boolean {
  if (asset.kind === "video") return true;
  const mime = asset.mime_type?.toLowerCase() ?? "";
  if (mime.startsWith("video/")) return true;
  const ext = asset.file_name?.split(".").pop()?.toLowerCase();
  return ext === "mp4" || ext === "mov" || ext === "m4v";
}

function AssetDrawer({
  asset, projects, onClose, onUpdate, onFavorite, onDeleted,
}: {
  asset: LibraryAsset;
  projects: { id: string; project_name: string; property_address: string }[];
  onClose: () => void;
  onUpdate: (a: LibraryAsset) => void;
  onFavorite: () => void;
  onDeleted: () => void;
}) {
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
    if (isVideoAsset(asset)) return;
    if (asset.kind !== "tour" && asset.media_source !== "youtube") {
      fetch(`/api/media/download/${asset.id}?thumb=1`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => { if (d.url) setPreviewUrl(d.url); });
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
      onUpdate({
        ...asset,
        ...form,
        tags,
        title: form.title,
        project_id: form.project_id || null,
        project_name: form.project_id
          ? projects.find((p) => p.id === form.project_id)?.project_name ?? asset.project_name
          : "Unassigned",
      });
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
    await fetch("/api/media/bulk", {
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
    toast.success("Set as project cover");
    onUpdate({ ...asset, is_cover: true });
  }

  async function handleDelete() {
    if (!confirm("Delete this asset permanently?")) return;
    await fetch(`/api/media/${asset.id}`, { method: "DELETE", credentials: "include" });
    onDeleted();
    toast.success("Deleted");
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl safe-area-x"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="truncate pr-2 font-semibold text-primary">{asset.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className={cn("flex-1 overflow-y-auto p-4 space-y-6", isPwaMobile && "admin-pwa-fixed-bottom-pad")}
        >
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
            {asset.kind === "tour" && asset.kuula_url ? (
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
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={asset.kind === "tour"}>
              <Download className="h-4 w-4" /> Download
            </Button>
            {asset.project_id && (
              <Link href={`/admin/projects/${asset.project_id}`}>
                <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> Open Project</Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={onFavorite}>
              <Star className={cn("h-4 w-4", asset.is_favorite && "fill-amber-400 text-amber-400")} />
            </Button>
            {asset.kind === "photo" && (
              <Button variant="outline" size="sm" onClick={setAsCover}>Set Cover</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
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
              <Button variant="accent" size="sm" disabled={saving} onClick={saveMetadata}>
                {saving ? "Saving..." : "Save Metadata"}
              </Button>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Client" value={asset.client_name} />
              <Meta label="Company" value={asset.client_company ?? "—"} />
              <Meta label="Property" value={asset.property_address} className="col-span-2" />
              <Meta label="Project" value={asset.project_name} />
              <Meta label="Service" value={asset.service_type} />
              <Meta label="Uploaded" value={formatDate(asset.created_at)} />
              <Meta label="Downloads" value={String(asset.download_count)} />
              {asset.file_size ? <Meta label="Size" value={formatFileSize(asset.file_size)} /> : null}
              {asset.width && asset.height ? <Meta label="Dimensions" value={`${asset.width}×${asset.height}`} /> : null}
              {asset.tags.length > 0 && (
                <div className="col-span-2 flex flex-wrap gap-1">
                  {asset.tags.map((t) => (
                    <Badge key={t} className="text-xs bg-slate-100"><Tag className="h-3 w-3" />{t}</Badge>
                  ))}
                </div>
              )}
            </dl>
          )}

          {detail && detail.downloads.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-primary mb-2">Download History</h3>
              <ul className="space-y-1 text-xs text-muted">
                {detail.downloads.map((d) => (
                  <li key={d.id}>{d.downloaded_by_email ?? "Unknown"} · {formatDate(d.created_at)}</li>
                ))}
              </ul>
            </section>
          )}

          {detail && detail.events.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-primary mb-2">Timeline</h3>
              <ul className="space-y-2 text-sm">
                {detail.events.map((e) => (
                  <li key={e.id} className="border-l-2 border-border pl-3">
                    <p className="text-primary">{e.description || e.event_type}</p>
                    <p className="text-xs text-muted">{formatDate(e.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 text-red-600"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" /> Delete Asset
          </Button>
        </div>
      </aside>
    </>
  );
}

function MediaDetailVideoPlayer({ asset }: { asset: LibraryAsset }) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    setLoading(true);
    setStreamUrl(null);
    setPosterUrl(null);

    async function load() {
      try {
        const [thumbRes, streamRes] = await Promise.all([
          fetch(`/api/media/download/${asset.id}?thumb=1`, { credentials: "include" }),
          fetch(`/api/media/download/${asset.id}?preview=1`, { credentials: "include" }),
        ]);
        if (cancelled) return;

        const thumbData = await thumbRes.json();
        const streamData = await streamRes.json();

        if (thumbData.url) setPosterUrl(thumbData.url);
        if (streamRes.ok && streamData.url) {
          setStreamUrl(streamData.url);
        } else {
          setLoadError(true);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (loadError || !streamUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted">
        <Video className="h-8 w-8 opacity-50" />
        <p>Video preview unavailable.</p>
      </div>
    );
  }

  return (
    <video
      key={streamUrl}
      src={streamUrl}
      poster={posterUrl ?? undefined}
      controls
      playsInline
      preload="metadata"
      className="h-full w-full bg-black object-contain"
      onError={() => setLoadError(true)}
    />
  );
}

function Meta({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium text-primary truncate">{value}</dd>
    </div>
  );
}
