"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, ExternalLink, Loader2, MapPin, User, Users, X } from "lucide-react";
import { ClientViewCalendar } from "@/components/admin/client-view/client-view-calendar";
import {
  RescheduleConfirmModal,
  TIMED_RESCHEDULE_NOTE,
  WeekTimeGrid,
  rescheduleErrorMessage,
  saveShootTime,
  useEventDrag,
  type DragApi as SharedDragApi,
  type DragBindProps,
} from "@/components/admin/calendar/week-time-grid";
import { ServicePill, StagePill, type ClientViewProjectRow } from "@/components/admin/client-view/client-view-shared";
import {
  CALENDAR_EVENT_STYLES,
  SHOOT_EVENT_MINUTES,
  SNAP_MINUTES,
  describeSlot,
  hhmmToMinutes,
  minutesToHHMM,
  snapMinutes,
  zonedTimeToIso,
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

export type CalendarStaffOption = { id: string; email: string; full_name: string | null };

export type ProjectsCalendarPermissions = {
  /** projects.manage_staff — staff picker in the event preview. */
  canManageStaff: boolean;
  /** scheduling.confirm — move a confirmed shoot (same rule as the Shoot Calendar). */
  canReschedule: boolean;
  /** projects.edit — move a date-only shoot (no confirmed time yet). */
  canEditDate: boolean;
};

type PendingMove = { event: CalEvent; toDay: string; toIso: string | null };

/** Drag + click wiring shared by the Month and Week grids. */
type DragApi = SharedDragApi<CalEvent>;

/**
 * Projects page Calendar: Month (default) | Week | List over the projects the toolbar's
 * filters already narrowed. Shoots can be dragged to a new day (Month) or day + time
 * (Week, 15-minute snap) and, after confirmation, are saved through the same endpoints the
 * Shoot Calendar uses — so Google Calendar sync, activity logs and the client's reschedule
 * notification behave exactly as they do there. Nothing is saved or sent before Confirm.
 */
export function ProjectsCalendar({
  projects,
  heroUrls,
  timeZone,
  canOpenCalendar,
  staff = [],
  projectStaffIds = {},
  permissions = { canManageStaff: false, canReschedule: false, canEditDate: false },
}: {
  projects: ClientViewProjectRow[];
  heroUrls: Record<string, string | null> | null;
  timeZone: string;
  canOpenCalendar: boolean;
  staff?: CalendarStaffOption[];
  projectStaffIds?: Record<string, string[]>;
  permissions?: ProjectsCalendarPermissions;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [today, setToday] = useState(() => todayKey(timeZone));
  const [anchor, setAnchor] = useState(today);
  const [preview, setPreview] = useState<{ event: CalEvent; el: HTMLElement } | null>(null);
  const [dayPopover, setDayPopover] = useState<{ dayKey: string; el: HTMLElement } | null>(null);
  const suppressClick = useRef(false);

  // Roll "today" over at midnight (business zone) for pages left open.
  useEffect(() => {
    const t = window.setInterval(() => setToday(todayKey(timeZone)), 60_000);
    return () => window.clearInterval(t);
  }, [timeZone]);

  // ── Schedule moves: shown at once (optimistic), dropped on Cancel / failure / fresh data ──
  const [moves, setMoves] = useState<Record<string, Pick<ClientViewProjectRow, "confirmedShootAt" | "shoot_date">>>({});
  const [movesFor, setMovesFor] = useState(projects);
  if (movesFor !== projects) {
    setMovesFor(projects);
    setMoves({});
  }
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const shown = useMemo(() => projects.map((p) => (moves[p.id] ? { ...p, ...moves[p.id] } : p)), [projects, moves]);
  const events = useMemo(() => projectCalendarEvents(shown, timeZone), [shown, timeZone]);
  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const unscheduled = projects.length - events.length;

  const canDrag = (e: CalEvent) =>
    e.allDay ? permissions.canEditDate : permissions.canReschedule && Boolean(e.project.confirmedShootId);

  function clearMove(id: string) {
    setMoves((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
  }

  function requestMove(event: CalEvent, toDay: string, toMin: number) {
    if (savingRef.current || pending) return;
    const toIso = event.allDay ? null : zonedTimeToIso(toDay, toMin, timeZone);
    if (event.allDay ? toDay === event.dayKey : toIso === event.startIso) return;
    setPreview(null);
    setDayPopover(null);
    setMoves((m) => ({
      ...m,
      [event.project.id]: event.allDay ? { shoot_date: toDay, confirmedShootAt: null } : { confirmedShootAt: toIso, shoot_date: toDay },
    }));
    setPending({ event, toDay, toIso });
  }

  function cancelMove() {
    if (savingRef.current || !pending) return;
    clearMove(pending.event.project.id);
    setPending(null);
  }

  async function confirmMove() {
    if (savingRef.current || !pending) return;
    savingRef.current = true;
    setSaving(true);
    const { event, toDay, toIso } = pending;
    try {
      if (event.allDay) {
        const res = await fetch("/api/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: event.project.id, shoot_date: toDay }),
        });
        if (!res.ok) throw new Error(await rescheduleErrorMessage(res));
      } else {
        await saveShootTime(String(event.project.confirmedShootId ?? ""), toIso ?? "");
      }
      toast.success(`${eventTitle(event.project)} moved to ${describeSlot(toDay, toIso, timeZone)}`);
      router.refresh();
    } catch (err) {
      clearMove(event.project.id);
      toast.error(err instanceof Error ? err.message : "Couldn’t reschedule the shoot.");
    } finally {
      savingRef.current = false;
      setSaving(false);
      setPending(null);
    }
  }

  const dragApi: DragApi = { canDrag, drop: requestMove, suppressClick };

  // ── Staff assignment (auto-saves when the picker closes; survives the popover closing) ──
  const staffSaver = useStaffSaver(projectStaffIds, staff);

  const step = (dir: 1 | -1) => setAnchor((a) => (mode === "week" ? addDaysKey(a, dir * 7) : addMonthsKey(a, dir)));
  const week = weekKeys(anchor);
  const title =
    mode === "week"
      ? weekTitle(week[0], week[6])
      : mode === "month"
        ? formatDayKey(anchor, { month: "long", year: "numeric" })
        : "Upcoming shoots";

  const openEvent = (event: CalEvent, el: HTMLElement) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    // From the "+ N more" list the chip unmounts with it, so anchor to its "+ N more" button.
    const anchorEl = dayPopover && el.closest('[role="dialog"]') ? dayPopover.el : el;
    setDayPopover(null);
    setPreview({ event, el: anchorEl });
  };
  // Keep the open preview in step with optimistic moves / fresh data.
  const previewEvent = preview ? events.find((e) => e.project.id === preview.event.project.id) ?? preview.event : null;

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
          drag={dragApi}
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
        <WeekTimeGrid
          className={CALENDAR_HEIGHT}
          days={week}
          today={today}
          byDay={byDay}
          timeZone={timeZone}
          drag={dragApi}
          onOpenEvent={openEvent}
          eventKey={(e) => e.project.id}
          allDayHint="Shoot date set, time not confirmed"
          ghostLabel={(e) => eventTitle(e.project)}
          renderAllDay={(e) => <EventChip event={e} timeZone={timeZone} onOpen={openEvent} dense />}
          blockAppearance={(e) => ({
            className: CALENDAR_EVENT_STYLES[e.project.status].block,
            title: `${eventTitle(e.project)} · ${e.startIso ? formatTimeRange(e.startIso, SHOOT_EVENT_MINUTES, timeZone) : ""}`,
          })}
          renderBlock={(e, roomy) => (
            <>
              <span className="block truncate font-semibold">{eventTitle(e.project)}</span>
              {roomy ? (
                <>
                  <span className="block truncate opacity-80">{e.startIso ? compactTime(e.startIso, timeZone) : null}</span>
                  <span className="block truncate opacity-80">{e.project.clients?.name || e.project.property_address}</span>
                </>
              ) : null}
            </>
          )}
        />
      ) : (
        <div className="p-4 sm:p-5">
          <ClientViewCalendar projects={shown} heroUrls={heroUrls} showClientName canOpenCalendar={canOpenCalendar} />
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

      {preview && previewEvent ? (
        <Popover anchor={preview.el} onClose={() => setPreview(null)} label={eventTitle(previewEvent.project)}>
          <EventPreview
            event={previewEvent}
            timeZone={timeZone}
            staff={staff}
            staffSaver={staffSaver}
            canManageStaff={permissions.canManageStaff}
            canMove={canDrag(previewEvent)}
            onReschedule={(toDay, toMin) => requestMove(previewEvent, toDay, toMin)}
          />
        </Popover>
      ) : null}

      <RescheduleConfirmModal
        open={!!pending}
        title={pending ? eventTitle(pending.event.project) : ""}
        fromLabel={pending ? describeSlot(pending.event.dayKey, pending.event.startIso, timeZone) : ""}
        toLabel={pending ? describeSlot(pending.toDay, pending.toIso, timeZone) : ""}
        note={pending?.event.allDay ? "Only the shoot date changes. No time has been confirmed yet." : TIMED_RESCHEDULE_NOTE}
        saving={saving}
        onCancel={cancelMove}
        onConfirm={() => void confirmMove()}
      />
    </section>
  );
}

// ── Staff assignment saver ───────────────────────────────────────────────────

type StaffSaveState = "saving" | "saved" | "error";
type StaffSaver = {
  assigned: (projectId: string) => string[];
  state: (projectId: string) => StaffSaveState | undefined;
  commit: (projectId: string, next: string[]) => void;
};

/**
 * Applies a picker's final selection as adds/removes through /api/project-staff (the same
 * endpoint as the project page). Lives above the popover so a save in flight finishes even
 * if the popover closes; failures roll that project back and say so.
 */
function useStaffSaver(projectStaffIds: Record<string, string[]>, staff: CalendarStaffOption[]): StaffSaver {
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, string[]>>({});
  const [states, setStates] = useState<Record<string, StaffSaveState>>({});
  const [localFor, setLocalFor] = useState(projectStaffIds);
  if (localFor !== projectStaffIds) {
    setLocalFor(projectStaffIds);
    setLocal({});
  }
  const inFlight = useRef<Record<string, Promise<void>>>({});
  // Read the latest selection after awaiting an earlier save (not the closure's copy).
  const latest = useRef({ local, projectStaffIds });
  useLayoutEffect(() => {
    latest.current = { local, projectStaffIds };
  });
  const assigned = (id: string) => local[id] ?? projectStaffIds[id] ?? [];

  function commit(projectId: string, next: string[]) {
    const run = async () => {
      // Wait for an earlier save on this project so requests never interleave.
      await inFlight.current[projectId];
      const before = latest.current.local[projectId] ?? latest.current.projectStaffIds[projectId] ?? [];
      const valid = new Set(staff.map((s) => s.id));
      const target = [...new Set(next)].filter((id) => valid.has(id) || before.includes(id));
      const adds = target.filter((id) => !before.includes(id));
      const removes = before.filter((id) => !target.includes(id));
      if (!adds.length && !removes.length) return;
      setLocal((l) => ({ ...l, [projectId]: target }));
      setStates((s) => ({ ...s, [projectId]: "saving" }));
      const results = await Promise.all([
        ...adds.map((user_id) =>
          fetch("/api/project-staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ project_id: projectId, user_id }),
          }).then((r) => (r.ok ? null : user_id), () => user_id)
        ),
        ...removes.map((user_id) =>
          fetch(`/api/project-staff?project_id=${encodeURIComponent(projectId)}&user_id=${encodeURIComponent(user_id)}`, {
            method: "DELETE",
            credentials: "include",
          }).then((r) => (r.ok ? null : user_id), () => user_id)
        ),
      ]);
      const failed = new Set(results.filter((x): x is string => !!x));
      if (failed.size) {
        // Roll back only what failed: a failed add isn't assigned, a failed remove still is.
        setLocal((l) => ({
          ...l,
          [projectId]: [...target.filter((id) => !(failed.has(id) && adds.includes(id))), ...removes.filter((id) => failed.has(id))],
        }));
        setStates((s) => ({ ...s, [projectId]: "error" }));
        toast.error(`Couldn’t update ${failed.size === 1 ? "one staff assignment" : `${failed.size} staff assignments`}. Please try again.`);
      } else {
        setStates((s) => ({ ...s, [projectId]: "saved" }));
      }
      if (failed.size < adds.length + removes.length) router.refresh();
    };
    const p = run();
    inFlight.current[projectId] = p.catch(() => undefined);
  }

  return { assigned, state: (id) => states[id], commit };
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

function EventChip({
  event,
  timeZone,
  onOpen,
  dense = false,
  dragProps,
  dimmed = false,
}: {
  event: CalEvent;
  timeZone: string;
  onOpen: (e: CalEvent, el: HTMLElement) => void;
  dense?: boolean;
  dragProps?: DragBindProps;
  dimmed?: boolean;
}) {
  const style = CALENDAR_EVENT_STYLES[event.project.status];
  const time = event.startIso ? compactTime(event.startIso, timeZone) : null;
  const name = eventTitle(event.project);
  const draggable = Boolean(dragProps && "onPointerDown" in dragProps);
  return (
    <button
      type="button"
      {...dragProps}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event, e.currentTarget);
      }}
      title={[time, name].filter(Boolean).join(" · ") + (draggable ? " — drag to reschedule" : "")}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded-md text-left font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        dense ? "h-5 px-1 text-[11px] sm:px-1.5 sm:text-xs" : "h-7 px-2 text-xs",
        event.allDay ? style.chip : "text-foreground hover:bg-subtle",
        draggable && "cursor-grab active:cursor-grabbing",
        dimmed && "opacity-40"
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
  drag,
  onOpenEvent,
  onMore,
  onOpenDay,
}: {
  anchor: string;
  today: string;
  byDay: Map<string, CalEvent[]>;
  timeZone: string;
  drag: DragApi;
  onOpenEvent: (e: CalEvent, el: HTMLElement) => void;
  onMore: (dayKey: string, el: HTMLElement) => void;
  onOpenDay: (dayKey: string) => void;
}) {
  const weeks = monthGridKeys(anchor);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(110);
  const [over, setOver] = useState<{ day: string | null; x: number; y: number } | null>(null);
  const overDay = useRef<string | null>(null);

  const { bind, dragging } = useEventDrag(drag, {
    onMove: (_s, x, y) => {
      // Only real day cells are drop targets; anywhere else drops nothing.
      const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-month-day]");
      const day = cell && bodyRef.current?.contains(cell) ? cell.dataset.monthDay ?? null : null;
      overDay.current = day;
      setOver({ day, x, y });
    },
    onEnd: (s) => {
      const day = overDay.current;
      overDay.current = null;
      setOver(null);
      // Same day → nothing to save. The time and duration stay as they are.
      if (day && day !== s.event.dayKey) drag.drop(s.event, day, s.event.startMin);
    },
    onCancel: () => {
      overDay.current = null;
      setOver(null);
    },
  });

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
              const isTarget = dragging && over?.day === key;
              return (
                <div
                  key={key}
                  data-month-day={key}
                  className={cn(
                    "flex min-h-0 min-w-0 flex-col gap-px overflow-hidden border-l border-border px-0.5 pb-1 transition-colors first:border-l-0 sm:px-1",
                    !inMonth && "bg-subtle/40",
                    isTarget && (key === dragging.dayKey ? "bg-subtle" : "bg-accent/10 ring-2 ring-inset ring-accent")
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
                    <EventChip
                      key={e.project.id}
                      event={e}
                      timeZone={timeZone}
                      onOpen={onOpenEvent}
                      dense
                      dragProps={bind(e)}
                      dimmed={dragging?.project.id === e.project.id}
                    />
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

      {dragging && over ? (
        <div
          className="pointer-events-none fixed z-[90] max-w-56 rounded-lg border border-accent/40 bg-card px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: over.x + 12, top: over.y + 12 }}
          aria-hidden
        >
          <p className="truncate font-semibold text-heading">{eventTitle(dragging.project)}</p>
          <p className="text-muted">
            {over.day && over.day !== dragging.dayKey ? describeSlot(over.day, dragging.allDay ? null : zonedTimeToIso(over.day, dragging.startMin, timeZone), timeZone) : "Drop on another day"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Popover + event preview ─────────────────────────────────────────────────

function EventPreview({
  event,
  timeZone,
  staff,
  staffSaver,
  canManageStaff,
  canMove,
  onReschedule,
}: {
  event: CalEvent;
  timeZone: string;
  staff: CalendarStaffOption[];
  staffSaver: StaffSaver;
  canManageStaff: boolean;
  canMove: boolean;
  onReschedule: (toDay: string, toMin: number) => void;
}) {
  const p = event.project;
  const style = CALENDAR_EVENT_STYLES[p.status];
  const [moving, setMoving] = useState(false);
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
          {canMove && !moving ? (
            <button type="button" onClick={() => setMoving(true)} className="mt-0.5 text-xs font-semibold text-accent hover:underline">
              Reschedule
            </button>
          ) : null}
        </div>
      </div>
      {moving ? <RescheduleForm event={event} onCancel={() => setMoving(false)} onSubmit={onReschedule} /> : null}
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
        <StaffPicker projectId={p.id} staff={staff} saver={staffSaver} canManage={canManageStaff} />
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

/** Keyboard / touch alternative to dragging: pick a date (and time for confirmed shoots). */
function RescheduleForm({ event, onCancel, onSubmit }: { event: CalEvent; onCancel: () => void; onSubmit: (toDay: string, toMin: number) => void }) {
  const [day, setDay] = useState(event.dayKey);
  const [time, setTime] = useState(minutesToHHMM(event.startMin));
  const minutes = event.allDay ? 0 : hhmmToMinutes(time);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && minutes !== null;
  return (
    <form
      className="space-y-2 rounded-xl border border-border bg-subtle/60 p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(day, minutes!);
      }}
    >
      <div className="flex gap-2">
        <label className="min-w-0 flex-1 text-xs font-medium text-muted">
          Date
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="mt-0.5 h-9 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground"
            required
          />
        </label>
        {!event.allDay ? (
          <label className="w-28 shrink-0 text-xs font-medium text-muted">
            Time
            <input
              type="time"
              step={SNAP_MINUTES * 60}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-0.5 h-9 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground"
              required
            />
          </label>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-8 rounded-lg px-3 text-sm font-medium text-muted hover:bg-card hover:text-heading">
          Cancel
        </button>
        <button type="submit" disabled={!valid} className="h-8 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
          Move…
        </button>
      </div>
    </form>
  );
}

/**
 * Multi-select staff for one project. Changes stay local while the list is open and save
 * when it closes (click outside the list, Escape, or the popover closing).
 */
function StaffPicker({ projectId, staff, saver, canManage }: { projectId: string; staff: CalendarStaffOption[]; saver: StaffSaver; canManage: boolean }) {
  const current = saver.assigned(projectId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<string[] | null>(null);
  const saverRef = useRef(saver);
  useLayoutEffect(() => {
    draftRef.current = draft;
    saverRef.current = saver;
  });

  const nameOf = (id: string) => {
    const s = staff.find((m) => m.id === id);
    return s ? s.full_name || s.email : "Staff member";
  };
  const close = () => {
    const d = draftRef.current;
    draftRef.current = null; // the unmount save below must not repeat this one
    setOpen(false);
    setDraft(null);
    if (d) saverRef.current.commit(projectId, d);
  };

  // Click outside the list (but inside the popover) closes + saves.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The popover closing (unmount) with the list open still saves.
  useEffect(
    () => () => {
      const d = draftRef.current;
      if (d) saverRef.current.commit(projectId, d);
    },
    [projectId]
  );

  const selected = draft ?? current;
  const state = saver.state(projectId);
  const summary = current.length ? current.map(nameOf).join(", ") : "Unassigned";

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        {canManage && staff.length ? (
          <button
            type="button"
            onClick={() => (open ? close() : (setDraft(current), setOpen(true)))}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-left text-sm hover:bg-subtle"
          >
            <span className={cn("min-w-0 flex-1 truncate", current.length ? "text-foreground" : "text-muted")}>
              {open ? `${selected.length} selected` : summary}
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        ) : (
          <span className={cn("min-w-0 flex-1 truncate", current.length ? "text-foreground" : "text-muted")}>{summary}</span>
        )}
        <span className="flex w-4 shrink-0 justify-center" aria-live="polite">
          {state === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" aria-label="Saving staff" />
          ) : state === "saved" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Staff saved" />
          ) : null}
        </span>
      </div>
      {open ? (
        <ul role="listbox" aria-multiselectable="true" aria-label="Assigned staff" className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-sm">
          {staff.map((m) => {
            const on = selected.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => setDraft((d) => {
                    const base = d ?? current;
                    return on ? base.filter((id) => id !== m.id) : [...base, m.id];
                  })}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-subtle"
                >
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border-2", on ? "border-accent bg-accent text-accent-foreground" : "border-slate-300 surface-dark:border-border")}>
                    {on ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 truncate">{m.full_name || m.email}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
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
