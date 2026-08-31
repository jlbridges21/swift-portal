"use client";

import { useEffect, useState } from "react";
import { VideoMediaPlaceholder } from "@/components/ui/video-media-placeholder";
import { RemoteImage } from "@/components/ui/remote-image";
import {
  getYouTubePosterUrl,
  isVideoMediaAsset,
} from "@/lib/media-preview";
import { mediaDisplayName } from "@/lib/media-display-name";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type VideoPosterProps = {
  asset: Pick<
    MediaAsset,
    "id" | "media_type" | "media_source" | "embed_url" | "file_name" | "title" | "thumbnail_url"
  >;
  /** Pre-resolved signed URL (batch loader). */
  thumbUrl?: string | null;
  /** Fetch ?thumb=1 when thumbUrl not supplied. */
  fetchThumb?: (asset: MediaAsset, thumb?: boolean) => Promise<string | null>;
  compact?: boolean;
  label?: string;
  className?: string;
  imageClassName?: string;
};

/** Poster tile for uploaded or YouTube videos — placeholder when no poster exists. */
export function VideoPosterSurface({
  asset,
  thumbUrl: thumbUrlProp,
  fetchThumb,
  compact,
  label,
  className,
  imageClassName,
}: VideoPosterProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(thumbUrlProp ?? null);
  const youtubePoster = getYouTubePosterUrl(asset as MediaAsset);

  useEffect(() => {
    if (thumbUrlProp) {
      setResolvedUrl(thumbUrlProp);
      return;
    }
    if (youtubePoster || !fetchThumb || !isVideoMediaAsset(asset as MediaAsset)) return;
    if (asset.media_source === "youtube") return;

    let cancelled = false;
    void fetchThumb(asset as MediaAsset, true).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [asset, fetchThumb, thumbUrlProp, youtubePoster]);

  const posterUrl = youtubePoster || thumbUrlProp || resolvedUrl;
  const displayName = mediaDisplayName(asset as MediaAsset);

  if (posterUrl) {
    return (
      <div className={cn("relative h-full w-full", className)}>
        <RemoteImage
          src={posterUrl}
          alt={displayName}
          fill
          className={cn("object-cover", imageClassName)}
          sizes={compact ? "160px" : "400px"}
        />
      </div>
    );
  }

  return (
    <VideoMediaPlaceholder
      fileName={displayName}
      label={label}
      compact={compact}
      className={className}
    />
  );
}
