"use client";

import { VideoOff } from "lucide-react";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { PublicVideoPlayer, type PublicVideoSourceState } from "@/components/video-share/public-video-player";
import { aspectPaddingPercent, DEFAULT_EMBED_OPTIONS } from "@/lib/video-embed-options";

function WatchHeader({ logoUrl }: { logoUrl: string | null }) {
  const brand = usePortalBrand();
  const inner = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={brand.name} className="h-8 w-auto max-w-[180px] object-contain" />
  ) : (
    <span className="truncate font-semibold text-heading">{brand.name}</span>
  );
  return (
    <header className="border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        {brand.websiteUrl ? (
          <a href={brand.websiteUrl} target="_blank" rel="noopener" className="min-w-0">
            {inner}
          </a>
        ) : (
          inner
        )}
      </div>
    </header>
  );
}

function WatchFooter() {
  return (
    <footer className="px-4 py-6 text-center text-xs text-muted">
      Video hosted with{" "}
      <a href="https://www.shootportal.app" target="_blank" rel="noopener" className="font-medium hover:underline">
        ShootPortal
      </a>
    </footer>
  );
}

export function PublicVideoWatch({
  publicId,
  apiBase,
  initialSource,
  title,
  width,
  height,
  customLogoUrl,
}: {
  publicId: string;
  apiBase: string;
  initialSource: PublicVideoSourceState | null;
  title: string;
  width: number | null;
  height: number | null;
  customLogoUrl: string | null;
}) {
  const brand = usePortalBrand();
  const pad = aspectPaddingPercent(width, height);
  // Portrait videos would push the title off-screen; cap the frame height instead.
  const portrait = pad > 100;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <WatchHeader logoUrl={customLogoUrl} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-0 py-0 sm:px-6 sm:py-6">
        <div
          className={
            portrait
              ? "mx-auto h-[min(80dvh,900px)] overflow-hidden bg-black sm:rounded-xl"
              : "relative w-full overflow-hidden bg-black shadow-lg sm:rounded-xl"
          }
          style={portrait ? { aspectRatio: `${width} / ${height}`, maxWidth: "100%" } : { paddingTop: `${pad}%` }}
        >
          <div className={portrait ? "h-full w-full" : "absolute inset-0"}>
            <PublicVideoPlayer
              publicId={publicId}
              apiBase={apiBase}
              initialSource={initialSource}
              title={title}
              options={{ ...DEFAULT_EMBED_OPTIONS, title: false, branding: false }}
            />
          </div>
        </div>
        <div className="px-4 pt-4 sm:px-0">
          <h1 className="text-lg font-semibold leading-snug text-heading sm:text-xl">{title}</h1>
          <p className="mt-1 text-sm text-muted">Shared by {brand.name}</p>
        </div>
      </main>
      <WatchFooter />
    </div>
  );
}

export function PublicVideoWatchUnavailable({ rateLimitedSec }: { rateLimitedSec?: number }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <VideoOff className="mx-auto h-8 w-8 text-muted" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-heading">
            {rateLimitedSec ? "Too many requests" : "This video isn't available"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {rateLimitedSec
              ? `Please try again in ${rateLimitedSec} seconds.`
              : "The link may be incorrect, or the video is no longer shared."}
          </p>
        </div>
      </main>
      <WatchFooter />
    </div>
  );
}
