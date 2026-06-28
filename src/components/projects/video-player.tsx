"use client";

import { useState } from "react";
import { Play, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoMediaPlaceholder } from "@/components/ui/video-media-placeholder";
import { mediaDisplayName } from "@/lib/media-display-name";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  video: MediaAsset;
  getDownloadUrl: (asset: MediaAsset, thumb?: boolean) => Promise<string | null>;
  onDownload?: () => void;
  downloadsAllowed?: boolean;
  compact?: boolean;
}

export function VideoPlayer({
  video,
  getDownloadUrl,
  onDownload,
  downloadsAllowed = true,
  compact = false,
}: VideoPlayerProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  async function startPlayback() {
    if (playing || loading) return;
    setLoading(true);
    const url = streamUrl ?? (await getDownloadUrl(video));
    setLoading(false);
    if (!url) return;
    setStreamUrl(url);
    setPlaying(true);
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-black/5",
        compact && "rounded-xl"
      )}
    >
      <div className={cn("relative aspect-video bg-slate-900", compact && "aspect-[16/10]")}>
        {playing && streamUrl ? (
          <video
            src={streamUrl}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={startPlayback}
            disabled={loading}
            className="group relative flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            aria-label={`Play ${mediaDisplayName(video)}`}
          >
            <VideoMediaPlaceholder
              fileName={mediaDisplayName(video)}
              compact={compact}
              className="absolute inset-0"
            />
            <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/25" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl ring-4 ring-white/20 transition group-hover:scale-105">
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
              ) : (
                <Play className="ml-1 h-8 w-8 text-slate-900" fill="currentColor" />
              )}
            </div>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
        <p className="truncate text-sm font-medium text-primary">{mediaDisplayName(video)}</p>
        {downloadsAllowed && onDownload && (
          <Button variant="outline" size="sm" className="min-h-11 shrink-0 gap-1.5" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
