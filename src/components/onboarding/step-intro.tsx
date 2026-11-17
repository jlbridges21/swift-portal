"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import type { OnboardingStepIntro } from "@/lib/onboarding-videos";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "sp-onboarding-intro-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Under each onboarding step title: a short video and three "What this does" points.
 * The player loads YouTube only after a click (fast pages, no tracking until play).
 * Collapsing it is remembered for this browser; it never blocks Continue.
 */
export function StepIntro({ intro }: { intro: OnboardingStepIntro }) {
  const [collapsed, setCollapsed] = useState(false);
  const [playing, setPlaying] = useState(false);
  // After hydration: the server always renders it open.
  useEffect(() => {
    if (readCollapsed()) setCollapsed(true);
  }, []);
  const hasVideo = Boolean(intro.youtubeId);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    setPlaying(false);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* private mode: just don't remember */
    }
  }

  return (
    <section aria-label="About this step" className="rounded-xl border border-border bg-subtle/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-medium text-heading"
      >
        <span className="flex items-center gap-2">
          {hasVideo ? <Play className="h-4 w-4 text-accent" aria-hidden /> : null}
          {hasVideo ? `Watch how${intro.duration ? ` · ${intro.duration}` : ""}` : "What this step does"}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", !collapsed && "rotate-180")} aria-hidden />
      </button>

      {!collapsed ? (
        <div className={cn("grid gap-4 px-4 pb-4", hasVideo && "sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:items-center")}>
          {hasVideo ? (
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              {playing ? (
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${intro.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                  title={intro.videoTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="group absolute inset-0 flex items-center justify-center"
                  aria-label={`Play video: ${intro.videoTitle}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://i.ytimg.com/vi/${intro.youtubeId}/hqdefault.jpg`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                    loading="lazy"
                  />
                  <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform group-hover:scale-105">
                    <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
                  </span>
                </button>
              )}
            </div>
          ) : null}
          <div>
            {hasVideo ? <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">What this does</p> : null}
            <ol className="space-y-2">
              {intro.points.map((point, i) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent/40 text-[11px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </section>
  );
}
