"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDayKey, formatTimeRange, layoutOverlaps, snapMinutes, zonedDayAndMinutes, zonedTimeToIso } from "@/lib/projects-calendar";
import { cn } from "@/lib/utils";

/**
 * Google Calendar-style week grid shared by Projects → Calendar → Week and the Shoot Calendar's
 * Week view: hourly timeline, seven day columns, all-day row, current-time line, overlap
 * columns and pointer drag (15-minute snap) that only *requests* a move — the caller confirms
 * before anything is saved. Everything is laid out in the business time zone via day keys.
 */

export const HOUR_PX = 48;

/** The fields the grid lays out. Timed events carry minutes after midnight in the business zone. */
export type WeekGridEvent = {
  dayKey: string;
  allDay: boolean;
  startMin: number;
  endMin: number;
  startIso: string | null;
};

/** Drag + click wiring shared by the Month and Week grids. */
export type DragApi<E> = {
  canDrag: (e: E) => boolean;
  /** Dropped somewhere new: asks for confirmation. Same slot → no-op. */
  drop: (e: E, toDay: string, toMin: number) => void;
  /** Set after a drag so the trailing click doesn't open the preview. */
  suppressClick: { current: boolean };
};

// ── Pointer drag (mouse / pen only: touch keeps native scrolling; phones use the preview's Reschedule) ──

export type DragSession<E> = { event: E; x0: number; y0: number; active: boolean; el: HTMLElement; pointerId: number; grabMin: number };
type DragHandlers<E> = {
  onStart?: (s: DragSession<E>) => void;
  onMove: (s: DragSession<E>, x: number, y: number) => void;
  onEnd: (s: DragSession<E>) => void;
  onCancel: () => void;
};

/** Click vs drag: nothing moves until the pointer travels 5px; Escape cancels mid-drag. */
export function useEventDrag<E>(api: DragApi<E>, handlers: DragHandlers<E>) {
  const session = useRef<DragSession<E> | null>(null);
  const h = useRef(handlers);
  useLayoutEffect(() => {
    h.current = handlers;
  });
  const [dragging, setDragging] = useState<E | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      const s = session.current;
      session.current = null;
      api.suppressClick.current = true;
      try {
        s?.el.releasePointerCapture(s.pointerId);
      } catch {
        /* already released */
      }
      setDragging(null);
      h.current.onCancel();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, api.suppressClick]);

  function bind(event: E) {
    if (!api.canDrag(event)) return {};
    return {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0 || e.pointerType === "touch") return;
        e.preventDefault(); // no text selection while dragging
        api.suppressClick.current = false;
        session.current = { event, x0: e.clientX, y0: e.clientY, active: false, el: e.currentTarget, pointerId: e.pointerId, grabMin: 0 };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* unsupported */
        }
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const s = session.current;
        if (!s || s.pointerId !== e.pointerId) return;
        if (!s.active) {
          if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) < 5) return;
          s.active = true;
          h.current.onStart?.(s);
          setDragging(s.event);
        }
        h.current.onMove(s, e.clientX, e.clientY);
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        const s = session.current;
        if (!s || s.pointerId !== e.pointerId) return;
        session.current = null;
        if (!s.active) return; // a plain click
        api.suppressClick.current = true;
        window.setTimeout(() => (api.suppressClick.current = false), 0);
        setDragging(null);
        h.current.onEnd(s);
      },
      onPointerCancel: () => {
        session.current = null;
        setDragging(null);
        h.current.onCancel();
      },
      "aria-roledescription": "draggable shoot",
    };
  }

  return { bind, dragging };
}

export type DragBindProps = ReturnType<ReturnType<typeof useEventDrag>["bind"]>;

// ── Week ────────────────────────────────────────────────────────────────────

export type WeekBlockAppearance = {
  className?: string;
  style?: CSSProperties;
  title: string;
};

