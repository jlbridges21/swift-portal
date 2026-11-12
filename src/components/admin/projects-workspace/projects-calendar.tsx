"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, MapPin, User, X } from "lucide-react";
import { ClientViewCalendar } from "@/components/admin/client-view/client-view-calendar";
import { ServicePill, StagePill, type ClientViewProjectRow } from "@/components/admin/client-view/client-view-shared";
import {
  CALENDAR_EVENT_STYLES,
  SHOOT_EVENT_MINUTES,
  addDaysKey,
  addMonthsKey,
  compactTime,
  formatDayKey,
  formatTimeRange,
  groupEventsByDay,
  layoutOverlaps,
  monthGridKeys,
  projectCalendarEvents,
  sameMonthKey,
  todayKey,
  weekKeys,
  zonedDayAndMinutes,
  type ProjectCalendarEvent,
} from "@/lib/projects-calendar";
import { cn } from "@/lib/utils";

type CalendarMode = "month" | "week" | "list";
type CalEvent = ProjectCalendarEvent<ClientViewProjectRow>;

const MODES: { value: CalendarMode; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "list", label: "List" },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_PX = 48;
/** Fills the viewport under the page header + toolbar rows; the page itself barely scrolls. */
const CALENDAR_HEIGHT = "h-[calc(var(--app-height,100dvh)-14.5rem)] min-h-[30rem]";

function eventTitle(p: ClientViewProjectRow) {
  return p.project_name || p.property_address || "Untitled project";
}

/**
 * Projects page Calendar: Month (default) | Week | List over the projects the toolbar's
 * filters already narrowed. A view of ShootPortal projects only — it never writes to Google
 * Calendar; the dedicated Shoot Calendar page stays the place to reschedule.
 */
