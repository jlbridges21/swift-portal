"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaAsset } from "@/lib/types";
import { toast } from "sonner";

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
          fullUrls={fullUrls}
          loadFull={loadFull}
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
      onMouseEnter={onLoadThumb}
      onFocus={onLoadThumb}
      onClick={() => { onLoadThumb(); onClick(); }}
      className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-lg hover:ring-accent/30"
    >
      {thumbUrl ? (
        <>
          <Image
            src={thumbUrl}
            alt={photo.file_name}
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
  photos, currentIndex, fullUrls, loadFull, onClose, onNavigate, downloadsAllowed = true,
}: {
  photos: MediaAsset[];
  currentIndex: number;
  fullUrls: Record<string, string>;
  loadFull: (a: MediaAsset) => Promise<string | null>;
  onClose: () => void;
  onNavigate: (i: number) => void;
  downloadsAllowed?: boolean;
}) {
  const photo = photos[currentIndex];
  const [url, setUrl] = useState(fullUrls[photo.id]);
  const [loading, setLoading] = useState(!fullUrls[photo.id]);

  if (!url && loading) {
    loadFull(photo).then((u) => {
      setLoading(false);
      if (u) setUrl(u);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 safe-area-x">
      <button onClick={onClose} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20">
        <X className="h-6 w-6" />
      </button>
      {currentIndex > 0 && (
        <button onClick={() => onNavigate(currentIndex - 1)} className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20">
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {currentIndex < photos.length - 1 && (
        <button onClick={() => onNavigate(currentIndex + 1)} className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-16">
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <div className="relative h-[min(80dvh,80vh)] w-[min(92vw,100%)] max-w-6xl px-2">
        {url ? (
          <Image src={url} alt={photo.file_name} fill className="object-contain" sizes="92vw" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/60">Loading preview…</div>
        )}
      </div>
      <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-wrap items-center justify-center gap-4 px-4">
        <span className="text-sm text-white/70">{currentIndex + 1} / {photos.length}</span>
        {!downloadsAllowed && (
          <span className="text-xs text-white/50">Preview only</span>
        )}
        {downloadsAllowed && url && (
          <Button variant="outline" size="sm" onClick={async () => {
            const u = await loadFull(photo);
            if (!u) return;
            const a = window.document.createElement("a");
            a.href = u;
            a.download = photo.file_name;
            a.click();
          }} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            <Download className="h-4 w-4" /> Download
          </Button>
        )}
      </div>
    </div>
  );
}
