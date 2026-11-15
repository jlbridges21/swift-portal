"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { Check, GraduationCap, X } from "lucide-react";
import { academyLessonHref, formatDuration, type AcademyLesson } from "@/lib/academy/catalog";
import { useAcademy } from "@/components/academy/academy-progress";
import { LessonPlayer } from "@/components/academy/lesson-player";

/** Plays one lesson over the current page (from "Watch how" or the help menu). Progress counts. */
export function LessonModal({ lesson, onClose }: { lesson: AcademyLesson; onClose: () => void }) {
  const a = useAcademy();
  const saved = a.lessons[lesson.key];
  const done = a.status(lesson.key) === "done";
  const report = a.report;
  const onProgress = useCallback(
    (percent: number, position: number, opts?: { keepalive?: boolean }) => report(lesson.key, percent, position, opts),
    [report, lesson.key]
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={lesson.title}>
      <button type="button" className="absolute inset-0 bg-slate-950/70" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-heading">{lesson.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              {done ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> Watched ·
                </span>
              ) : null}
              {formatDuration(lesson.durationSeconds)} · ShootPortal Academy
            </p>
          </div>
          <Link
            href={academyLessonHref(lesson)}
            onClick={onClose}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-accent-subtle sm:inline-flex"
          >
            <GraduationCap className="h-4 w-4" aria-hidden /> Open in Academy
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-heading"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <LessonPlayer
          lesson={lesson}
          initialFurthest={((saved?.percent ?? 0) / 100) * lesson.durationSeconds}
          startAt={saved && !saved.completedAt ? saved.position : 0}
          autoplay
          onProgress={onProgress}
        />
      </div>
    </div>
  );
}