export function ProjectsCalendar({
  projects,
  heroUrls,
  timeZone,
  canOpenCalendar,
}: {
  projects: ClientViewProjectRow[];
  heroUrls: Record<string, string | null> | null;
  timeZone: string;
  canOpenCalendar: boolean;
}) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [today, setToday] = useState(() => todayKey(timeZone));
  const [anchor, setAnchor] = useState(today);
  const [preview, setPreview] = useState<{ event: CalEvent; el: HTMLElement } | null>(null);
  const [dayPopover, setDayPopover] = useState<{ dayKey: string; el: HTMLElement } | null>(null);

  // Roll "today" over at midnight (business zone) for pages left open.
  useEffect(() => {
    const t = window.setInterval(() => setToday(todayKey(timeZone)), 60_000);
    return () => window.clearInterval(t);
  }, [timeZone]);

  const events = useMemo(() => projectCalendarEvents(projects, timeZone), [projects, timeZone]);
  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const unscheduled = projects.length - events.length;

  const step = (dir: 1 | -1) => setAnchor((a) => (mode === "week" ? addDaysKey(a, dir * 7) : addMonthsKey(a, dir)));
  const week = weekKeys(anchor);
  const title =
    mode === "week"
      ? weekTitle(week[0], week[6])
      : mode === "month"
        ? formatDayKey(anchor, { month: "long", year: "numeric" })
        : "Upcoming shoots";

  const openEvent = (event: CalEvent, el: HTMLElement) => {
    // From the "+ N more" list the chip unmounts with it, so anchor to its "+ N more" button.
    const anchorEl = dayPopover && el.closest('[role="dialog"]') ? dayPopover.el : el;
    setDayPopover(null);
    setPreview({ event, el: anchorEl });
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Project calendar">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border px-2.5 py-2 sm:px-3">
        {mode !== "list" ? (
          <>
            <button
              type="button"
              onClick={() => setAnchor(today)}
              className="h-9 shrink-0 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-heading shadow-sm hover:bg-subtle"
            >
              Today
            </button>
            <div className="flex shrink-0 items-center">
              <IconButton label={mode === "week" ? "Previous week" : "Previous month"} onClick={() => step(-1)}>
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </IconButton>
              <IconButton label={mode === "week" ? "Next week" : "Next month"} onClick={() => step(1)}>
                <ChevronRight className="h-5 w-5" aria-hidden />
              </IconButton>
            </div>
          </>
        ) : null}
        <h2 className="min-w-0 truncate text-base font-semibold text-heading sm:text-lg" aria-live="polite">
          {title}
        </h2>
        {mode !== "list" && unscheduled > 0 ? (
          <span className="hidden shrink-0 text-xs text-muted lg:inline">· {unscheduled} not scheduled</span>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canOpenCalendar && mode !== "list" ? (
            <Link
              href="/admin/calendar"
              className="hidden h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-muted hover:bg-subtle hover:text-heading xl:inline-flex"
            >
              <CalendarDays className="h-4 w-4" aria-hidden /> Shoot Calendar
            </Link>
          ) : null}
          <div role="radiogroup" aria-label="Calendar layout" className="flex rounded-xl border border-border bg-subtle p-0.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "h-8 rounded-lg px-2.5 text-sm font-semibold transition-colors sm:px-3",
                  mode === m.value ? "bg-card text-accent shadow-sm ring-1 ring-border" : "text-muted hover:text-heading"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === "month" ? (
        <MonthGrid
          anchor={anchor}
          today={today}
          byDay={byDay}
          timeZone={timeZone}
          onOpenEvent={openEvent}
          onMore={(dayKey, el) => {
            setPreview(null);
            setDayPopover({ dayKey, el });
          }}
          onOpenDay={(dayKey) => {
            setAnchor(dayKey);
            setMode("week");
          }}
        />
      ) : mode === "week" ? (
        <WeekGrid days={week} today={today} byDay={byDay} timeZone={timeZone} onOpenEvent={openEvent} />
      ) : (
        <div className="p-4 sm:p-5">
          <ClientViewCalendar projects={projects} heroUrls={heroUrls} showClientName canOpenCalendar={canOpenCalendar} />
        </div>
      )}

      {dayPopover ? (
        <Popover anchor={dayPopover.el} onClose={() => setDayPopover(null)} label={formatDayKey(dayPopover.dayKey, { weekday: "long", month: "long", day: "numeric" })}>
          <div className="mb-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{formatDayKey(dayPopover.dayKey, { weekday: "short" })}</p>
            <p className="text-2xl font-semibold text-heading">{Number(dayPopover.dayKey.slice(8))}</p>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {(byDay.get(dayPopover.dayKey) ?? []).map((e) => (
              <EventChip key={e.project.id} event={e} timeZone={timeZone} onOpen={openEvent} />
            ))}
          </div>
        </Popover>
      ) : null}

      {preview ? (
        <Popover anchor={preview.el} onClose={() => setPreview(null)} label={eventTitle(preview.event.project)}>
          <EventPreview event={preview.event} timeZone={timeZone} />
        </Popover>
      ) : null}
    </section>
  );
}

function weekTitle(start: string, end: string) {
  if (sameMonthKey(start, end)) return formatDayKey(start, { month: "long", year: "numeric" });
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return sameYear
    ? `${formatDayKey(start, { month: "short" })} – ${formatDayKey(end, { month: "short", year: "numeric" })}`
    : `${formatDayKey(start, { month: "short", year: "numeric" })} – ${formatDayKey(end, { month: "short", year: "numeric" })}`;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {children}
    </button>
  );
}

// ── Month ───────────────────────────────────────────────────────────────────

function EventChip({ event, timeZone, onOpen, dense = false }: { event: CalEvent; timeZone: string; onOpen: (e: CalEvent, el: HTMLElement) => void; dense?: boolean }) {
  const style = CALENDAR_EVENT_STYLES[event.project.status];
  const time = event.startIso ? compactTime(event.startIso, timeZone) : null;
  const name = eventTitle(event.project);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event, e.currentTarget);
      }}
      title={[time, name].filter(Boolean).join(" · ")}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded-md text-left font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        dense ? "h-5 px-1 text-[11px] sm:px-1.5 sm:text-xs" : "h-7 px-2 text-xs",
        event.allDay ? style.chip : "text-foreground hover:bg-subtle"
      )}
    >
      {!event.allDay ? <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} aria-hidden /> : null}
      {time ? <span className="hidden shrink-0 text-muted sm:inline">{time}</span> : null}
      <span className="min-w-0 truncate">{name}</span>
    </button>
  );
}

