"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Globe,
  ImageOff,
  Images,
  Loader2,
  Lock,
  Play,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewOnlyAccessChip } from "@/components/ui/view-only-access-chip";
import { DownloadQualityDialog } from "@/components/projects/download-quality-dialog";
import { PhotoShareHeader } from "@/components/photos/photo-share-viewer";
import { DOWNLOAD_QUALITY_PARAM, type DownloadQuality } from "@/lib/download-quality";
import { sharedItemUrl, type SharedMediaItem, type SharedMediaKind } from "@/lib/shared-media-types";
import { formatFileSize } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Anonymous viewers for /shared/{token}: a Media Library folder gallery, or one shared item
 * (video, file, 360° tour, 3D model). The token is the only credential. Every byte request
 * re-authorizes the item on the server; nothing about projects or clients is shown.
 */

const KIND_LABEL: Record<SharedMediaKind, string> = {
  photo: "Photo",
  video: "Video",
  document: "File",
  tour: "360° Tour",
  model: "3D Model",
};

function KindIcon({ kind, className }: { kind: SharedMediaKind; className?: string }) {
  const Icon = kind === "video" ? Video : kind === "document" ? FileText : kind === "tour" ? Globe : kind === "model" ? Box : Images;
  return <Icon className={className} aria-hidden />;
}

function countSummary(items: SharedMediaItem[]): string {
  const counts = new Map<SharedMediaKind, number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  const order: SharedMediaKind[] = ["photo", "video", "tour", "model", "document"];
  const plural: Record<SharedMediaKind, [string, string]> = {
    photo: ["photo", "photos"],
    video: ["video", "videos"],
    tour: ["360° tour", "360° tours"],
    model: ["3D model", "3D models"],
    document: ["file", "files"],
  };
  const parts = order
    .filter((k) => counts.get(k))
    .map((k) => `${counts.get(k)} ${plural[k][counts.get(k) === 1 ? 0 : 1]}`);
  return parts.join(" · ") || "Empty";
}

