"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, CircleHelp, GraduationCap, Mail, Play } from "lucide-react";
import { academyLessonByKey, formatDuration, type AcademyLesson } from "@/lib/academy/catalog";
import { useAcademy } from "@/components/academy/academy-progress";
import { usePageLessons } from "@/components/academy/use-page-lessons";
import { LessonModal } from "@/components/academy/lesson-modal";
import { LessonThumb } from "@/components/academy/lesson-thumb";
import { cn } from "@/lib/utils";

/**
 * Top-bar help button. Leads with the lesson for the page on screen, then the Academy with
 * course progress, then support.
 */
export function HelpMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<AcademyLesson | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const page = usePageLessons();
  const a = useAcademy();
  const primary = page.primary ? academyLessonByKey(page.primary) : null;
  const related = page.related.map((k) => academyLessonByKey(k)).filter((l): l is AcademyLesson => Boolean(l)).slice(0, 2);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function play(lesson: AcademyLesson) {
    setOpen(false);
    setPlaying(lesson);
  }

  const item = "flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-subtle hover:text-heading";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Help and tutorials"
        title="Help and tutorials"
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-lg text-heading transition-colors hover:bg-subtle",
          open && "bg-accent-subtle text-accent"
        )}
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-full z-[80] mt-2 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-2 shadow-xl">
          {primary ? (
            <>
              <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">On this page</p>
              <button type="button" role="menuitem" onClick={() => play(primary)} className="flex w-full items-center gap-3 rounded-xl bg-accent-subtle p-2 text-left hover:ring-1 hover:ring-accent/30">
                <LessonThumb lesson={primary} status={a.status(primary.key)} percent={a.lessons[primary.key]?.percent ?? 0} size="sm" className="w-28 shrink-0" durationLabel={formatDuration(primary.durationSeconds)} />
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-snug text-heading">{primary.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">Watch the short lesson for this page</span>
                </span>
              </button>
              {related.map((l) => (
                <button key={l.key} type="button" role="menuitem" onClick={() => play(l)} className={item}>
                  <Play className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  <span className="text-xs text-muted tabular-nums">{formatDuration(l.durationSeconds)}</span>
                </button>
              ))}
              <div className="mx-1 my-1.5 border-t border-border" />
            </>
          ) : null}
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Learn</p>
          <Link href="/admin/academy" role="menuitem" className={cn(item, "items-start")}>
            {a.certified ? (
              <Award className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-heading">ShootPortal Academy</span>
              <span className="block text-xs text-muted">
                {a.certified ? "Certified · all lessons complete" : `${a.completed} of ${a.total} lessons · ${a.percent}%`}
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-border/70">
                <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${a.percent}%` }} />
              </span>
            </span>
          </Link>
          {a.next && a.next.key !== primary?.key ? (
            <button type="button" role="menuitem" onClick={() => play(a.next!)} className={item}>
              <Play className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                Next lesson: <span className="font-medium text-heading">{a.next.title}</span>
              </span>
            </button>
          ) : null}
          <div className="mx-1 my-1.5 border-t border-border" />
          <a href="mailto:support@shootportal.app" role="menuitem" className={item}>
            <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1">
              Email support
              <span className="block text-xs text-muted">support@shootportal.app</span>
            </span>
          </a>
        </div>
      ) : null}
      {playing ? <LessonModal lesson={playing} onClose={() => setPlaying(null)} /> : null}
    </div>
  );
}
