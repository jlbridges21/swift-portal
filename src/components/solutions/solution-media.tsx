"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import type { SolutionImageAsset, SolutionVideoAsset } from "@/lib/solution-media";
import { cn } from "@/lib/utils";

/**
 * Media building blocks for the Solutions pages.
 * - ShowcaseImage: next/image (responsive srcset, modern formats, lazy unless priority).
 * - LoopVideo: muted motion graphic. Sources attach only when near the viewport, playback
 *   pauses off-screen, reduced-motion users get the poster and a play button, and a visible
 *   pause control satisfies WCAG 2.2.2 for moving content.
 * - DemoVideo: click-to-play product demo; nothing downloads until the visitor presses play.
 */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

const FRAMES = {
  none: "",
  card: "overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#0B1124] shadow-[0_40px_90px_-50px_rgba(15,23,42,0.65)]",
  dark: "overflow-hidden rounded-2xl border border-white/10 bg-[#0B1124] shadow-[0_50px_100px_-50px_rgba(0,0,0,0.9)]",
} as const;

export function ShowcaseImage({
  image,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority = false,
  frame = "card",
  className,
}: {
  image: SolutionImageAsset;
  sizes?: string;
  priority?: boolean;
  frame?: keyof typeof FRAMES;
  className?: string;
}) {
  return (
    <div className={cn(FRAMES[frame], className)}>
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes={sizes}
        priority={priority}
        className="block h-auto w-full"
      />
    </div>
  );
}

export function LoopVideo({
  video,
  frame = "card",
  className,
}: {
  video: SolutionVideoAsset;
  frame?: keyof typeof FRAMES;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = usePrefersReducedMotion();
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  // MP4 (H.264) first: hardware-decoded nearly everywhere. If a format fails to decode,
  // fall back to the other one instead of leaving the poster frozen.
  const formats = video.webm ? [video.mp4, video.webm] : [video.mp4];
  const [formatIndex, setFormatIndex] = useState(0);
  const current = formats[formatIndex];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
        const v = ref.current;
        if (!v) return;
        if (!entry.isIntersecting) v.pause();
        else if (!reduced && !userPaused && v.readyState > 0) void v.play().catch(() => {});
      },
      { rootMargin: "250px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, userPaused]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !near) return;
    v.load();
    if (!reduced && !userPaused) void v.play().catch(() => {});
    // Reload when sources first attach or the format changes after an error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, formatIndex]);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      setUserPaused(false);
      void v.play().catch(() => {});
    } else {
      setUserPaused(true);
      v.pause();
    }
  }

  return (
    <div className={cn("relative", FRAMES[frame], className)}>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster={video.poster}
        aria-label={video.label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFormatIndex((i) => (i + 1 < formats.length ? i + 1 : i))}
        className="block aspect-video h-auto w-full object-cover"
      >
        {near ? (
          <source
            key={current}
            src={current}
            type={current.endsWith(".webm") ? "video/webm" : "video/mp4"}
            onError={() => setFormatIndex((i) => (i + 1 < formats.length ? i + 1 : i))}
          />
        ) : null}
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause animation" : "Play animation"}
        className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 fill-white" aria-hidden />}
      </button>
    </div>
  );
}

export function DemoVideo({
  video,
  ctaHint,
  frame = "dark",
  className,
}: {
  video: SolutionVideoAsset;
  /** Small line under the player, e.g. what to look for. */
  ctaHint?: ReactNode;
  frame?: keyof typeof FRAMES;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    const v = ref.current;
    if (!v) return;
    v.load();
    void v.play().catch(() => {});
  }, [started]);

  return (
    <figure className={className}>
      <div className={cn("relative", FRAMES[frame])}>
        <video
          ref={ref}
          playsInline
          muted
          preload="none"
          controls={started}
          poster={video.poster}
          aria-label={video.label}
          className="block aspect-video h-auto w-full bg-[#0B1124]"
        >
          {started ? <source src={video.mp4} type="video/mp4" /> : null}
        </video>
        {!started ? (
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="group absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/45 via-black/10 to-transparent focus-visible:outline-none"
            aria-label={`Play video: ${video.title ?? video.label}`}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-[0_20px_50px_-15px_rgba(79,70,229,0.9)] ring-8 ring-white/20 transition group-hover:scale-105 group-focus-visible:ring-white/60 sm:h-20 sm:w-20">
              <Play className="ml-1 h-7 w-7 fill-[#4F46E5] text-[#4F46E5] sm:h-8 sm:w-8" aria-hidden />
            </span>
            {video.title ? (
              <span className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-left sm:bottom-4 sm:left-5 sm:right-5">
                <span className="hidden text-base font-semibold text-white drop-shadow sm:inline">{video.title}</span>
                {video.duration ? (
                  <span className="ml-auto rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">{video.duration}</span>
                ) : null}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
      {ctaHint ? <figcaption className="mt-3 text-center text-xs text-[#64748B]">{ctaHint}</figcaption> : null}
    </figure>
  );
}