function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function formatDuration(sec: number | null): string | null {
  if (!sec || sec <= 0) return null;
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Tile({ token, item, onOpen }: { token: string; item: SharedMediaItem; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const thumb =
    item.kind === "photo" ? sharedItemUrl(token, item.key, "thumb") : item.kind === "video" && item.hasPoster ? sharedItemUrl(token, item.key, "poster") : null;
  const duration = item.kind === "video" ? formatDuration(item.durationSeconds) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${KIND_LABEL[item.kind].toLowerCase()}: ${item.title}`}
      className="group relative block w-full overflow-hidden rounded-xl border border-border bg-subtle text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-[4/3] w-full">
        {thumb && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted">
            {failed ? <ImageOff className="h-7 w-7" aria-hidden /> : <KindIcon kind={item.kind} className="h-8 w-8" />}
          </span>
        )}
        {item.kind === "video" ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow">
              <Play className="ml-0.5 h-5 w-5" aria-hidden />
            </span>
          </span>
        ) : null}
        {item.kind !== "photo" ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
            <KindIcon kind={item.kind} className="h-3 w-3" />
            {KIND_LABEL[item.kind]}
          </span>
        ) : null}
        {duration ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {duration}
          </span>
        ) : null}
      </div>
      {item.kind !== "photo" ? (
        <p className="truncate border-t border-border bg-card px-2.5 py-2 text-sm font-medium text-heading" title={item.title}>
          {item.title}
        </p>
      ) : null}
    </button>
  );
}

/** Video player that fetches a short-lived stream URL on demand. */
function SharedVideo({ token, item, autoPlay }: { token: string; item: SharedMediaItem; autoPlay?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const start = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(sharedItemUrl(token, item.key, "stream"), { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !json.url) throw new Error();
      setSrc(json.url);
      setState("idle");
    } catch {
      setState("error");
    }
  }, [token, item.key]);

  useEffect(() => {
    setSrc(null);
    setState("idle");
    if (autoPlay && !item.embedUrl) void start();
  }, [autoPlay, item.key, item.embedUrl, start]);

  if (item.embedUrl) {
    return (
      <iframe
        src={item.embedUrl}
        title={item.title}
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    );
  }
  if (src) {
    return (
      <video
        key={src}
        src={src}
        controls
        autoPlay
        playsInline
        preload="metadata"
        controlsList={item.canDownload ? undefined : "nodownload"}
        className="h-full w-full bg-black object-contain"
        onError={() => setState("error")}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => void start()}
      className="relative flex h-full w-full items-center justify-center bg-black"
      aria-label={`Play ${item.title}`}
    >
      {item.hasPoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sharedItemUrl(token, item.key, "poster")} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain opacity-80" />
      ) : null}
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
        {state === "loading" ? <Loader2 className="h-7 w-7 animate-spin" /> : <Play className="ml-1 h-7 w-7" />}
      </span>
      {state === "error" ? (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1.5 text-sm text-white">
          This video couldn&apos;t load. Try again.
        </span>
      ) : null}
    </button>
  );
}

function FileCard({ token, item }: { token: string; item: SharedMediaItem }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
        <FileText className="h-8 w-8" aria-hidden />
      </span>
      <div className="max-w-md space-y-1">
        <p className="break-words font-semibold text-heading">{item.title}</p>
        {item.fileSize ? <p className="text-sm text-muted">{formatFileSize(item.fileSize)}</p> : null}
      </div>
      {item.canDownload ? (
        <div className="flex flex-wrap justify-center gap-2">
          {item.isPdf ? (
            <a
              href={sharedItemUrl(token, item.key, "inline")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-heading hover:bg-subtle"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Open PDF
            </a>
          ) : null}
          <Button className="min-h-11" onClick={() => triggerDownload(sharedItemUrl(token, item.key, "original"))}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      ) : (
        <p className="flex max-w-sm items-start gap-2 rounded-lg border border-border bg-subtle px-3 py-2 text-left text-sm text-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {item.downloadLocked
            ? "This file will be available once the shoot is finalized."
            : "This file is shared view-only. Ask the sender for download access."}
        </p>
      )}
    </div>
  );
}

/** Large view of one item (lightbox body or single-item page). */
function ItemStage({ token, item, dark }: { token: string; item: SharedMediaItem; dark?: boolean }) {
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  if (item.kind === "photo") {
    if (failedKey === item.key) {
      return (
        <div className={cn("flex flex-col items-center gap-2 p-8 text-center", dark ? "text-white" : "text-heading")}>
          <ImageOff className="h-8 w-8 opacity-70" aria-hidden />
          <p className="font-medium">This photo isn&apos;t available</p>
          <p className="max-w-sm text-sm opacity-70">It may have been removed from this folder or the link turned off.</p>
        </div>
      );
    }
    return (
      <>
        {loadedKey !== item.key ? <div className="absolute inset-8 animate-pulse rounded-lg bg-white/5" aria-hidden /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={item.key}
          src={sharedItemUrl(token, item.key, "preview")}
          alt={item.title}
          referrerPolicy="no-referrer"
          className="relative block max-h-full max-w-full object-contain"
          onLoad={() => setLoadedKey(item.key)}
          onError={() => setFailedKey(item.key)}
        />
      </>
    );
  }
  const frame = "relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl bg-black";
  if (item.kind === "video") {
    return (
      <div className={frame}>
        <SharedVideo token={token} item={item} autoPlay={dark} />
      </div>
    );
  }
  if (item.kind === "tour" || item.kind === "model") {
    return (
      <div className={cn(frame, "max-h-full")}>
        <iframe
          src={item.embedUrl ?? undefined}
          title={item.title}
          className="h-full w-full"
          allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
          allowFullScreen
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    );
  }
  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card">
      <FileCard token={token} item={item} />
    </div>
  );
}

function Lightbox({
  token,
  items,
  index,
  onIndexChange,
  onClose,
}: {
  token: string;
  items: SharedMediaItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const [qualityOpen, setQualityOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < items.length) onIndexChange(next);
    },
    [index, items.length, onIndexChange]
  );

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (qualityOpen) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, qualityOpen]);

  // Swipe between photos only — videos, tours and 3D models need horizontal drags themselves.
  const swipeable = item.kind === "photo";

  function download(quality?: DownloadQuality) {
    setQualityOpen(false);
    const base = sharedItemUrl(token, item.key, "original");
    triggerDownload(quality ? `${base}&${DOWNLOAD_QUALITY_PARAM}=${quality}` : base);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} (${index + 1} of ${items.length})`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={item.title}>
            {item.title}
          </p>
          <p className="text-xs tabular-nums text-white/70" aria-live="polite">
            {index + 1} / {items.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.canDownload && item.kind !== "document" ? (
            <Button size="sm" className="min-h-10" onClick={() => (item.kind === "photo" ? setQualityOpen(true) : download())}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
            </Button>
          ) : item.downloadLocked ? (
            <span className="hidden items-center gap-1 text-xs text-white/70 sm:inline-flex">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Download not available yet
            </span>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-14"
        onTouchStart={(e) => {
          if (swipeable) touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (!swipeable || touchX.current === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        <ItemStage token={token} item={item} dark />
        {index > 0 ? (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}
        {index < items.length - 1 ? (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        ) : null}
      </div>

      {item.kind === "photo" && item.canDownload ? (
        <DownloadQualityDialog open={qualityOpen} onClose={() => setQualityOpen(false)} title="Download photo" onConfirm={download} />
      ) : null}
    </div>
  );
}

const FILTERS: { value: "all" | SharedMediaKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "tour", label: "360° Tours" },
  { value: "model", label: "3D Models" },
  { value: "document", label: "Files" },
];

/** Gallery for a shared Media Library folder. */
export function LibraryFolderShareViewer({
  token,
  folderName,
  items,
  allowDownload,
  truncated,
}: {
  token: string;
  folderName: string;
  items: SharedMediaItem[];
  allowDownload: boolean;
  truncated: boolean;
}) {
  const [filter, setFilter] = useState<"all" | SharedMediaKind>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const kinds = useMemo(() => new Set(items.map((i) => i.kind)), [items]);
  const visible = useMemo(() => (filter === "all" ? items : items.filter((i) => i.kind === filter)), [items, filter]);
  const openIndex = openKey ? visible.findIndex((i) => i.key === openKey) : -1;
  const lockedCount = allowDownload ? items.filter((i) => i.downloadLocked).length : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PhotoShareHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-heading">{folderName}</h1>
            <p className="mt-0.5 text-sm text-muted">{countSummary(items)}</p>
          </div>
          <ViewOnlyAccessChip>{allowDownload ? "Shared folder" : "Shared folder · view only"}</ViewOnlyAccessChip>
        </div>

        {kinds.size > 1 ? (
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <div role="tablist" aria-label="Filter by type" className="inline-flex gap-1.5">
              {FILTERS.filter((f) => f.value === "all" || kinds.has(f.value)).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    filter === f.value ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-heading hover:bg-subtle"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {lockedCount > 0 ? (
          <p className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {lockedCount === 1 ? "1 item" : `${lockedCount} items`} can be viewed now and downloaded once the shoot is finalized.
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
            <Images className="h-8 w-8 text-muted" aria-hidden />
            <p className="font-medium text-heading">Nothing here yet</p>
            <p className="max-w-sm text-sm text-muted">Media added to this folder will appear here.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {visible.map((item) => (
              <li key={item.key} className="min-w-0">
                <Tile token={token} item={item} onOpen={() => setOpenKey(item.key)} />
              </li>
            ))}
          </ul>
        )}
        {truncated ? (
          <p className="text-center text-xs text-muted">Showing the {items.length.toLocaleString()} most recently added items.</p>
        ) : null}
      </main>

      {openIndex >= 0 ? (
        <Lightbox
          token={token}
          items={visible}
          index={openIndex}
          onIndexChange={(i) => setOpenKey(visible[i]?.key ?? null)}
          onClose={() => setOpenKey(null)}
        />
      ) : null}
    </div>
  );
}

/** Landing page for one shared video / file / 360° tour / 3D model. */
export function SharedItemViewer({ token, item }: { token: string; item: SharedMediaItem }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PhotoShareHeader>
        {item.canDownload && item.kind === "video" ? (
          <Button size="sm" className="min-h-10 shrink-0" onClick={() => triggerDownload(sharedItemUrl(token, item.key, "original"))}>
            <Download className="h-4 w-4" /> Download
          </Button>
        ) : null}
      </PhotoShareHeader>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="min-w-0 break-words text-lg font-semibold text-heading">{item.title}</h1>
          <ViewOnlyAccessChip>
            {`Shared ${KIND_LABEL[item.kind].toLowerCase()}`}
            {item.hasFile && !item.canDownload ? " · view only" : ""}
          </ViewOnlyAccessChip>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <ItemStage token={token} item={item} />
        </div>
      </main>
    </div>
  );
}
