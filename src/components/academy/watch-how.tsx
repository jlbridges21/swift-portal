"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { academyLessonByKey, formatDuration } from "@/lib/academy/catalog";
import { usePageLessons } from "@/components/academy/use-page-lessons";
import { LessonModal } from "@/components/academy/lesson-modal";
import { useAcademy } from "@/components/academy/academy-progress";
import { cn } from "@/lib/utils";

/**
 * "Watch how · 2:58": plays the lesson for the page on screen without leaving it.
 * Shown only until that lesson is complete; after that the help (?) menu still offers it.
 */
export function WatchHowPill({
  className,
  lessonKey,
}: {
  className?: string;
  /** Force a lesson (dev harness). */ lessonKey?: string;
}) {
  const { primary } = usePageLessons();
  const key = lessonKey ?? primary;
  const lesson = key ? academyLessonByKey(key) : null;
  const a = useAcademy();
  const [open, setOpen] = useState(false);
  if (!lesson) return null;
  // Wait for progress so a finished lesson's pill never flashes; keep an open player mounted
  // even if the lesson completes while it plays.
  const show = a.ready && a.status(lesson.key) !== "done";
  if (!show && !open) return null;
  return (
    <>
      {show ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`Watch: ${lesson.title}`}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-accent/25 bg-accent-subtle pl-1 pr-3 text-xs font-semibold text-accent transition hover:border-accent/50 hover:bg-card",
            className,
          )}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
            <Play className="ml-px h-3 w-3 fill-current" aria-hidden />
          </span>
          <span className="whitespace-nowrap">
            Watch how
            <span className="hidden sm:inline">
              {" "}
              · {formatDuration(lesson.durationSeconds)}
            </span>
          </span>
        </button>
      ) : null}
      {open ? (
        <LessonModal lesson={lesson} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
