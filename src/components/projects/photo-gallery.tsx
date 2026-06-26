"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaAsset } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  photos: MediaAsset[];
  getDownloadUrl: (asset: MediaAsset, thumb?: boolean) => Promise<string | null>;
  downloadsAllowed?: boolean;
}

export function PhotoGallery({ photos, getDownloadUrl, downloadsAllowed = true }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

  async function loadThumb(asset: MediaAsset) {
    if (thumbUrls[asset.id] || loadErrors[asset.id]) return;
    try {
      const url = await getDownloadUrl(asset, true);
      if (url) setThumbUrls((prev) => ({ ...prev, [asset.id]: url }));
    } catch {
      setLoadErrors((prev) => ({ ...prev, [asset.id]: true }));
    }
  }

  async function loadFull(asset: MediaAsset): Promise<string | null> {
    if (fullUrls[asset.id]) return fullUrls[asset.id];
    try {
      const url = await getDownloadUrl(asset, false);
      if (url) {
        setFullUrls((prev) => ({ ...prev, [asset.id]: url }));
        return url;
      }
    } catch {
      toast.error(`Couldn't load ${asset.file_name}`);
    }
    return null;
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-slate-50 py-16 text-center">
        <p className="text-sm text-muted">Photos will appear here once your shoot is complete.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
        {photos.map((photo, index) => (
          <PhotoThumbnail
            key={`gallery-${photo.project_id}-${photo.id}-${index}`}
            photo={photo}
            thumbUrl={thumbUrls[photo.id]}
            failed={loadErrors[photo.id]}
            onLoadThumb={() => loadThumb(photo)}
            onClick={async () => {
              const url = await loadFull(photo);
              if (url) setLightboxIndex(index);
            }}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={lightboxIndex}
          thumbUrls={thumbUrls}
          fullUrls={fullUrls}
          loadFull={loadFull}
          loadThumb={loadThumb}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          downloadsAllowed={downloadsAllowed}
        />
      )}
    </>
  );
}

function PhotoThumbnail({
  photo, thumbUrl, failed, onLoadThumb, onClick,
}: {
  photo: MediaAsset;
  thumbUrl?: string;
  failed?: boolean;
  onLoadThumb: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onLoadThumb}
      onFocus={onLoadThumb}
      onClick={() => { onLoadThumb(); onClick(); }}
      className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-lg hover:ring-accent/30"
    >
      {thumbUrl ? (
        <>
          <Image
            src={thumbUrl}
            alt={photo.alt_text || photo.title || photo.file_name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 25vw"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
            <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
          </div>
        </>
      ) : failed ? (
        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted">
          Preview unavailable
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted animate-pulse">
          Loading…
        </div>
      )}
    </button>
  );
}

function Lightbox({
  photos, currentIndex, thumbUrls, fullUrls, loadFull, loadThumb, onClose, onNavigate, downloadsAllowed = true,
}: {
  photos: MediaAsset[];
  currentIndex: number;
  thumbUrls: Record<string, string>;
  fullUrls: Record<string, string>;
  loadFull: (a: MediaAsset) => Promise<string | null>;
  loadThumb: (a: MediaAsset) => void;
  onClose: () => void;
  onNavigate: (i: number) => void;
  downloadsAllowed?: boolean;
}) {
  const photo = photos[currentIndex];
  const [url, setUrl] = useState<string | undefined>(fullUrls[photo.id]);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate]);

  useEffect(() => {
    setZoom(1);
    const p = photos[currentIndex];
    if (fullUrls[p.id]) {
      setUrl(fullUrls[p.id]);
    } else {
      setUrl(undefined);
      loadFull(p).then((u) => { if (u) setUrl(u); });
    }
  }, [currentIndex, photos, fullUrls, loadFull]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, z + 0.25));
      if (e.key === "-") setZoom((z) => Math.max(1, z - 0.25));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    photos.forEach((p) => loadThumb(p));
  }, [photos, loadThumb]);

  async function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 safe-area-x">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-white/70 truncate max-w-[50%]">
          {photo.title || photo.file_name}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">−</button>
          <span className="text-xs text-white/60 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">+</button>
          <button type="button" onClick={toggleFullscreen} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden px-12">
        {currentIndex > 0 && (
          <button type="button" onClick={goPrev} className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button type="button" onClick={goNext} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
        <div
          className="relative h-full w-full max-w-6xl transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        >
          {url ? (
            <Image src={url} alt={photo.alt_text || photo.file_name} fill className="object-contain" sizes="92vw" priority />
          ) : (
            <div className="flex h-full items-center justify-center text-white/60">Loading preview…</div>
          )}
        </div>
      </div>

      {/* Filmstrip */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-t border-white/10">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onNavigate(i)}
            className={cn(
              "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition",
              i === currentIndex ? "ring-white" : "ring-transparent opacity-60 hover:opacity-100"
            )}
          >
            {thumbUrls[p.id] ? (
              <Image src={thumbUrls[p.id]} alt="" fill className="object-cover" sizes="80px" />
            ) : (
              <div className="h-full w-full bg-white/10" />
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span className="text-sm text-white/70">{currentIndex + 1} / {photos.length}</span>
        {!downloadsAllowed && <span className="text-xs text-white/50">Preview only</span>}
        {downloadsAllowed && url && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const u = await loadFull(photo);
              if (!u) return;
              const a = document.createElement("a");
              a.href = `/api/media/download/${photo.id}?file=1`;
              a.download = photo.file_name;
              a.click();
            }}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        )}
      </div>
    </div>
  );
}