export function WeekTimeGrid<E extends WeekGridEvent>({
  days,
  today,
  byDay,
  timeZone,
  drag,
  onOpenEvent,
  eventKey,
  blockAppearance,
  renderBlock,
  renderAllDay,
  ghostLabel,
  allDayHint,
  className,
}: {
  days: string[];
  today: string;
  byDay: Map<string, E[]>;
  timeZone: string;
  drag: DragApi<E>;
  onOpenEvent: (e: E, el: HTMLElement) => void;
  eventKey: (e: E) => string;
  /** Color/border classes and hover title for a timed block. */
  blockAppearance: (e: E) => WeekBlockAppearance;
  /** Inner content of a timed block; `roomy` when it is tall enough for extra lines. */
  renderBlock: (e: E, roomy: boolean) => ReactNode;
  /** Chip in the all-day row. */
  renderAllDay: (e: E) => ReactNode;
  /** Title shown on the drop ghost while dragging. */
  ghostLabel: (e: E) => string;
  allDayHint?: string;
  /** Height of the scroll area (the grid scrolls inside it). */
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ dayKey: string; startMin: number } | null>(null);
  const ghostRef = useRef<{ dayKey: string; startMin: number } | null>(null);

  /** Day column + minutes under the pointer (null outside the seven day columns). */
  const slotAt = (x: number, y: number) => {
    const cols = colRefs.current;
    for (let i = 0; i < cols.length; i++) {
      const r = cols[i]?.getBoundingClientRect();
      if (r && x >= r.left && x < r.right) return { dayKey: days[i], minutes: ((y - r.top) / HOUR_PX) * 60 };
    }
    return null;
  };

  const { bind, dragging } = useEventDrag<E>(drag, {
    onStart: (s) => {
      // Keep the grab point under the cursor: grabbing the bottom of a block doesn't jump it.
      const at = slotAt(s.x0, s.y0);
      s.grabMin = at ? at.minutes - s.event.startMin : 0;
    },
    onMove: (s, x, y) => {
      const sc = scrollRef.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (y < r.top + 96) sc.scrollTop -= 12;
        else if (y > r.bottom - 32) sc.scrollTop += 12;
      }
      const at = slotAt(x, y);
      const next = at ? { dayKey: at.dayKey, startMin: snapMinutes(at.minutes - s.grabMin, s.event.endMin - s.event.startMin) } : null;
      ghostRef.current = next;
      setGhost(next);
    },
    onEnd: (s) => {
      const g = ghostRef.current;
      ghostRef.current = null;
      setGhost(null);
      if (g) drag.drop(s.event, g.dayKey, g.startMin);
    },
    onCancel: () => {
      ghostRef.current = null;
      setGhost(null);
    },
  });

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

  // Scroll to "now" on this week, otherwise to the first event (or 8 AM).
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
    <div ref={scrollRef} data-week-grid className={cn("min-w-0 overflow-auto overscroll-contain [scrollbar-width:thin]", className)}>
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
              <div className="sticky left-0 z-10 flex items-start justify-end bg-card py-1 pr-2 text-[10px] font-medium uppercase text-muted" title={allDayHint}>
                All day
              </div>
              {allDay.map((list, i) => (
                <div key={days[i]} className="min-w-0 space-y-px border-l border-border p-0.5">
                  {list.map((e) => (
                    <div key={eventKey(e)} className="min-w-0">
                      {renderAllDay(e)}
                    </div>
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
            <div
              key={d}
              ref={(el) => {
                colRefs.current[i] = el;
              }}
              data-week-day={d}
              className={cn("relative border-l border-border", d === today && "bg-accent-subtle/25")}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="border-b border-border/60" style={{ height: HOUR_PX }} aria-hidden />
              ))}
              {timed[i].map(({ event, column, columns }) => {
                const look = blockAppearance(event);
                const top = (event.startMin / 60) * HOUR_PX;
                const height = Math.max(22, ((event.endMin - event.startMin) / 60) * HOUR_PX - 2);
                const width = 100 / columns;
                const roomy = height >= 44;
                return (
                  <button
                    key={eventKey(event)}
                    type="button"
                    {...bind(event)}
                    onClick={(e) => onOpenEvent(event, e.currentTarget)}
                    className={cn(
                      "absolute z-[1] overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ring-1 ring-card transition-[filter] hover:z-[2] hover:brightness-95 focus-visible:z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      look.className,
                      drag.canDrag(event) && "cursor-grab active:cursor-grabbing",
                      dragging && eventKey(dragging) === eventKey(event) && "opacity-40"
                    )}
                    style={{ ...look.style, top: top + 1, height, left: `calc(${column * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                    title={look.title}
                  >
                    {renderBlock(event, roomy)}
                  </button>
                );
              })}
              {dragging && ghost?.dayKey === d ? (
                <div
                  className="pointer-events-none absolute inset-x-0.5 z-[4] overflow-hidden rounded-md border-2 border-accent bg-card/95 px-1.5 py-0.5 text-[11px] leading-tight shadow-lg"
                  style={{ top: (ghost.startMin / 60) * HOUR_PX + 1, height: Math.max(22, ((dragging.endMin - dragging.startMin) / 60) * HOUR_PX - 2) }}
                  aria-hidden
                >
                  <span className="block truncate font-semibold text-heading">{ghostLabel(dragging)}</span>
                  <span className="block truncate font-medium text-accent">
                    {formatTimeRange(zonedTimeToIso(d, ghost.startMin, timeZone), dragging.endMin - dragging.startMin, timeZone)}
                  </span>
                </div>
              ) : null}
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

export function hourLabel(h: number) {
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
}

// ── Reschedule confirmation + save ──────────────────────────────────────────

/** "Reschedule Shoot?" — nothing is saved until Confirm. Cancel restores the original slot. */
export function RescheduleConfirmModal({
  open,
  title,
  fromLabel,
  toLabel,
  note,
  saving,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  fromLabel: string;
  toLabel: string;
  note: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Reschedule Shoot?"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="min-h-11 sm:min-h-10" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="accent" className="min-h-11 sm:min-h-10" disabled={saving} onClick={onConfirm}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {saving ? "Rescheduling…" : "Confirm Reschedule"}
          </Button>
        </div>
      }
    >
      {open ? (
        <div className="space-y-3 text-sm text-muted">
          <p>
            Move <strong className="text-heading">{title}</strong> from <strong className="text-heading">{fromLabel}</strong> to{" "}
            <strong className="text-heading">{toLabel}</strong>?
          </p>
          <p className="text-xs">{note}</p>
        </div>
      ) : null}
    </Modal>
  );
}

export const TIMED_RESCHEDULE_NOTE =
  "Google Calendar and the client’s reschedule notification update the same way as on the Shoot Calendar (per your Scheduling settings).";

/** Turns a failed reschedule response into the message both calendars show. */
export async function rescheduleErrorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return res.status === 403 || res.status === 401
    ? "You don’t have permission to reschedule this shoot."
    : res.status === 404
      ? "This shoot was changed or removed. Refresh and try again."
      : body.error || "Couldn’t reschedule the shoot.";
}

/**
 * The one scheduling mutation both calendars use for a timed shoot: PATCH /api/shoot-proposals
 * `update_date` (activity log, client notification and Google sync happen there, once).
 */
export async function saveShootTime(proposalId: string, proposedAtIso: string): Promise<void> {
  const res = await fetch("/api/shoot-proposals", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id: proposalId, action: "update_date", proposed_at: proposedAtIso }),
  });
  if (!res.ok) throw new Error(await rescheduleErrorMessage(res));
}
