"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Download, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeAreaCloseButton } from "@/components/ui/safe-area-close-button";
import type { MediaAsset } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExpandableMediaList } from "@/components/projects/expandable-media-list";

interface PhotoGalleryProps {
  photos: MediaAsset[];
  getDownloadUrl: (asset: MediaAsset, thumb?: boolean) => Promise<string | null>;
  downloadsAllowed?: boolean;
  /** When set, only show this many photos until expanded (default: show all). */
  compactInitialCount?: number;
}

export function PhotoGallery({
  photos,
  getDownloadUrl,
  downloadsAllowed = true,
  compactInitialCount,
}: PhotoGalleryProps) {
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

  const grid = (
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
  );

  return (
    <>
      {compactInitialCount != null && photos.length > compactInitialCount ? (
        <ExpandableMediaList
          items={photos}
          initialCount={compactInitialCount}
          labelSingular="photo"
          labelPlural="photos"
          listClassName="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3"
          viewAllLabel={(n) => `View all ${n} photos`}
          renderItem={(photo, index) => (
            <PhotoThumbnail
              key={`compact-${photo.id}`}
              photo={photo}
              thumbUrl={thumbUrls[photo.id]}
              failed={loadErrors[photo.id]}
              onLoadThumb={() => loadThumb(photo)}
              onClick={async () => {
                const url = await loadFull(photo);
                if (url) setLightboxIndex(index);
              }}
              className="w-full"
            />
          )}
        />
      ) : (
        grid
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
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
  photo, thumbUrl, failed, onLoadThumb, onClick, className,
}: {
  photo: MediaAsset;
  thumbUrl?: string;
  failed?: boolean;
  onLoadThumb: () => void;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onLoadThumb}
      onFocus={onLoadThumb}
      onClick={() => { onLoadThumb(); onClick(); }}
      className={cn(
        "group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-lg hover:ring-accent/30",
        className
      )}
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

function PhotoLightbox({
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
  const [scale, setScale] = useState(1);
  const [dragY, setDragY] = useState(0);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTap = useRef(0);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setScale(1);
    setDragY(0);
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
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    photos.forEach((p) => loadThumb(p));
  }, [photos, loadThumb]);

  function onTouchStart(e: React.TouchEvent) {
    if (scale > 1) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStart.current || scale > 1) return;
    const t = e.touches[0];
    const dy = t.clientY - touchStart.current.y;
    if (dy > 0) setDragY(dy);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;

    if (scale === 1 && dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      touchStart.current = null;
      return;
    }

    if (scale === 1 && dt < 300 && Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }

    const now = Date.now();
    if (now - lastTap.current < 300) {
      setScale((s) => (s > 1 ? 1 : 2));
    }
    lastTap.current = now;

    setDragY(0);
    touchStart.current = null;
  }

  const dismissOpacity = Math.max(0.3, 1 - dragY / 280);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black"
      style={{
        opacity: dismissOpacity,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <SafeAreaCloseButton onClick={onClose} />

      <div
        className="flex items-center justify-between gap-3 px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        <span className="min-w-0 truncate text-sm text-white/80 pr-14">
          {photo.title || photo.file_name}
        </span>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 sm:px-12">
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 z-10 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-4"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 z-10 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-4"
            aria-label="Next photo"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
        <div
          className="relative h-full w-full max-w-6xl transition-transform duration-200"
          style={{ transform: `translateY(${dragY}px) scale(${scale})` }}
        >
          {url ? (
            <Image src={url} alt={photo.alt_text || photo.file_name} fill className="object-contain" sizes="100vw" priority />
          ) : (
            <div className="flex h-full items-center justify-center text-white/60">Loading…</div>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-3">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onNavigate(i)}
            className={cn(
              "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition min-h-11",
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

      <div className="flex flex-wrap items-center justify-center gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <span className="text-sm text-white/70">{currentIndex + 1} / {photos.length}</span>
        {!downloadsAllowed && <span className="text-xs text-white/50">Preview only</span>}
        {downloadsAllowed && url && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 border-white/20 bg-white/10 text-white hover:bg-white/20"
            onClick={() => {
              const a = document.createElement("a");
              a.href = `/api/media/download/${photo.id}?file=1`;
              a.download = photo.file_name;
              a.click();
            }}
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        )}
      </div>
    </div>
  );
}
