"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, Rotate3d } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interactive 360 tour viewer shared by the client portal, published property websites and
 * portfolio sites. `embedUrl` comes from resolveTourEmbedUrl (server); null means the provider
 * doesn't allow embedding, so a clean "Open 360 Tour" link is shown instead.
 *
 * The iframe loads lazily and never takes focus on its own, so the page doesn't jump to it.
 */
export function TourViewer({
  title,
  url,
  embedUrl,
  thumbnailUrl,
  className,
  showOpenLink = true,
}: {
  title: string;
  url: string;
  embedUrl: string | null;
  thumbnailUrl?: string | null;
  className?: string;
  /** Small "Open in new tab" link under the frame. */
  showOpenLink?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  useEffect(() => {
    setCanFullscreen(typeof document !== "undefined" && Boolean(document.fullscreenEnabled));
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen?.().catch(() => {});
  }

  if (!embedUrl) {
    return (
      <div className={cn("relative aspect-video w-full overflow-hidden bg-slate-900", className)}>
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        ) : null}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-transform group-hover:scale-105">
            <Rotate3d className="h-4 w-4" /> Open 360 Tour <ExternalLink className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs text-white/70">This tour opens on the provider&apos;s site</span>
        </a>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={wrapRef}
        className={cn(
          "relative w-full overflow-hidden bg-slate-900",
          fullscreen ? "h-full" : "aspect-[4/3] sm:aspect-video",
          className
        )}
      >
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer; autoplay"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {canFullscreen ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit full screen" : "View full screen"}
            title={fullscreen ? "Exit full screen" : "Full screen"}
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {showOpenLink ? (
        <div className="mt-2 flex justify-end">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium opacity-70 hover:underline hover:opacity-100"
          >
            Open in new tab <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
