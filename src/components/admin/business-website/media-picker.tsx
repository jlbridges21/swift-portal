"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { extractYouTubeId, getYouTubeThumbnail } from "@/lib/youtube";
import type { WebsiteHeroMedia } from "@/lib/website/settings";

type LibraryItem = {
  id: string;
  kind: "photo" | "video" | string;
  title: string;
  project_name: string;
  media_source: string;
  youtube_url: string | null;
  embed_url: string | null;
  has_file: boolean;
};

const PAGE = 48;

/**
 * Pick a photo or video already in ShootPortal (Media library) for the website hero. Uses the
 * existing library and thumbnail APIs, filtered to one media type.
 */
export function MediaPickerModal({
  kind,
  selectedId,
  onSelect,
  onClose,
}: {
  kind: "photo" | "video";
  selectedId: string | null;
  onSelect: (media: WebsiteHeroMedia) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(selectedId);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ type: kind, page: String(nextPage), limit: String(PAGE) });
        if (query) qs.set("q", query);
        const res = await fetch(`/api/media/library?${qs}`, { credentials: "include" });
        const data = (await res.json()) as { assets?: LibraryItem[]; hasMore?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error || "Could not load your media.");
        if (id !== reqId.current) return;
        const assets = (data.assets ?? []).filter((a) => a.kind === kind);
        setItems((prev) => (replace ? assets : [...prev, ...assets]));
        setHasMore(Boolean(data.hasMore));
        setPage(nextPage);
        const needThumbs = assets.filter((a) => a.media_source !== "youtube").map((a) => a.id);
        if (needThumbs.length) {
          const t = await fetch("/api/media/thumbnails", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: needThumbs }),
          });
          const tj = (await t.json().catch(() => ({}))) as { urls?: Record<string, string | null> };
          if (id === reqId.current && tj.urls) setThumbs((prev) => ({ ...prev, ...tj.urls }));
        }
      } catch (e) {
        if (id === reqId.current) setError(e instanceof Error ? e.message : "Could not load your media.");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [kind, query]
  );

  useEffect(() => {
    void load(1, true);
  }, [load]);

  const thumbFor = (a: LibraryItem) =>
    a.media_source === "youtube" ? getYouTubeThumbnail(a.youtube_url || a.embed_url || "") : thumbs[a.id] ?? null;

  const choose = () => {
    const a = items.find((i) => i.id === picked);
    if (!a) return;
    const youtubeId = a.media_source === "youtube" ? extractYouTubeId(a.youtube_url || a.embed_url || "") ?? "" : "";
    onSelect({ id: a.id, source: youtubeId ? "youtube" : "upload", youtubeId });
  };

  // Videos must be playable: an uploaded file or a YouTube video.
  const usable = (a: LibraryItem) => kind === "photo" || a.has_file || a.media_source === "youtube";

  return (
    <Modal
      open
      onClose={onClose}
      title={kind === "photo" ? "Select hero image" : "Select hero video"}
      className="max-w-4xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">Only the item you choose is shown on your website.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="accent" disabled={!picked || !items.some((i) => i.id === picked)} onClick={choose}>
              <Check className="h-4 w-4" /> Use this {kind === "photo" ? "image" : "video"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={kind === "photo" ? "Search your photos by project, client or title" : "Search your videos"}
            className="pl-9"
            aria-label="Search media"
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {!loading && !items.length && !error ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
            {query ? "Nothing matches that search." : kind === "photo" ? "No photos in ShootPortal yet. Upload project photos in Media first." : "No videos in ShootPortal yet."}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((a) => {
            const thumb = thumbFor(a);
            const ok = usable(a);
            const on = picked === a.id;
            return (
              <button
                key={a.id}
                type="button"
                disabled={!ok}
                onClick={() => setPicked(a.id)}
                aria-pressed={on}
                className={cn(
                  "group overflow-hidden rounded-lg border text-left transition",
                  on ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-heading/30",
                  !ok && "cursor-not-allowed opacity-40"
                )}
              >
                <div className="relative aspect-[4/3] bg-slate-100 surface-dark:bg-subtle">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ImageIcon className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-muted" />
                  )}
                  {kind === "video" ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                      <Play className="h-2.5 w-2.5 fill-current" /> {a.media_source === "youtube" ? "YouTube" : "Video"}
                    </span>
                  ) : null}
                  {on ? (
                    <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-heading">{a.title || "Untitled"}</p>
                  <p className="truncate text-[11px] text-muted">{a.project_name}</p>
                </div>
              </button>
            );
          })}
        </div>
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your media…
          </p>
        ) : hasMore ? (
          <div className="flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={() => void load(page + 1, false)}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
