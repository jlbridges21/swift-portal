"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Hourglass,
  LifeBuoy,
  Link as LinkIcon,
  ListVideo,
  Loader2,
  Lock,
  Mail,
  Play,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACADEMY_CLIENT_GUIDE,
  ACADEMY_MODULES,
  ACADEMY_LESSONS,
  academyLessonHref,
  academyYoutubeUrl,
  formatDuration,
  lessonNumber,
  moduleLessons,
  type AcademyLesson,
  type AcademyModuleId,
} from "@/lib/academy/catalog";
import type { AcademyProgressState } from "@/lib/academy/server";
import { useAcademy, type AcademySummary } from "@/components/academy/academy-progress";
import { LessonThumb } from "@/components/academy/lesson-thumb";
import { CertificateDialog } from "@/components/academy/certificate-dialog";
import { cn } from "@/lib/utils";

type Filter = "all" | "todo" | "done";

function minutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

function ProgressRing({ percent, size = 112, stroke = 7 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * percent) / 100} ${c}`}
        className="stroke-emerald-500 transition-[stroke-dasharray] duration-500"
      />
    </svg>
  );
}

export function AcademyCourse({
  initial,
  holderName,
  businessName,
  verifyOrigin,
  isStaff,
}: {
  initial: AcademyProgressState;
  holderName: string;
  businessName: string | null;
  verifyOrigin: string;
  isStaff: boolean;
}) {
  const a = useAcademy(initial);
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<AcademyModuleId>>(() => {
    const next = ACADEMY_LESSONS.find((l) => !initial.lessons[l.key]?.completedAt);
    return new Set<AcademyModuleId>(next && next.module ? [next.module as AcademyModuleId] : [1]);
  });
  const [certOpen, setCertOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);

  const watchedSeconds = useMemo(
    () =>
      ACADEMY_LESSONS.reduce((s, l) => {
        const p = a.lessons[l.key];
        return s + (p?.completedAt ? l.durationSeconds : ((p?.percent ?? 0) / 100) * l.durationSeconds);
      }, 0),
    [a.lessons]
  );
  const totalSeconds = ACADEMY_LESSONS.reduce((s, l) => s + l.durationSeconds, 0);
  const next = a.next;
  const nextModule = next ? (next.module as AcademyModuleId) : null;
  const nextModuleLeft = nextModule ? moduleLessons(nextModule).filter((l) => a.status(l.key) !== "done") : [];
  const q = query.trim().toLowerCase();
  const filtering = filter !== "all" || q.length > 0;

  const visible = (l: AcademyLesson) =>
    (filter === "all" || (filter === "done" ? a.status(l.key) === "done" : a.status(l.key) !== "done")) &&
    (!q || `${l.title} ${l.description}`.toLowerCase().includes(q));

  function toggle(id: AcademyModuleId) {
    setOpen((cur) => {
      const s = new Set(cur);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function openCertificate() {
    if (a.certificate || a.completed < a.total) {
      setCertOpen(true);
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch("/api/academy/certificate", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (data?.certificate) a.setCertificate(data.certificate);
    } finally {
      setClaiming(false);
      setCertOpen(true);
    }
  }

  async function copyClientLink() {
    const url = academyYoutubeUrl(ACADEMY_CLIENT_GUIDE);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  const resumeLeft = next ? next.durationSeconds - (a.lessons[next.key]?.position ?? 0) : 0;

  // /admin/academy?certificate=1 (from the last lesson) opens the certificate right away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("certificate") !== "1") return;
    window.history.replaceState(window.history.state, "", "/admin/academy");
    void openCertificate();
    // Run once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {a.setupRequired && !isStaff ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Progress isn&apos;t being saved yet. Run <code className="font-mono">supabase/migration-v130-academy.sql</code> to turn it on.
          </p>
        ) : null}

        {/* Progress + continue */}
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Your course progress</p>
            <h2 className="mt-1.5 text-xl font-extrabold tracking-tight text-heading sm:text-2xl">
              {a.completed === 0
                ? "Learn ShootPortal in short videos."
                : a.completed === a.total
                  ? `You finished the course, ${holderName.split(" ")[0]}!`
                  : `Nice work, ${holderName.split(" ")[0]}. You're ${a.percent}% of the way there.`}
            </h2>
            <div className="mt-4 flex items-baseline gap-2.5">
              <b className="text-3xl font-extrabold tracking-tight text-heading tabular-nums">
                {a.completed} of {a.total}
              </b>
              <span className="text-sm text-muted">lessons complete</span>
              <span className="ml-auto text-lg font-extrabold text-emerald-600 tabular-nums">{a.percent}%</span>
            </div>
            <div className="mt-3 flex gap-1" aria-hidden>
              {ACADEMY_MODULES.map((m) => {
                const ls = moduleLessons(m.id);
                const share = ls.reduce((s, l) => s + (a.status(l.key) === "done" ? 1 : (a.lessons[l.key]?.percent ?? 0) / 100), 0);
                return (
                  <div key={m.id} className="h-2.5 overflow-hidden rounded-full bg-border/70" style={{ flex: ls.length }} title={m.title}>
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(share / ls.length) * 100}%` }} />
                  </div>
                );
              })}
            </div>
            <div
              className="sr-only"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={a.total}
              aria-valuenow={a.completed}
              aria-label="Course progress"
            />
            {nextModule && nextModuleLeft.length ? (
              <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-foreground">
                <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-semibold text-accent">Next milestone</span>
                Finish <b className="text-heading">{ACADEMY_MODULES[nextModule - 1].title}</b>
                <span className="text-muted">
                  ({nextModuleLeft.length} lesson{nextModuleLeft.length === 1 ? "" : "s"}, about{" "}
                  {minutes(nextModuleLeft.reduce((s, l) => s + l.durationSeconds, 0))})
                </span>
              </p>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-5 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden /> <b className="text-heading">{minutes(watchedSeconds)}</b> watched
              </span>
              <span className="flex items-center gap-1.5">
                <Hourglass className="h-4 w-4" aria-hidden /> <b className="text-heading">{minutes(totalSeconds - watchedSeconds)}</b> to go
              </span>
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4" aria-hidden /> Certificate at <b className="text-heading">{a.total}/{a.total}</b>
              </span>
            </div>
          </div>

          {next ? (
            <Link
              href={academyLessonHref(next)}
              className="group flex w-full shrink-0 flex-col gap-3 rounded-xl bg-slate-950 p-3.5 text-white transition hover:ring-2 hover:ring-accent lg:w-[380px]"
            >
              <span className="flex justify-between text-xs font-bold uppercase tracking-[0.08em] text-indigo-200">
                <span>{a.status(next.key) === "progress" ? "Continue learning" : a.completed ? "Up next" : "Start here"}</span>
                <span>
                  Lesson {lessonNumber(next)} of {a.total}
                </span>
              </span>
              <LessonThumb
                lesson={next}
                status={a.status(next.key)}
                percent={a.lessons[next.key]?.percent ?? 0}
                durationLabel={a.status(next.key) === "progress" ? `${formatDuration(resumeLeft)} left` : undefined}
              />
              <span className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold leading-snug">{next.title}</span>
                  <span className="block text-xs text-slate-300">
                    {ACADEMY_MODULES[(next.module as number) - 1].title} · {formatDuration(next.durationSeconds)}
                  </span>
                </span>
                <span className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground group-hover:bg-accent-hover">
                  <Play className="h-4 w-4" aria-hidden /> {a.status(next.key) === "progress" ? "Resume" : "Play"}
                </span>
              </span>
            </Link>
          ) : null}
        </section>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Filter lessons">
            {(
              [
                ["all", "All lessons", a.total],
                ["todo", "To watch", a.total - a.completed],
                ["done", "Completed", a.completed],
              ] as const
            ).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  filter === id ? "bg-accent-subtle text-accent" : "text-muted hover:text-heading"
                )}
              >
                {label} <span className="font-medium text-muted">{n}</span>
              </button>
            ))}
          </div>
          {next ? (
            <Button variant="outline" className="gap-2" onClick={() => router.push(`${academyLessonHref(next)}?autoplay=1`)}>
              <ListVideo className="h-4 w-4" aria-hidden /> Play all in order
            </Button>
          ) : null}
          <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted focus-within:border-accent sm:ml-auto sm:w-72">
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <input
              id="academy-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lessons…"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted"
            />
          </label>
        </div>

        {/* Modules */}
        <div className="flex flex-col gap-4">
          {ACADEMY_MODULES.map((m) => {
            const ls = moduleLessons(m.id);
            const shown = ls.filter(visible);
            if (filtering && !shown.length) return null;
            const done = ls.filter((l) => a.status(l.key) === "done").length;
            const complete = done === ls.length;
            const isOpen = filtering || open.has(m.id);
            return (
              <section key={m.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3.5 px-4 py-4 text-left hover:bg-subtle/60 sm:px-5"
                >
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                      complete ? "bg-emerald-600 text-white" : "bg-accent-subtle text-accent"
                    )}
                  >
                    {complete ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : m.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-heading">{m.title}</span>
                    <span className="block text-xs text-muted">
                      {ls.length} lesson{ls.length === 1 ? "" : "s"} · {minutes(ls.reduce((s, l) => s + l.durationSeconds, 0))}
                    </span>
                  </span>
                  {complete ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Complete
                    </span>
                  ) : (
                    <span className="hidden items-center gap-2.5 sm:flex">
                      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-border/70">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(done / ls.length) * 100}%` }} />
                      </span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {done}/{ls.length}
                      </span>
                    </span>
                  )}
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted" aria-hidden /> : <ChevronDown className="h-4 w-4 text-muted" aria-hidden />}
                </button>
                {isOpen ? (
                  <ul className="grid grid-cols-1 gap-4 px-4 pb-5 pt-1 sm:grid-cols-2 sm:px-5 lg:grid-cols-3 2xl:grid-cols-4">
                    {(filtering ? shown : ls).map((l) => (
                      <li key={l.key}>
                        <LessonCard lesson={l} a={a} upNext={next?.key === l.key} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
          {filtering && !ACADEMY_LESSONS.some(visible) ? (
            <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted">
              No lessons match. Try another word, or show all lessons.
            </p>
          ) : null}
        </div>
      </div>

      {/* Right rail */}
      <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[320px]">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-accent-subtle to-transparent" aria-hidden />
          <div className="relative mx-auto h-28 w-28">
            <ProgressRing percent={a.certificate ? 100 : a.percent} />
            <span className="absolute inset-[14px] flex items-center justify-center rounded-full bg-accent text-accent-foreground shadow-inner">
              <Award className="h-9 w-9" strokeWidth={1.7} aria-hidden />
            </span>
            {!a.certificate ? (
              <span className="absolute bottom-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted">
                <Lock className="h-3.5 w-3.5" aria-hidden />
              </span>
            ) : null}
          </div>
          <h3 className="relative mt-3 text-base font-extrabold text-heading">ShootPortal Certified</h3>
          <p className="relative mt-1.5 text-sm leading-relaxed text-muted">
            {a.certificate
              ? "You earned it. Download it, add it to LinkedIn, or share the verify link."
              : a.completed === a.total
                ? "You finished every lesson. Claim your certificate."
                : `Finish all ${a.total} lessons to earn your certificate and add it to LinkedIn.`}
          </p>
          {!a.certificate ? (
            <div className="relative mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-border/70">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${a.percent}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted">
                <span>{a.completed} done</span>
                <span>{a.total - a.completed} to go</span>
              </div>
            </div>
          ) : null}
          <Button
            variant={a.certificate || a.completed === a.total ? "accent" : "outline"}
            className="relative mt-4 w-full gap-2"
            onClick={openCertificate}
            disabled={claiming}
          >
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : a.certificate || a.completed === a.total ? <Award className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            {a.certificate ? "View certificate" : a.completed === a.total ? "Claim certificate" : "Preview certificate"}
          </Button>
        </section>

        {!isStaff ? (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-heading">
              <Send className="h-4 w-4 text-muted" aria-hidden /> Share with your clients
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              A short guide with no ShootPortal branding that shows clients how to approve, pay and download in your portal.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <LessonThumb lesson={ACADEMY_CLIENT_GUIDE} size="sm" className="w-28 shrink-0" durationLabel={formatDuration(ACADEMY_CLIENT_GUIDE.durationSeconds)} />
              <a
                href={academyYoutubeUrl(ACADEMY_CLIENT_GUIDE)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold leading-snug text-heading hover:text-accent"
              >
                {ACADEMY_CLIENT_GUIDE.title}
              </a>
            </div>
            <Button variant="outline" className="mt-3 w-full gap-2" onClick={copyClientLink}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <LinkIcon className="h-4 w-4" aria-hidden />}
              {copied ? "Link copied" : "Copy link for clients"}
            </Button>
          </section>
        ) : null}

        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-heading">
            <LifeBuoy className="h-4 w-4 text-muted" aria-hidden /> Need a hand?
          </h3>
          <p className="mt-1.5 text-sm text-muted">Stuck on something the videos don&apos;t cover? Email us and a real person will help.</p>
          <a
            href="mailto:support@shootportal.app"
            className="mt-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-subtle"
          >
            <Mail className="h-4 w-4 text-muted" aria-hidden /> support@shootportal.app
          </a>
        </section>
      </aside>

      <CertificateDialog
        open={certOpen}
        onClose={() => setCertOpen(false)}
        holderName={holderName}
        businessName={businessName}
        cert={a.certificate}
        remaining={a.total - a.completed}
        verifyOrigin={verifyOrigin}
      />
    </div>
  );
}

function LessonCard({ lesson, a, upNext }: { lesson: AcademyLesson; a: AcademySummary; upNext: boolean }) {
  const status = a.status(lesson.key);
  const pct = a.lessons[lesson.key]?.percent ?? 0;
  return (
    <Link href={academyLessonHref(lesson)} className="group flex flex-col gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <LessonThumb
        lesson={lesson}
        status={status}
        percent={pct}
        upNext={upNext}
        className={cn("transition group-hover:brightness-105", upNext && "ring-[3px] ring-accent")}
      />
      <span className="text-[15px] font-bold leading-snug text-heading group-hover:text-accent">{lesson.title}</span>
      <span className="line-clamp-2 text-[13px] leading-relaxed text-muted">{lesson.description}</span>
      <span className="flex items-center gap-2 text-xs text-muted">
        Lesson {lessonNumber(lesson)}
        <span className="ml-auto">
          {status === "done" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> Watched
            </span>
          ) : status === "progress" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-1 font-semibold text-accent">
              <Play className="h-3 w-3" aria-hidden /> {pct}% watched
            </span>
          ) : (
            <span className="rounded-full bg-subtle px-2.5 py-1 font-semibold text-muted">Not started</span>
          )}
        </span>
      </span>
    </Link>
  );
}
