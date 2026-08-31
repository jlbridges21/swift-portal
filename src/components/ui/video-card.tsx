"use client";

import { Play } from "lucide-react";
import { VideoPosterSurface } from "@/components/ui/video-poster-surface";
import { mediaDisplayName } from "@/lib/media-display-name";
import type { MediaAsset } from "@/lib/types";
import { videoDurationBadge } from "@/lib/video-duration";
import { cn } from "@/lib/utils";

type VideoCardProps = {
  video: MediaAsset;
  thumbUrl?: string | null;
  onClick: () => void;
  className?: string;
  titleClassName?: string;
};

/** YouTube-style video tile: 16:9 poster, centered play, duration badge, title below. */
export function VideoCard({
  video,
  thumbUrl,
  onClick,
  className,
  titleClassName,
}: VideoCardProps) {
  const duration = videoDurationBadge(video);
  const title = mediaDisplayName(video);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("group w-full text-left focus-visible:outline-none", className)}
      aria-label={`Play ${title}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900 ring-1 ring-black/5 transition group-hover:ring-black/10">
        <VideoPosterSurface
          asset={video}
          thumbUrl={thumbUrl}
          className="absolute inset-0"
          imageClassName="transition duration-300 group-hover:scale-[1.02]"
        />
        <div className="pointer-events-none absolute inset-0 bg-black/10 transition group-hover:bg-black/25" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 shadow-lg ring-2 ring-white/20 transition group-hover:scale-105 group-hover:bg-red-600 sm:h-14 sm:w-14">
            <Play className="ml-0.5 h-5 w-5 text-white sm:h-6 sm:w-6" fill="currentColor" />
          </div>
        </div>
        {duration ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white bg-black/85">
            {duration}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 line-clamp-2 text-sm font-medium leading-snug text-primary group-hover:text-accent",
          titleClassName
        )}
      >
        {title}
      </p>
    </button>
  );
}

/** Larger cards than photo tiles — two-up on mobile, two on large, three on xl. */
export const VIDEO_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3";
