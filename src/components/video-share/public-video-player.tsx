"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play, VideoOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoEmbedOptions } from "@/lib/video-embed-options";

export type PublicVideoSourceState = {
  src: string;
  expiresAt: number;
  poster: string | null;
  mimeType: string;
};

export type PublicVideoBranding = {
  name: string;
  logoUrl: string | null;
  /** Watch page URL opened from the branding chip (new tab). */
  href: string | null;
};

type Props = {
  publicId: string;
  /** Path prefix for API calls ("" on subdomain/custom-domain hosts, "/b/{slug}" on path hosts). */
  apiBase: string;
  initialSource: PublicVideoSourceState | null;
  title: string;
  options: VideoEmbedOptions;
  branding?: PublicVideoBranding | null;
  /** Preview inside the Share modal (embed ?preview=1): no analytics. */
  preview?: boolean;
  className?: string;
};

const BEACON_INTERVAL_MS = 15_000;
const MAX_SOURCE_RETRIES = 3;

function totalBuffered(video: HTMLVideoElement): number {
  let sum = 0;
  for (let i = 0; i < video.buffered.length; i++) sum += video.buffered.end(i) - video.buffered.start(i);
  return sum;
}

/**
 * Lightweight player for public watch pages and website embeds.
 *
 * - Streams the signed Storage URL directly (range requests: fast start, seeking,
 *   no full download). preload=metadata unless the embed autoplays.
 * - Autoplay follows browser rules: tries with sound when asked, falls back to muted
 *   autoplay with a "Tap to unmute" pill, and to a play button if autoplay is blocked.
 * - Refreshes the short-lived playback URL on error and resumes where it left off; if
 *   sharing was turned off, shows "no longer available".
 * - Autoplaying muted videos pause while scrolled out of view (saves bandwidth).
 * - Reports plays and newly buffered seconds for bandwidth estimates.
 */