function MonthGrid({
  anchor,
  today,
  byDay,
  timeZone,
  onOpenEvent,
  onMore,
  onOpenDay,
}: {
  anchor: string;
  today: string;
  byDay: Map<string, CalEvent[]>;
  timeZone: string;
  onOpenEvent: (e: CalEvent, el: HTMLElement) => void;
  onMore: (dayKey: string, el: HTMLElement) => void;
  onOpenDay: (dayKey: string) => void;
}) {
  const weeks = monthGridKeys(anchor);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(110);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setRowHeight(el.clientHeight / weeks.length);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks.length]);

  // Date label ≈ 28px, each chip ≈ 22px; keep a row for "+ N more" when it's needed.
  const fit = Math.max(1, Math.floor((rowHeight - 30) / 22));

  return (
    <div className={cn("flex min-w-0 flex-col", CALENDAR_HEIGHT)}>
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            <span className="sm:hidden">{d.charAt(0)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div ref={bodyRef} className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((days) => (
          <div key={days[0]} className="grid min-h-0 grid-cols-7 border-b border-border last:border-b-0">
            {days.map((key) => {
              const list = byDay.get(key) ?? [];
              const inMonth = sameMonthKey(key, anchor);
              const isToday = key === today;
              const overflow = list.length > fit;
              const visible = overflow ? list.slice(0, Math.max(0, fit - 1)) : list;
              const day = Number(key.slice(8));
              return (
                <div
                  key={key}
                  className={cn(
                    "flex min-h-0 min-w-0 flex-col gap-px overflow-hidden border-l border-border px-0.5 pb-1 first:border-l-0 sm:px-1",
                    !inMonth && "bg-subtle/40"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenDay(key)}
                    aria-label={`${formatDayKey(key, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${list.length ? `, ${list.length} project${list.length === 1 ? "" : "s"}` : ""}. Open week`}
                    aria-current={isToday ? "date" : undefined}
                    className={cn(
                      "mx-auto mt-1 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-xs font-semibold transition-colors",
                      isToday ? "bg-accent text-accent-foreground" : inMonth ? "text-heading hover:bg-subtle" : "text-muted/70 hover:bg-subtle"
                    )}
                  >
                    {day === 1 && !isToday ? formatDayKey(key, { month: "short", day: "numeric" }) : day}
                  </button>
                  {visible.map((e) => (
                    <EventChip key={e.project.id} event={e} timeZone={timeZone} onOpen={onOpenEvent} dense />
                  ))}
                  {overflow ? (
                    <button
                      type="button"
                      onClick={(ev) => onMore(key, ev.currentTarget)}
                      className="h-5 shrink-0 truncate rounded-md px-1 text-left text-[11px] font-semibold text-muted hover:bg-subtle hover:text-heading sm:px-1.5 sm:text-xs"
                    >
                      +{list.length - visible.length}
                      <span className="hidden sm:inline"> more</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Week ────────────────────────────────────────────────────────────────────

function WeekGrid({
  days,
  today,
  byDay,
  timeZone,
  onOpenEvent,
}: {
  days: string[];
  today: string;
  byDay: Map<string, CalEvent[]>;
  timeZone: string;
  onOpenEvent: (e: CalEvent, el: HTMLElement) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowMin, setNowMin] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMin(zonedDayAndMinutes(new Date(), timeZone)?.minutes ?? null);
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => window.clearInterval(t);
  }, [timeZone]);

  const allDay = days.map((d) => (byDay.get(d) ?? []).filter((e) => e.allDay));
  const timed = days.map((d) => layoutOverlaps((byDay.get(d) ?? []).filter((e) => !e.allDay)));
  const hasAllDay = allDay.some((l) => l.length > 0);
  const showsToday = days.includes(today);

  // Scroll to "now" on this week, otherwise to the first shoot (or 8 AM).
  const weekId = days[0];
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = Math.min(...timed.flat().map((p) => p.event.startMin), Infinity);
    const nowNow = zonedDayAndMinutes(new Date(), timeZone)?.minutes ?? 8 * 60;
    const target = showsToday ? nowNow - 120 : Number.isFinite(first) ? first - 60 : 8 * 60;
    el.scrollTop = Math.max(0, (target / 60) * HOUR_PX);
    // Phones scroll the week sideways: bring today's column into view (next to the hour gutter).
    el.scrollLeft = 0;
    const todayCol = showsToday ? el.querySelector<HTMLElement>('[aria-current="date"]') : null;
    if (todayCol && el.scrollWidth > el.clientWidth) {
      const gutter = el.querySelector<HTMLElement>(".sticky.left-0")?.offsetWidth ?? 52;
      el.scrollLeft = todayCol.getBoundingClientRect().left - el.getBoundingClientRect().left - gutter;
    }
    // Only when the week changes — not on every data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  const cols = "grid-cols-[3.25rem_repeat(7,minmax(5.5rem,1fr))] sm:grid-cols-[3.75rem_repeat(7,minmax(0,1fr))]";

  return (
    <div ref={scrollRef} className={cn("min-w-0 overflow-auto overscroll-contain [scrollbar-width:thin]", CALENDAR_HEIGHT)}>
      <div className="min-w-[42rem] sm:min-w-0">
        {/* Sticky day header (+ all-day row) */}
        <div className="sticky top-0 z-20 border-b border-border bg-card">
          <div className={cn("grid", cols)}>
            <div className="sticky left-0 z-10 bg-card" />
            {days.map((d) => {
              const isToday = d === today;
              return (
                <div key={d} className="border-l border-border py-1.5 text-center" aria-current={isToday ? "date" : undefined}>
                  <p className={cn("text-[11px] font-semibold uppercase tracking-wide", isToday ? "text-accent" : "text-muted")}>
                    {formatDayKey(d, { weekday: "short" })}
                  </p>
                  <p
                    className={cn(
                      "mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold",
                      isToday ? "bg-accent text-accent-foreground" : "text-heading"
                    )}
                  >
                    {Number(d.slice(8))}
                  </p>
                </div>
              );
            })}
          </div>
          {hasAllDay ? (
            <div className={cn("grid border-t border-border", cols)}>
              <div className="sticky left-0 z-10 flex items-start justify-end bg-card py-1 pr-2 text-[10px] font-medium uppercase text-muted" title="Shoot date set, time not confirmed">
                All day
              </div>
              {allDay.map((list, i) => (
                <div key={days[i]} className="min-w-0 space-y-px border-l border-border p-0.5">
                  {list.map((e) => (
                    <EventChip key={e.project.id} event={e} timeZone={timeZone} onOpen={onOpenEvent} dense />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Time grid */}
        <div className={cn("relative grid", cols)} style={{ height: HOUR_PX * 24 }}>
          <div className="sticky left-0 z-10 bg-card">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative pr-2 text-right text-[10px] text-muted" style={{ height: HOUR_PX }}>
                {h > 0 ? <span className="absolute -top-2 right-2">{hourLabel(h)}</span> : null}
              </div>
            ))}
          </div>
          {days.map((d, i) => (
            <div key={d} className={cn("relative border-l border-border", d === today && "bg-accent-subtle/25")}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="border-b border-border/60" style={{ height: HOUR_PX }} aria-hidden />
              ))}
              {timed[i].map(({ event, column, columns }) => {
                const style = CALENDAR_EVENT_STYLES[event.project.status];
                const top = (event.startMin / 60) * HOUR_PX;
                const height = Math.max(22, ((event.endMin - event.startMin) / 60) * HOUR_PX - 2);
                const width = 100 / columns;
                const roomy = height >= 44;
                return (
                  <button
                    key={event.project.id}
                    type="button"
                    onClick={(e) => onOpenEvent(event, e.currentTarget)}
                    className={cn(
                      "absolute z-[1] overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ring-1 ring-card transition-[filter] hover:z-[2] hover:brightness-95 focus-visible:z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      style.block
                    )}
                    style={{ top: top + 1, height, left: `calc(${column * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                    title={`${eventTitle(event.project)} · ${event.startIso ? formatTimeRange(event.startIso, SHOOT_EVENT_MINUTES, timeZone) : ""}`}
                  >
                    <span className="block truncate font-semibold">{eventTitle(event.project)}</span>
                    {roomy ? (
                      <>
                        <span className="block truncate opacity-80">{event.startIso ? compactTime(event.startIso, timeZone) : null}</span>
                        <span className="block truncate opacity-80">{event.project.clients?.name || event.project.property_address}</span>
                      </>
                    ) : null}
                  </button>
                );
              })}
              {d === today && nowMin !== null ? (
                <div className="pointer-events-none absolute inset-x-0 z-[3] flex items-center" style={{ top: (nowMin / 60) * HOUR_PX }} aria-hidden>
                  <span className="-ml-1.5 h-3 w-3 rounded-full bg-red-500" />
                  <span className="h-0.5 flex-1 bg-red-500" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function hourLabel(h: number) {
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
}

// ── Popover + event preview ─────────────────────────────────────────────────

function EventPreview({ event, timeZone }: { event: CalEvent; timeZone: string }) {
  const p = event.project;
  const style = CALENDAR_EVENT_STYLES[p.status];
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 pr-7">
        <span className={cn("mt-1.5 h-3 w-3 shrink-0 rounded", style.dot)} aria-hidden />
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-heading">{eventTitle(p)}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {formatDayKey(event.dayKey, { weekday: "long", month: "long", day: "numeric" })}
            {event.startIso ? ` · ${formatTimeRange(event.startIso, SHOOT_EVENT_MINUTES, timeZone)}` : " · Time not confirmed"}
          </p>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        {p.property_address && p.property_address !== p.project_name ? (
          <p className="flex items-start gap-2 text-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0">{p.property_address}</span>
          </p>
        ) : null}
        {p.clients?.name ? (
          <p className="flex items-center gap-2 text-foreground">
            <User className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{p.clients.name}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <StagePill status={p.status} />
          <ServicePill service={p.service_type} />
        </div>
      </div>
      <Link
        href={`/admin/projects/${p.id}`}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-accent-foreground shadow-sm hover:opacity-90"
      >
        <ExternalLink className="h-4 w-4" aria-hidden /> Open Project
      </Link>
    </div>
  );
}

/** Anchored card on desktop, bottom sheet on phones. Escape / outside click closes. */
function Popover({ anchor, onClose, label, children }: { anchor: HTMLElement; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [sheet, setSheet] = useState(false);

  useLayoutEffect(() => {
    const isSheet = window.matchMedia("(max-width: 639px)").matches;
    setSheet(isSheet);
    if (isSheet) return;
    const r = anchor.getBoundingClientRect();
    const w = ref.current?.offsetWidth ?? 320;
    const h = ref.current?.offsetHeight ?? 220;
    const pad = 8;
    let left = r.right + pad;
    if (left + w > window.innerWidth - pad) left = r.left - w - pad;
    if (left < pad) left = Math.min(window.innerWidth - w - pad, Math.max(pad, r.left));
    let top = r.top;
    if (top + h > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - h - pad);
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  const target = (anchor.closest("[data-surface]") as HTMLElement | null) ?? document.body;
  return createPortal(
    <>
      {sheet ? <div className="fixed inset-0 z-[80] bg-black/30" aria-hidden /> : null}
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        className={cn(
          "fixed z-[81] border border-border bg-card p-4 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.35)]",
          sheet
            ? "inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "w-80 rounded-2xl"
        )}
        style={sheet ? undefined : pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-heading"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        {children}
      </div>
    </>,
    target
  );
}
