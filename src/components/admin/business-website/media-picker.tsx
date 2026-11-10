"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  title,
  selectedId,
  onSelect,
  onClose,
}: {
  kind: "photo" | "video";
  /** Heading for this use (hero image, About photo…). */
  title?: string;
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

  if (typeof document === "undefined") return null;

  // Portaled to <body>: page containers (the settings editor shell, sticky header) can't stack
  // over it or clip its top edge.
  return createPortal(
    <Modal
      open
      onClose={onClose}
      title={title ?? (kind === "photo" ? "Choose a photo" : "Choose a video")}
      className="max-w-5xl sm:rounded-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">Only the {kind === "photo" ? "photo" : "video"} you choose appears on your website.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="accent" disabled={!picked || !items.some((i) => i.id === picked)} onClick={choose}>
              <Check className="h-4 w-4" /> Use this {kind === "photo" ? "photo" : "video"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={kind === "photo" ? "Search by project, client or file name" : "Search your videos"}
            className="h-11 rounded-full bg-subtle pl-10 surface-dark:bg-subtle"
            aria-label="Search media"
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {!loading && !items.length && !error ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted">
            {query ? "Nothing matches that search." : kind === "photo" ? "No photos in ShootPortal yet. Upload project photos in Media first." : "No videos in ShootPortal yet."}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
                onDoubleClick={() => {
                  setPicked(a.id);
                  const youtubeId = a.media_source === "youtube" ? extractYouTubeId(a.youtube_url || a.embed_url || "") ?? "" : "";
                  if (ok) onSelect({ id: a.id, source: youtubeId ? "youtube" : "upload", youtubeId });
                }}
                aria-pressed={on}
                title={a.title || undefined}
                className={cn("group text-left outline-none", !ok && "cursor-not-allowed opacity-40")}
              >
                <div
                  className={cn(
                    "relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 ring-offset-2 transition surface-dark:bg-subtle",
                    on ? "ring-2 ring-accent" : "ring-1 ring-black/5 group-hover:ring-black/15 group-focus-visible:ring-2 group-focus-visible:ring-accent/60"
                  )}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
                  ) : (
                    <ImageIcon className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-muted" />
                  )}
                  {kind === "video" ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      <Play className="h-2.5 w-2.5 fill-current" /> {a.media_source === "youtube" ? "YouTube" : "Video"}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
                      on ? "border-accent bg-accent text-white" : "border-white/90 bg-black/20 text-transparent opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-1.5 truncate px-0.5 text-xs text-muted">{a.project_name || a.title || "Untitled"}</p>
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
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void load(page + 1, false)}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>,
    document.body
  );
}
