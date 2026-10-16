"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ImageOff, Images, X } from "lucide-react";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { Button } from "@/components/ui/button";
import { ViewOnlyAccessChip } from "@/components/ui/view-only-access-chip";
import { DownloadQualityDialog } from "@/components/projects/download-quality-dialog";
import { DOWNLOAD_QUALITY_PARAM, type DownloadQuality } from "@/lib/download-quality";
import { cn } from "@/lib/utils";

function PhotoShareHeader({ children }: { children?: React.ReactNode }) {
  const brand = usePortalBrand();
  return (
    <header className="border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={brand.portalName} className="h-8 w-auto max-w-[160px] object-contain" />
        ) : (
          <span className="truncate font-semibold text-heading">{brand.portalName}</span>
        )}
        {children}
      </div>
    </header>
  );
}

export function PhotoShareViewer({ token, allowDownload }: { token: string; allowDownload: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const fileBase = `/api/public/photo/${encodeURIComponent(token)}`;

  function download(quality: DownloadQuality) {
    setQualityOpen(false);
    const a = document.createElement("a");
    a.href = `${fileBase}?variant=original&${DOWNLOAD_QUALITY_PARAM}=${quality}`;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PhotoShareHeader>
        {allowDownload && !failed ? (
          <Button size="sm" className="min-h-10 shrink-0" onClick={() => setQualityOpen(true)}>
            <Download className="h-4 w-4" /> Download
          </Button>
        ) : null}
      </PhotoShareHeader>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <ViewOnlyAccessChip className="self-start">
          {allowDownload ? "Shared photo" : "Shared photo · view only"}
        </ViewOnlyAccessChip>
        <div className="flex flex-1 items-center justify-center">
          <div
            className={cn(
              "relative flex items-center justify-center overflow-hidden rounded-xl border border-border bg-subtle",
              (!loaded || failed) && "min-h-[50dvh] w-full"
            )}
          >
            {failed ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <ImageOff className="h-8 w-8 text-muted" aria-hidden />
                <p className="font-medium text-heading">This photo isn&apos;t available</p>
                <p className="max-w-sm text-sm text-muted">
                  The link may have expired or been turned off. Ask the person who shared it for a new link.
                </p>
              </div>
            ) : (
              <>
                {!loaded ? (
                  <div className="absolute inset-0 animate-pulse bg-subtle" aria-hidden />
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${fileBase}?variant=preview`}
                  alt="Shared photo"
                  referrerPolicy="no-referrer"
                  className="relative block max-h-[calc(100dvh-10rem)] w-auto max-w-full object-contain"
                  onLoad={() => setLoaded(true)}
                  onError={() => setFailed(true)}
                />
              </>
            )}
          </div>
        </div>
      </main>

      {allowDownload ? (
        <DownloadQualityDialog
          open={qualityOpen}
          onClose={() => setQualityOpen(false)}
          title="Download photo"
          onConfirm={download}
        />
      ) : null}
    </div>
  );
}

export type SharedFolderPhoto = { id: string; width: number | null; height: number | null };

function photoCountText(count: number) {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

/** Anonymous gallery for a shared folder. Every image request is re-authorized against the folder. */
export function FolderShareViewer({
  token,
  folderName,
  photos,
  allowDownload,
}: {
  token: string;
  folderName: string;
  photos: SharedFolderPhoto[];
  allowDownload: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const fileBase = `/api/public/photo/${encodeURIComponent(token)}`;
  const fileUrl = (id: string, variant: "thumb" | "preview") =>
    `${fileBase}?variant=${variant}&photo=${encodeURIComponent(id)}`;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PhotoShareHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold text-heading">{folderName}</h1>
            <p className="text-sm text-muted">{photoCountText(photos.length)}</p>
          </div>
          <ViewOnlyAccessChip>{allowDownload ? "Shared folder" : "Shared folder · view only"}</ViewOnlyAccessChip>
        </div>

        {photos.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
            <Images className="h-8 w-8 text-muted" aria-hidden />
            <p className="font-medium text-heading">No photos here yet</p>
            <p className="max-w-sm text-sm text-muted">Photos added to this folder will appear here.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {photos.map((photo, i) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  aria-label={`Open photo ${i + 1} of ${photos.length}`}
                  className="relative block aspect-square w-full overflow-hidden rounded-lg border border-border bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {failedIds.has(photo.id) ? (
                    <span className="flex h-full w-full items-center justify-center text-muted">
                      <ImageOff className="h-6 w-6" aria-hidden />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fileUrl(photo.id, "thumb")}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={() => setFailedIds((prev) => new Set(prev).add(photo.id))}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {openIndex !== null && photos[openIndex] ? (
        <FolderShareLightbox
          photos={photos}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          previewUrl={(id) => fileUrl(id, "preview")}
          downloadBase={allowDownload ? fileBase : null}
        />
      ) : null}
    </div>
  );
}

function FolderShareLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  previewUrl,
  downloadBase,
}: {
  photos: SharedFolderPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  previewUrl: (id: string) => string;
  /** Null when the share is view-only. */
  downloadBase: string | null;
}) {
  const photo = photos[index];
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange]
  );

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
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

  function download(quality: DownloadQuality) {
    if (!downloadBase) return;
    setQualityOpen(false);
    const a = document.createElement("a");
    a.href = `${downloadBase}?variant=original&photo=${encodeURIComponent(photo.id)}&${DOWNLOAD_QUALITY_PARAM}=${quality}`;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const failed = failedId === photo.id;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <span className="text-sm tabular-nums text-white/80" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          {downloadBase && !failed ? (
            <Button size="sm" className="min-h-10" onClick={() => setQualityOpen(true)}>
              <Download className="h-4 w-4" /> Download
            </Button>
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

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {failed ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <ImageOff className="h-8 w-8 text-white/70" aria-hidden />
            <p className="font-medium">This photo isn&apos;t available</p>
            <p className="max-w-sm text-sm text-white/70">It may have been moved out of this folder or the link turned off.</p>
          </div>
        ) : (
          <>
            {loadedId !== photo.id ? <div className="absolute inset-8 animate-pulse rounded-lg bg-white/5" aria-hidden /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photo.id}
              src={previewUrl(photo.id)}
              alt={`Photo ${index + 1} of ${photos.length}`}
              referrerPolicy="no-referrer"
              className="relative block max-h-full max-w-full object-contain"
              onLoad={() => setLoadedId(photo.id)}
              onError={() => setFailedId(photo.id)}
            />
          </>
        )}

        {hasPrev ? (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}
        {hasNext ? (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        ) : null}
      </div>

      {downloadBase ? (
        <DownloadQualityDialog
          open={qualityOpen}
          onClose={() => setQualityOpen(false)}
          title="Download photo"
          onConfirm={download}
        />
      ) : null}
    </div>
  );
}

export function PhotoShareUnavailable({ rateLimitedSec }: { rateLimitedSec?: number }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PhotoShareHeader />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
          <ImageOff className="h-8 w-8 text-muted" aria-hidden />
          <h1 className="text-lg font-semibold text-heading">
            {rateLimitedSec ? "Too many requests" : "This photo isn't available"}
          </h1>
          <p className="text-sm text-muted">
            {rateLimitedSec
              ? `Please wait ${rateLimitedSec} seconds and try again.`
              : "The link may have expired, been turned off, or been typed incorrectly. Ask the person who shared it for a new link."}
          </p>
        </div>
      </main>
    </div>
  );
}
