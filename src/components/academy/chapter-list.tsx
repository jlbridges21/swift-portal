"use client";

import { Check } from "lucide-react";
import { formatDuration, type AcademyLesson } from "@/lib/academy/catalog";
import { cn } from "@/lib/utils";

/**
 * A lesson's chapters: click to jump, the current one highlighted, and a green check on each
 * chapter once the viewer has watched past its end. Used on the lesson page and in the pop-up.
 */
export function ChapterList({
  lesson,
  now,
  watchedSeconds,
  onSeek,
  twoColumns = false,
}: {
  lesson: AcademyLesson;
  /** Current playback time (seconds). */
  now: number;
  /** Furthest point watched (seconds). */
  watchedSeconds: number;
  onSeek: (seconds: number) => void;
  twoColumns?: boolean;
}) {
  const current = [...lesson.chapters].reverse().find((c) => now >= c.t) ?? lesson.chapters[0];
  return (
    <ol className={cn(twoColumns && "grid gap-x-2 sm:grid-cols-2")}>
      {lesson.chapters.map((c, i) => {
        const end = lesson.chapters[i + 1]?.t ?? lesson.durationSeconds;
        const on = current === c;
        const passed = watchedSeconds >= end - 1;
        return (
          <li key={c.t}>
            <button
              type="button"
              onClick={() => onSeek(c.t)}
              aria-current={on ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                on ? "bg-accent-subtle font-semibold text-heading" : "text-foreground hover:bg-subtle"
              )}
            >
              <span className="w-10 shrink-0 font-semibold text-accent tabular-nums">{formatDuration(c.t)}</span>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              {passed ? (
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-label="Watched">
                  <Check className="h-3 w-3" strokeWidth={3.2} aria-hidden />
                </span>
              ) : on ? (
                <span className="shrink-0 text-xs font-semibold text-accent">You&apos;re here</span>
              ) : (
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-border" aria-hidden />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