export function PublicVideoPlayer({
  publicId,
  apiBase,
  initialSource,
  title,
  options,
  branding,
  preview = false,
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<PublicVideoSourceState | null>(initialSource);
  const [unavailable, setUnavailable] = useState(!initialSource);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [muted, setMuted] = useState(options.muted);
  const [forcedMute, setForcedMute] = useState(false);
  const [titleVisible, setTitleVisible] = useState(true);
  const retries = useRef(0);
  const resumeAt = useRef<{ time: number; play: boolean } | null>(null);
  const reportedBuffered = useRef(0);
  const sentPlay = useRef(false);
  const userInteracted = useRef(false);
  const apiRoot = `${apiBase}/api/public/video/${encodeURIComponent(publicId)}`;

  useEffect(() => {
    setSource(initialSource);
    setUnavailable(!initialSource);
  }, [initialSource]);

  useEffect(() => {
    setMuted(options.muted);
    setForcedMute(false);
  }, [options.muted, options.autoplay]);

  // ── Analytics ────────────────────────────────────────────────────────────
  const beacon = useCallback(
    (payload: Record<string, unknown>) => {
      if (preview) return;
      const body = JSON.stringify(payload);
      const url = `${apiRoot}/beacon`;
      try {
        if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
      } catch {
        /* fall through */
      }
      void fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(
        () => undefined
      );
    },
    [apiRoot, preview]
  );

  const flushBytes = useCallback(() => {
    const v = videoRef.current;
    if (!v || preview) return;
    const now = totalBuffered(v);
    const delta = now - reportedBuffered.current;
    if (delta >= 1) {
      reportedBuffered.current = now;
      beacon({ kind: "bytes", seconds: Math.round(delta * 10) / 10, duration: Number.isFinite(v.duration) ? v.duration : 0 });
    }
  }, [beacon, preview]);

  useEffect(() => {
    if (preview) return;
    const id = window.setInterval(flushBytes, BEACON_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") flushBytes();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushBytes);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushBytes);
    };
  }, [flushBytes, preview]);

  // ── Source refresh ───────────────────────────────────────────────────────
  const refreshSource = useCallback(async () => {
    const v = videoRef.current;
    if (retries.current >= MAX_SOURCE_RETRIES) {
      setUnavailable(true);
      return;
    }
    retries.current += 1;
    flushBytes();
    resumeAt.current = v ? { time: v.currentTime, play: !v.paused || playing } : null;
    try {
      const res = await fetch(`${apiRoot}/source`, { cache: "no-store" });
      if (res.status === 404) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as PublicVideoSourceState;
      reportedBuffered.current = 0; // new resource: the browser fetches fresh bytes
      setSource(next);
    } catch {
      window.setTimeout(() => void refreshSource(), 1500 * retries.current);
    }
  }, [apiRoot, flushBytes, playing]);

  // After a refreshed src loads, return to where the viewer was.
  function onLoadedMetadata() {
    const v = videoRef.current;
    const r = resumeAt.current;
    if (!v || !r) return;
    resumeAt.current = null;
    if (r.time > 0 && Number.isFinite(v.duration)) v.currentTime = Math.min(r.time, Math.max(0, v.duration - 0.5));
    if (r.play) void v.play().catch(() => undefined);
  }

  // ── Autoplay with graceful fallback ──────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !source || !options.autoplay) return;
    let cancelled = false;
    v.muted = options.muted;
    v.play().catch(() => {
      if (cancelled || options.muted) return;
      // Browsers only allow silent autoplay: start muted and offer an unmute button.
      v.muted = true;
      setMuted(true);
      setForcedMute(true);
      void v.play().catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
    // Only on first source / option change — not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.autoplay, options.muted, source?.poster]);

  // Pause silent autoplay while out of view; resume when it comes back.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !options.autoplay || preview || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry || userInteracted.current || !v.muted) return;
        if (entry.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.05 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [options.autoplay, preview, source]);

  // Title overlay fades while playing, returns on pause / pointer movement.
  useEffect(() => {
    if (!playing) {
      setTitleVisible(true);
      return;
    }
    const t = window.setTimeout(() => setTitleVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [playing]);

  function poke() {
    if (!playing) return;
    setTitleVisible(true);
    window.setTimeout(() => setTitleVisible(false), 2500);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    userInteracted.current = true;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }

  function unmute() {
    const v = videoRef.current;
    if (!v) return;
    userInteracted.current = true;
    v.muted = false;
    setMuted(false);
    setForcedMute(false);
    if (v.paused) void v.play().catch(() => undefined);
  }

  if (unavailable || !source) {
    return (
      <div className={cn("relative flex h-full w-full items-center justify-center bg-neutral-950 text-white", className)}>
        <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center">
          <VideoOff className="h-8 w-8 text-white/50" aria-hidden />
          <p className="text-sm font-medium">This video isn&apos;t available</p>
          <p className="text-xs text-white/60">It may have been removed or is no longer shared.</p>
        </div>
      </div>
    );
  }

  const showBigPlay = !playing && !buffering && (!started || !options.controls);

  return (
    <div
      className={cn("group relative h-full w-full overflow-hidden bg-black", className)}
      onPointerMove={poke}
    >
      <video
        ref={videoRef}
        src={source.src}
        poster={source.poster ?? undefined}
        title={title}
        aria-label={title}
        playsInline
        muted={muted}
        loop={options.loop}
        autoPlay={options.autoplay}
        controls={options.controls && started}
        controlsList="nodownload"
        preload={options.autoplay ? "auto" : "metadata"}
        disablePictureInPicture={!options.controls}
        disableRemotePlayback={!options.controls}
        className={cn("h-full w-full", options.fit === "cover" ? "object-cover" : "object-contain")}
        onClick={options.controls && started ? undefined : togglePlay}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={() => setStarted(true)}
        onPlaying={() => {
          setPlaying(true);
          setBuffering(false);
          retries.current = 0;
          if (!sentPlay.current) {
            sentPlay.current = true;
            beacon({ kind: "play" });
          }
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onError={() => void refreshSource()}
      />

      {buffering ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-white/80 drop-shadow" aria-label="Loading" />
        </div>
      ) : null}

      {showBigPlay ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={`Play ${title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/10 transition hover:bg-black/20 focus-visible:outline-none"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-sm transition group-hover:scale-105 sm:h-[72px] sm:w-[72px]">
            <Play className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8" aria-hidden />
          </span>
        </button>
      ) : null}

      {options.title ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-3 transition-opacity duration-300",
            titleVisible ? "opacity-100" : "opacity-0"
          )}
        >
          <p className="truncate text-sm font-medium text-white drop-shadow sm:text-base">{title}</p>
        </div>
      ) : null}

      {forcedMute && muted ? (
        <button
          type="button"
          onClick={unmute}
          className="absolute left-3 top-3 z-10 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-black/70 px-3 text-xs font-semibold text-white shadow ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/80"
          style={options.title ? { top: "2.75rem" } : undefined}
        >
          <VolumeX className="h-4 w-4" aria-hidden /> Tap to unmute
        </button>
      ) : null}

      {!options.controls && started && !muted && !forcedMute ? (
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current;
            if (v) v.muted = true;
          }}
          aria-label="Mute"
          className="absolute bottom-3 left-3 z-10 hidden h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
        >
          <Volume2 className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      {branding && options.branding ? (
        <a
          href={branding.href ?? undefined}
          target="_blank"
          rel="noopener"
          className={cn(
            "absolute bottom-3 right-3 z-10 inline-flex max-w-[45%] items-center gap-2 rounded-md bg-black/55 px-2 py-1.5 text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/70",
            options.controls && started && "bottom-14",
            !branding.href && "pointer-events-none"
          )}
          aria-label={branding.href ? `Watch on ${branding.name}` : branding.name}
        >
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-5 w-auto max-w-[120px] object-contain" />
          ) : (
            <span className="truncate text-xs font-semibold">{branding.name}</span>
          )}
        </a>
      ) : null}
    </div>
  );
}
