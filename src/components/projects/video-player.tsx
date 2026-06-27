"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  video: MediaAsset;
  getDownloadUrl: (asset: MediaAsset, thumb?: boolean) => Promise<string | null>;
  onDownload?: () => void;
  downloadsAllowed?: boolean;
  compact?: boolean;
}

/** Generates a poster from the first video frame when possible. */
async function captureVideoPoster(fileUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = fileUrl;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("loadeddata", () => {
      try {
        video.currentTime = Math.min(0.5, video.duration || 0.5);
      } catch {
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener("error", () => {
      cleanup();
      resolve(null);
    });
  });
}

export function VideoPlayer({
  video,
  getDownloadUrl,
  onDownload,
  downloadsAllowed = true,
  compact = false,
}: VideoPlayerProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await getDownloadUrl(video);
      if (!url || cancelled) return;
      setStreamUrl(url);
      const poster = await captureVideoPoster(url);
      if (!cancelled && poster) setPosterUrl(poster);
    })();
    return () => {
      cancelled = true;
    };
  }, [video, getDownloadUrl]);

  async function startPlayback() {
    if (playing) return;
    setLoading(true);
    const url = streamUrl ?? (await getDownloadUrl(video));
    setLoading(false);
    if (!url) return;
    setStreamUrl(url);
    setPlaying(true);
    requestAnimationFrame(() => videoRef.current?.play());
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
            ref={videoRef}
            src={streamUrl}
            controls
            playsInline
            className="h-full w-full object-contain"
            poster={posterUrl ?? undefined}
          />
        ) : (
          <button
            type="button"
            onClick={startPlayback}
            disabled={loading}
            className="group relative flex h-full w-full items-center justify-center"
            aria-label={`Play ${video.file_name}`}
          >
            {posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
            )}
            <div className="absolute inset-0 bg-black/25 transition group-hover:bg-black/35" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-105">
              {loading ? (
                <span className="text-xs font-medium text-slate-600">Loading…</span>
              ) : (
                <Play className="ml-1 h-7 w-7 text-slate-900" fill="currentColor" />
              )}
            </div>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
        <p className="truncate text-sm text-muted">{video.file_name}</p>
        {downloadsAllowed && onDownload && (
          <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={onDownload}>
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
