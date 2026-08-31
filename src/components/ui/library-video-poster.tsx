"use client";

import { RemoteImage } from "@/components/ui/remote-image";
import { VideoMediaPlaceholder } from "@/components/ui/video-media-placeholder";
import { getYouTubeLibraryPosterUrl } from "@/lib/media-preview";
import { mediaDisplayName } from "@/lib/media-display-name";
import type { LibraryAsset } from "@/lib/media-library";
import { cn } from "@/lib/utils";

export function LibraryVideoPoster({
  asset,
  thumbUrl,
  className,
}: {
  asset: LibraryAsset;
  thumbUrl?: string | null;
  className?: string;
}) {
  const youtubePoster = getYouTubeLibraryPosterUrl(asset);
  const posterUrl = youtubePoster || thumbUrl;

  if (posterUrl) {
    return (
      <RemoteImage
        src={posterUrl}
        alt={asset.title}
        fill
        className={cn("object-cover", className)}
        sizes="200px"
      />
    );
  }

  return (
    <VideoMediaPlaceholder fileName={mediaDisplayName(asset)} className={className} />
  );
}
