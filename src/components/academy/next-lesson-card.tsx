"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, X } from "lucide-react";
import { academyLessonHref, lessonNumber } from "@/lib/academy/catalog";
import { useAcademy } from "@/components/academy/academy-progress";
import { LessonThumb } from "@/components/academy/lesson-thumb";

const DISMISS_KEY = "sp-academy-card-dismissed";

/** Dashboard card: the next Academy lesson, until the course is done or the card is dismissed. */
export function NextLessonCard() {
  const a = useAcademy();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (!a.ready || dismissed || !a.next || a.certified) return null;
  const next = a.next;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* hidden for this visit only */
    }
  }

  return (
    <section className="relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-heading"
        aria-label="Hide the Academy card"
        title="Hide"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <Link href={academyLessonHref(next)} className="w-full shrink-0 sm:w-44">
        <LessonThumb lesson={next} status={a.status(next.key)} percent={a.lessons[next.key]?.percent ?? 0} />
      </Link>
      <div className="min-w-0 flex-1 pr-6">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          {a.completed === 0 ? "New here? Start with a 3-minute lesson" : "Your next lesson"}
        </p>
        <Link href={academyLessonHref(next)} className="mt-1 block font-bold text-heading hover:text-accent">
          {next.title}
        </Link>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted">{next.description}</p>
        <div className="mt-2.5 flex items-center gap-3">
          <span className="h-1.5 w-40 overflow-hidden rounded-full bg-border/70">
            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${a.percent}%` }} />
          </span>
          <span className="text-xs text-muted tabular-nums">
            Lesson {lessonNumber(next)} · {a.completed}/{a.total} done
          </span>
          <Link href="/admin/academy" className="ml-auto text-xs font-semibold text-accent hover:underline">
            Open Academy
          </Link>
        </div>
      </div>
    </section>
  );
}
