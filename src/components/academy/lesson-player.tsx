"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { AcademyLesson } from "@/lib/academy/catalog";

/* Minimal typing for the YouTube IFrame Player API (loaded from youtube.com/iframe_api). */
type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

export type LessonPlayerHandle = { seekTo: (seconds: number) => void };

/**
 * YouTube lesson player that reports how far the viewer has watched.
 * "Watched" only advances through continuous playback (a jump ahead of more than a few seconds
 * past the furthest point doesn't count), so skipping to the end doesn't complete a lesson.
 */
export const LessonPlayer = forwardRef<
  LessonPlayerHandle,
  {
    lesson: AcademyLesson;
    /** Furthest point already reached (seconds), from saved progress. */
    initialFurthest: number;
    /** Where to start playing (seconds). */
    startAt: number;
    autoplay?: boolean;
    onProgress: (percent: number, position: number, opts?: { keepalive?: boolean }) => void;
    onTime?: (seconds: number) => void;
    /** Furthest point watched so far (seconds), every second while playing. */
    onWatched?: (seconds: number) => void;
    onEnded?: () => void;
  }
>(function LessonPlayer({ lesson, initialFurthest, startAt, autoplay, onProgress, onTime, onWatched, onEnded }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const furthest = useRef(initialFurthest);
  const lastSent = useRef(-1);
  const cb = useRef({ onProgress, onTime, onWatched, onEnded });
  cb.current = { onProgress, onTime, onWatched, onEnded };

  useImperativeHandle(ref, () => ({
    seekTo: (s: number) => {
      playerRef.current?.seekTo(s, true);
      playerRef.current?.playVideo();
    },
  }));

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    const duration = lesson.durationSeconds;
    furthest.current = Math.max(furthest.current, initialFurthest);

    const send = (keepalive = false) => {
      const p = playerRef.current;
      if (!p) return;
      const pos = p.getCurrentTime?.() ?? 0;
      const pct = Math.min(100, (furthest.current / duration) * 100);
      // Nothing watched yet (a lesson merely opened, or React's dev double-mount): nothing to save.
      if (pct < 1 && pos < 1) return;
      if (!keepalive && Math.abs(pct - lastSent.current) < 2) return;
      lastSent.current = pct;
      cb.current.onProgress(pct, pos, { keepalive });
    };

    void loadYouTubeApi().then((YT) => {
      if (disposed || !hostRef.current) return;
      const mount = document.createElement("div");
      hostRef.current.replaceChildren(mount);
      playerRef.current = new YT.Player(mount, {
        host: "https://www.youtube-nocookie.com",
        videoId: lesson.youtubeId,
        width: "100%",
        height: "100%",
        playerVars: {
          start: Math.max(0, Math.floor(startAt)),
          autoplay: autoplay ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          cc_load_policy: 0,
        },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PAUSED) send(true);
            if (e.data === YT.PlayerState.ENDED) {
              furthest.current = duration;
              cb.current.onWatched?.(duration);
              send(true);
              cb.current.onEnded?.();
            }
          },
        },
      });
      timer = window.setInterval(() => {
        const p = playerRef.current;
        if (!p?.getPlayerState) return;
        const t = p.getCurrentTime?.() ?? 0;
        cb.current.onTime?.(t);
        if (p.getPlayerState() !== YT.PlayerState.PLAYING) return;
        // Continuous viewing only: allow small jumps (buffering, 5-10 s skips), not leaps ahead.
        if (t > furthest.current && t - furthest.current <= 12) {
          furthest.current = t;
          cb.current.onWatched?.(t);
        }
        if (Math.floor(t) % 10 === 0) send();
        if ((furthest.current / duration) * 100 >= 90 && lastSent.current < 90) send(true);
      }, 1000);
    });

    const onHide = () => {
      if (document.visibilityState === "hidden") send(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onHide);
      if (timer) window.clearInterval(timer);
      send(true);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // The player is created once per lesson; startAt/autoplay only apply at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.key]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <div ref={hostRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
    </div>
  );
});
