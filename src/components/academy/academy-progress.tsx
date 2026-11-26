"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ACADEMY_COMPLETE_PERCENT,
  ACADEMY_LESSONS,
  ACADEMY_LESSON_COUNT,
  type AcademyLesson,
} from "@/lib/academy/catalog";
import type { AcademyCertificate, AcademyLessonProgress, AcademyProgressState } from "@/lib/academy/server";

export type LessonStatus = "done" | "progress" | "new";

type Ctx = {
  state: AcademyProgressState | null;
  /** Save progress for one lesson (optimistic). */
  report: (lessonKey: string, percent: number, position: number, opts?: { complete?: boolean; keepalive?: boolean }) => void;
  refresh: () => void;
  setCertificate: (cert: AcademyCertificate) => void;
};

const AcademyProgressContext = createContext<Ctx | null>(null);

/**
 * One copy of the signed-in user's Academy progress for the whole admin app: the sidebar ring,
 * help menu, dashboard card and Academy pages all read it, and lesson players write to it.
 */
export function AcademyProgressProvider({
  children,
  initial = null,
}: {
  children: React.ReactNode;
  /** Starting state (dev harness); the live copy replaces it once it loads. */
  initial?: AcademyProgressState | null;
}) {
  const parent = useContext(AcademyProgressContext);
  if (parent) return <>{children}</>;
  return <AcademyProgressStore initial={initial}>{children}</AcademyProgressStore>;
}

/**
 * Progress only moves forward. A fetch can start before a save finishes and come back with the
 * older copy, so a server read never takes away a higher percent, a completion or a certificate
 * that this page already knows about.
 */
function mergeProgress(server: AcademyProgressState, local: AcademyProgressState | null): AcademyProgressState {
  if (!local) return server;
  const lessons: Record<string, AcademyLessonProgress> = { ...server.lessons };
  for (const [key, mine] of Object.entries(local.lessons)) {
    const theirs = lessons[key];
    if (!theirs) {
      lessons[key] = mine;
      continue;
    }
    const mineAhead = mine.percent > theirs.percent;
    lessons[key] = {
      percent: Math.max(mine.percent, theirs.percent),
      position: mineAhead ? mine.position : theirs.position,
      completedAt: theirs.completedAt ?? mine.completedAt,
    };
  }
  return { ...server, lessons, certificate: server.certificate ?? local.certificate };
}

function AcademyProgressStore({ children, initial }: { children: React.ReactNode; initial: AcademyProgressState | null }) {
  const [state, setState] = useState<AcademyProgressState | null>(initial);
  const inflight = useRef(false);

  const refresh = useCallback(() => {
    if (inflight.current) return;
    inflight.current = true;
    fetch("/api/academy/progress", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AcademyProgressState | null) => {
        if (data && typeof data === "object" && data.lessons) setState((cur) => mergeProgress(data, cur));
      })
      .catch(() => {})
      .finally(() => {
        inflight.current = false;
      });
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const report = useCallback<Ctx["report"]>((lessonKey, percent, position, opts) => {
    setState((cur) => {
      const base: AcademyProgressState = cur ?? { setupRequired: false, lessons: {}, certificate: null };
      const prev = base.lessons[lessonKey];
      const p = Math.max(prev?.percent ?? 0, Math.round(percent));
      const done = prev?.completedAt ?? (p >= ACADEMY_COMPLETE_PERCENT || opts?.complete ? new Date().toISOString() : null);
      return { ...base, lessons: { ...base.lessons, [lessonKey]: { percent: p, position: Math.round(position), completedAt: done } } };
    });
    void fetch("/api/academy/progress", {
      method: "POST",
      credentials: "include",
      keepalive: Boolean(opts?.keepalive),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson: lessonKey, percent, position, complete: Boolean(opts?.complete) }),
    }).catch(() => {});
  }, []);

  const setCertificate = useCallback((cert: AcademyCertificate) => {
    setState((cur) => (cur ? { ...cur, certificate: cert } : { setupRequired: false, lessons: {}, certificate: cert }));
  }, []);

  const value = useMemo(() => ({ state, report, refresh, setCertificate }), [state, report, refresh, setCertificate]);
  return <AcademyProgressContext.Provider value={value}>{children}</AcademyProgressContext.Provider>;
}

export type AcademySummary = {
  ready: boolean;
  setupRequired: boolean;
  lessons: Record<string, AcademyLessonProgress>;
  certificate: AcademyCertificate | null;
  /**
   * True only when a certificate exists AND every current lesson is done. Lessons get added over
   * time, so an older certificate alone never counts as "finished everything".
   */
  certified: boolean;
  completed: number;
  total: number;
  percent: number;
  status: (key: string) => LessonStatus;
  /** First lesson in progress, else the first not yet complete. Null when the course is done. */
  next: AcademyLesson | null;
  report: Ctx["report"];
  setCertificate: Ctx["setCertificate"];
};

/**
 * Progress with derived numbers. `initial` (from the server) is used until the shared copy loads,
 * so Academy pages render complete on first paint.
 */
export function useAcademy(initial?: AcademyProgressState | null): AcademySummary {
  const ctx = useContext(AcademyProgressContext);
  const state = ctx?.state ?? initial ?? null;
  const lessons = state?.lessons ?? {};
  return useMemo(() => {
    const status = (key: string): LessonStatus =>
      lessons[key]?.completedAt ? "done" : (lessons[key]?.percent ?? 0) > 0 ? "progress" : "new";
    const completed = ACADEMY_LESSONS.filter((l) => lessons[l.key]?.completedAt).length;
    const next =
      ACADEMY_LESSONS.find((l) => status(l.key) === "progress") ??
      ACADEMY_LESSONS.find((l) => status(l.key) !== "done") ??
      null;
    return {
      ready: Boolean(state),
      setupRequired: Boolean(state?.setupRequired),
      lessons,
      certificate: state?.certificate ?? null,
      certified: Boolean(state?.certificate) && completed >= ACADEMY_LESSON_COUNT,
      completed,
      total: ACADEMY_LESSON_COUNT,
      percent: Math.round((completed / ACADEMY_LESSON_COUNT) * 100),
      status,
      next,
      report: ctx?.report ?? (() => {}),
      setCertificate: ctx?.setCertificate ?? (() => {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ctx?.report, ctx?.setCertificate]);
}
