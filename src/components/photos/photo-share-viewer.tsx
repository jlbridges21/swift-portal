"use client";

import { useState } from "react";
import { Download, ImageOff } from "lucide-react";
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
