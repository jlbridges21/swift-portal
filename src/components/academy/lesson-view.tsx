"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, Check, ChevronRight, CircleCheck, ExternalLink, List, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACADEMY_COMPLETE_PERCENT,
  ACADEMY_LESSONS,
  ACADEMY_MODULES,
  academyLessonHref,
  formatDuration,
  lessonNumber,
  moduleLessons,
  type AcademyLesson,
  type AcademyModuleId,
} from "@/lib/academy/catalog";
import type { AcademyProgressState } from "@/lib/academy/server";
import { useAcademy } from "@/components/academy/academy-progress";
import { LessonPlayer, type LessonPlayerHandle } from "@/components/academy/lesson-player";
import { LessonThumb } from "@/components/academy/lesson-thumb";
import { ChapterList } from "@/components/academy/chapter-list";
import { cn } from "@/lib/utils";

const AUTOPLAY_KEY = "sp-academy-autoplay";

function readAutoplayPref(): boolean {
  try {
    return window.localStorage.getItem(AUTOPLAY_KEY) !== "off";
  } catch {
    return true;
  }
}

export function LessonView({
  lesson,
  initial,
  autoplay,
  canTry,
}: {
  lesson: AcademyLesson;
  initial: AcademyProgressState;
  autoplay: boolean;
  /** Whether "Try it now" leads somewhere this user may open (staff lack owner-only pages). */
  canTry: boolean;
}) {
  const a = useAcademy(initial);
  const router = useRouter();
  const player = useRef<LessonPlayerHandle>(null);
  const saved = initial.lessons[lesson.key];
  const [now, setNow] = useState(saved?.position ?? 0);
  const [liveWatched, setLiveWatched] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoNext, setAutoNext] = useState(true);
  useEffect(() => setAutoNext(readAutoplayPref()), []);

  const idx = ACADEMY_LESSONS.findIndex((l) => l.key === lesson.key);
  const nextLesson = idx >= 0 ? (ACADEMY_LESSONS[idx + 1] ?? null) : null;
  const status = a.status(lesson.key);
  const pct = a.lessons[lesson.key]?.percent ?? 0;
  const mod = lesson.module ? (lesson.module as AcademyModuleId) : null;
  const modLessons = mod ? moduleLessons(mod) : [];
  // Resume where they stopped, unless they had nearly finished (then start over).
  const startAt = saved && !saved.completedAt && saved.position < lesson.durationSeconds - 8 ? saved.position : 0;
  const initialFurthest = ((saved?.percent ?? 0) / 100) * lesson.durationSeconds;

  const onProgress = useCallback(
    (percent: number, position: number, opts?: { keepalive?: boolean }) => a.report(lesson.key, percent, position, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson.key, a.report]
  );

  const onEnded = useCallback(() => {
    if (nextLesson && readAutoplayPref()) setCountdown(8);
  }, [nextLesson]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (nextLesson) router.push(`${academyLessonHref(nextLesson)}?autoplay=1`);
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, nextLesson, router]);

  function toggleAutoNext() {
    const v = !autoNext;
    setAutoNext(v);
    try {
      window.localStorage.setItem(AUTOPLAY_KEY, v ? "on" : "off");
    } catch {
      /* preference just isn't remembered */
    }
    if (!v) setCountdown(null);
  }


  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Link href="/admin/academy" className="hover:text-accent hover:underline">
            Academy
          </Link>
          {mod ? (
            <>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span>{ACADEMY_MODULES[mod - 1].title}</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <b className="font-semibold text-foreground">
                Lesson {lessonNumber(lesson)} of {a.total}
              </b>
            </>
          ) : null}
        </nav>

        <div className="relative">
          <LessonPlayer
            ref={player}
            lesson={lesson}
            initialFurthest={initialFurthest}
            startAt={startAt}
            autoplay={autoplay}
            onProgress={onProgress}
            onTime={setNow}
            onWatched={setLiveWatched}
            onEnded={onEnded}
          />
          {countdown !== null && nextLesson ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/80 p-4 text-white">
              <div className="w-full max-w-sm text-center">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-indigo-200">Up next in {countdown}</p>
                <p className="mt-2 text-lg font-bold">{nextLesson.title}</p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button variant="accent" onClick={() => router.push(`${academyLessonHref(nextLesson)}?autoplay=1`)} className="gap-2">
                    <Play className="h-4 w-4" aria-hidden /> Play now
                  </Button>
                  <Button variant="outline" className="text-slate-900" onClick={() => setCountdown(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-heading">{lesson.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              {status === "done" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Watched
                </span>
              ) : pct > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-semibold text-accent">
                  <Play className="h-3 w-3" aria-hidden /> {pct}% watched
                </span>
              ) : null}
              <span>
                {formatDuration(lesson.durationSeconds)}
                {mod ? ` · ${ACADEMY_MODULES[mod - 1].title}` : ""} · Marks complete at {ACADEMY_COMPLETE_PERCENT}%
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-foreground">{lesson.description}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:w-60">
            {canTry && lesson.tryHref ? (
              <Link href={lesson.tryHref}>
                <Button variant="accent" className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" aria-hidden /> Try it now: {lesson.tryLabel?.replace(/^Open /, "open ")}
                </Button>
              </Link>
            ) : null}
            {status !== "done" ? (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => a.report(lesson.key, pct, now, { complete: true })}
              >
                <CircleCheck className="h-4 w-4" aria-hidden /> Mark as complete
              </Button>
            ) : null}
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <h3 className="flex items-center gap-2 px-2 pb-2 text-sm font-bold text-heading">
            <List className="h-4 w-4 text-muted" aria-hidden /> Chapters
          </h3>
          <ChapterList
            lesson={lesson}
            now={now}
            watchedSeconds={Math.max((pct / 100) * lesson.durationSeconds, liveWatched)}
            onSeek={(t) => player.current?.seekTo(t)}
          />
        </section>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[340px]">
        {a.completed === a.total && !a.certificate ? (
          <Link
            href="/admin/academy?certificate=1"
            className="flex items-center gap-3 rounded-2xl bg-emerald-600 p-4 text-white shadow-sm hover:bg-emerald-700"
          >
            <Award className="h-8 w-8 shrink-0" aria-hidden />
            <span>
              <span className="block font-bold">You finished every lesson!</span>
              <span className="block text-sm text-emerald-50">Claim your ShootPortal certificate</span>
            </span>
          </Link>
        ) : null}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex justify-between text-sm">
            <b className="text-heading">Course progress</b>
            <span className="text-muted tabular-nums">
              {a.completed}/{a.total}
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border/70">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${a.percent}%` }} />
          </div>
        </section>

        {mod ? (
          <section className="rounded-2xl border border-border bg-card p-2.5">
            <div className="flex items-center justify-between px-2 pb-1.5 pt-1.5">
              <b className="text-sm text-heading">{ACADEMY_MODULES[mod - 1].title}</b>
              <span className="text-xs text-muted tabular-nums">
                {modLessons.filter((l) => a.status(l.key) === "done").length}/{modLessons.length}
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {modLessons.map((l) => {
                const s = a.status(l.key);
                const here = l.key === lesson.key;
                return (
                  <li key={l.key}>
                    <Link
                      href={academyLessonHref(l)}
                      aria-current={here ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-2 transition-colors",
                        here ? "bg-accent-subtle ring-1 ring-inset ring-accent/30" : "hover:bg-subtle"
                      )}
                    >
                      <LessonThumb lesson={l} status={s} percent={a.lessons[l.key]?.percent ?? 0} size="sm" className="w-28 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold leading-snug text-heading">{l.title}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          {s === "done" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> Watched
                            </span>
                          ) : here ? (
                            "Now playing"
                          ) : (
                            formatDuration(l.durationSeconds)
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {nextLesson ? (
          <section className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-indigo-200">Up next</p>
            <Link href={academyLessonHref(nextLesson)} className="mt-3 flex items-center gap-3">
              <LessonThumb lesson={nextLesson} size="sm" className="w-28 shrink-0" durationLabel={formatDuration(nextLesson.durationSeconds)} />
              <span className="text-sm font-semibold leading-snug">{nextLesson.title}</span>
            </Link>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input id="academy-autoplay" type="checkbox" checked={autoNext} onChange={toggleAutoNext} className="h-4 w-4 accent-current" />
              Play the next lesson automatically
            </label>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
            This is the last lesson.{" "}
            <Link href="/admin/academy" className="font-semibold text-accent hover:underline">
              Back to the Academy
            </Link>
          </section>
        )}
      </aside>
    </div>
  );
}
