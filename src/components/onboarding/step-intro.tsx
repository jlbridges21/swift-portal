"use client";

import { useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import type { OnboardingStepIntro } from "@/lib/onboarding-videos";
import { cn } from "@/lib/utils";

/**
 * Under each onboarding step (below the step card): "What this step does", collapsed by default.
 * Opened, it shows the explainer video on the left and three numbered points on the right.
 * The player loads YouTube only after a click (fast pages, no tracking until play).
 */
export function StepIntro({ intro }: { intro: OnboardingStepIntro }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const hasVideo = Boolean(intro.youtubeId);

  return (
    <section aria-label="What this step does" className="rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setPlaying(false);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2.5">
          {hasVideo ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white" aria-hidden>
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            </span>
          ) : null}
          <span className="text-sm font-semibold text-heading">What this step does</span>
          {hasVideo ? (
            <span className="text-xs text-muted">Video{intro.duration ? ` · ${intro.duration}` : ""}</span>
          ) : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div
          className={cn(
            "grid gap-6 border-t border-border px-5 py-5",
            hasVideo && "md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:items-start"
          )}
        >
          {hasVideo ? (
            <div className="min-w-0">
              <h3 className="mb-3 text-base font-semibold text-heading">Explainer video</h3>
              <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
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
                    <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform group-hover:scale-105">
                      <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : null}
          {hasVideo ? <div className="hidden self-stretch bg-border md:block" aria-hidden /> : null}
          <div className="min-w-0">
            <h3 className="mb-3 text-base font-semibold text-heading">What this does</h3>
            <ol className="space-y-4">
              {intro.points.map((point, i) => (
                <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-heading">
                    {i + 1}
                  </span>
                  <span className="pt-1">{point}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </section>
  );
}
