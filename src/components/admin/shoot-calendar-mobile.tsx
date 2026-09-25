"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleRateLimitIndicator } from "@/components/admin/google-rate-limit-indicator";
import { zonedDayKey, type ExternalCalendarEvent } from "@/lib/google-calendar-pull";
import { eventChipPaint, pendingEventChipPaint } from "@/lib/brand-color";
import type { CalendarShoot } from "@/components/admin/shoot-calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type CalendarCreateProject = { id: string; name: string };

type MobileView = "schedule" | "day" | "three" | "week" | "month";

const VIEWS: { id: MobileView; label: string }[] = [
  { id: "schedule", label: "Schedule" },
  { id: "day", label: "Day" },
  { id: "three", label: "3-Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function addYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

function addMonthsYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const first = new Date(Date.UTC(y, (m || 1) - 1 + delta, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d || 1, last);
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day)).toISOString().slice(0, 10);
}

function weekdayIndex(ymd: string, timeZone: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(dt);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function startOfWeekYmd(ymd: string, timeZone: string): string {
  return addYmd(ymd, -weekdayIndex(ymd, timeZone));
}

function monthDays(ymd: string): string[] {
  const [y, m] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const month = String(m).padStart(2, "0");
  const days: string[] = [];
  for (let d = 1; d <= last; d += 1) {
    days.push(`${y}-${month}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function formatYmd(ymd: string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(
    new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12))
  );
}

function wallClockToIso(ymd: string, hm: string, timeZone: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const guess = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess - (asUtc - guess)).toISOString();
}

type DayGroup = { shoots: CalendarShoot[]; external: ExternalCalendarEvent[] };

export function MobileShootCalendar({
  shoots,
  externalEvents,
  businessTimeZone,
  showDegraded,
  canCreateShoot,
  createProjects,
  shootColor,
  colorFor,
  onCursorChange,
  onRefresh,
  renderShoot,
  renderExternal,
}: {
  shoots: CalendarShoot[];
  externalEvents: ExternalCalendarEvent[];
  businessTimeZone: string;
  showDegraded: boolean;
  canCreateShoot: boolean;
  createProjects: CalendarCreateProject[];
  shootColor: string;
  colorFor: (calendarId: string, fallback?: string | null) => string;
  onCursorChange: (ymd: string) => void;
  onRefresh: () => void;
  renderShoot: (shoot: CalendarShoot) => React.ReactNode;
  renderExternal: (event: ExternalCalendarEvent) => React.ReactNode;
}) {
  const todayKey = zonedDayKey(new Date().toISOString(), businessTimeZone);
  const [view, setView] = useState<MobileView>("schedule");
  const [cursor, setCursor] = useState(todayKey);
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectId, setProjectId] = useState(createProjects[0]?.id ?? "");
  const [shootDate, setShootDate] = useState(todayKey);
  const [shootTime, setShootTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number; scrollTop: number } | null>(null);
  const pendingScroll = useRef<string | null>(todayKey);

  const byDay = useMemo(() => {
    const map = new Map<string, DayGroup>();
    const ensure = (key: string) => {
      let row = map.get(key);
      if (!row) {
        row = { shoots: [], external: [] };
        map.set(key, row);
      }
      return row;
    };
    ensure(todayKey);
    for (const shoot of shoots) {
      ensure(zonedDayKey(shoot.proposed_at, businessTimeZone)).shoots.push(shoot);
    }
    for (const event of externalEvents) {
      for (const key of event.dayKeys) ensure(key).external.push(event);
    }
    for (const row of map.values()) {
      row.shoots.sort((a, b) => a.proposed_at.localeCompare(b.proposed_at));
    }
    return map;
  }, [shoots, externalEvents, businessTimeZone, todayKey]);

  const scheduleDays = useMemo(
    () => Array.from(byDay.keys()).sort((a, b) => a.localeCompare(b)),
    [byDay]
  );

  useLayoutEffect(() => {
    const align = () => {
      if (view !== "schedule") return;
      const root = scrollerRef.current;
      const key = pendingScroll.current;
      if (!root || !key) return;
      const target = root.querySelector<HTMLElement>(`[data-schedule-day="${key}"]`);
      if (!target) return;
      const delta = target.getBoundingClientRect().top - root.getBoundingClientRect().top;
      if (Math.abs(delta) > 2) root.scrollTop += delta;
      const remaining = target.getBoundingClientRect().top - root.getBoundingClientRect().top;
      if (Math.abs(remaining) > 8 && root.scrollHeight <= root.clientHeight + 8) {
        target.scrollIntoView({ block: "start" });
      }
      const after = target.getBoundingClientRect().top - root.getBoundingClientRect().top;
      if (Math.abs(after) < 12) pendingScroll.current = null;
    };
    align();
    const root = scrollerRef.current;
    const observer = root ? new ResizeObserver(align) : null;
    if (root) observer?.observe(root);
    const frame = window.requestAnimationFrame(align);
    const stop = window.setTimeout(() => observer?.disconnect(), 4000);
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(stop);
    };
  }, [view, scheduleDays]);

  function moveCursor(next: string, scrollSchedule: boolean) {
    setCursor(next);
    onCursorChange(next);
    if (scrollSchedule) pendingScroll.current = next;
  }

  function go(direction: -1 | 1) {
    if (view === "month") moveCursor(addMonthsYmd(cursor, direction), false);
    else if (view === "week") moveCursor(addYmd(cursor, direction * 7), false);
    else if (view === "three") moveCursor(addYmd(cursor, direction * 3), false);
    else moveCursor(addYmd(cursor, direction), view === "schedule");
  }

  function goToday() {
    moveCursor(todayKey, view === "schedule");
    setSelectedDay(todayKey);
    if (view === "schedule") pendingScroll.current = todayKey;
  }

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    onRefresh();
    window.setTimeout(() => setRefreshing(false), 700);
  }

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollTop: scrollerRef.current?.scrollTop ?? 0,
    };
  }

  function onTouchMove(event: React.TouchEvent) {
    const start = touchRef.current;
    if (!start || start.scrollTop > 0) return;
    const dy = event.touches[0].clientY - start.y;
    if (dy > 8) setPull(Math.min(72, dy));
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (start.scrollTop <= 0 && dy > 64 && dy > Math.abs(dx)) {
      setPull(0);
      refresh();
      return;
    }
    setPull(0);
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      go(dx < 0 ? 1 : -1);
    }
  }

  async function submitShoot() {
    if (!projectId || !shootDate) {
      toast.error("Choose a project and a date");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/shoot-proposals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          proposed_at: wallClockToIso(shootDate, shootTime || "09:00", businessTimeZone),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not create shoot");
      toast.success("Shoot created");
      setCreateOpen(false);
      pendingScroll.current = shootDate;
      moveCursor(shootDate, true);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create shoot");
    } finally {
      setSaving(false);
    }
  }

  const headerLabel =
    view === "week"
      ? `${formatYmd(startOfWeekYmd(cursor, businessTimeZone), businessTimeZone, { month: "short", day: "numeric" })} – ${formatYmd(addYmd(startOfWeekYmd(cursor, businessTimeZone), 6), businessTimeZone, { month: "short", day: "numeric", year: "numeric" })}`
      : view === "three"
        ? `${formatYmd(cursor, businessTimeZone, { month: "short", day: "numeric" })} – ${formatYmd(addYmd(cursor, 2), businessTimeZone, { month: "short", day: "numeric" })}`
        : view === "day"
          ? formatYmd(cursor, businessTimeZone, { weekday: "long", month: "long", day: "numeric" })
          : formatYmd(cursor, businessTimeZone, { month: "long", year: "numeric" });

  const monthKey = cursor.slice(0, 7);
  const activeMonthDay = selectedDay.startsWith(monthKey) ? selectedDay : cursor;
  const daysInMonth = monthDays(cursor);
  const leading = weekdayIndex(daysInMonth[0] || cursor, businessTimeZone);

  function dayEvents(key: string) {
    return byDay.get(key) ?? { shoots: [], external: [] };
  }

  function DayList({ dayKey }: { dayKey: string }) {
    const items = dayEvents(dayKey);
    if (items.shoots.length === 0 && items.external.length === 0) {
      return <p className="py-6 text-center text-sm text-muted">Nothing scheduled.</p>;
    }
    return (
      <div className="space-y-2">
        {items.shoots.map((shoot) => (
          <div key={shoot.id}>{renderShoot(shoot)}</div>
        ))}
        {items.external.map((event) => (
          <div key={`${event.calendarId}-${event.id}-${dayKey}`}>{renderExternal(event)}</div>
        ))}
      </div>
    );
  }

  function dotsFor(dayKey: string) {
    const items = dayEvents(dayKey);
    const colors: { key: string; color: string }[] = [];
    for (const shoot of items.shoots) {
      const pending = shoot.proposal_status === "pending";
      const paint = pending ? pendingEventChipPaint(shootColor) : eventChipPaint(shootColor);
      colors.push({ key: shoot.id, color: paint.background });
      if (colors.length >= 4) return colors;
    }
    for (const event of items.external) {
      const paint = eventChipPaint(colorFor(event.calendarId, event.calendarColor), "#7C3AED");
      colors.push({ key: `${event.calendarId}-${event.id}`, color: paint.background });
      if (colors.length >= 4) break;
    }
    return colors;
  }

  const columnDays =
    view === "day"
      ? [cursor]
      : view === "three"
        ? [cursor, addYmd(cursor, 1), addYmd(cursor, 2)]
        : view === "week"
          ? Array.from({ length: 7 }, (_, index) => addYmd(startOfWeekYmd(cursor, businessTimeZone), index))
          : [];

  return (
    <div
      className="relative flex min-h-[22rem] min-w-0 flex-col"
      style={{ height: "calc(100dvh - 9.25rem - var(--admin-pwa-nav-height))" }}
      data-mobile-calendar={view}
    >
      <div className="mb-2 min-w-0 overflow-x-hidden">
        <div className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain" role="tablist" aria-label="Calendar view">
          {VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={view === option.id}
              data-mobile-view={option.id}
              onClick={() => {
                if (option.id === "schedule") pendingScroll.current = todayKey;
                setView(option.id);
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-2 text-xs font-semibold touch-manipulation min-h-11",
                view === option.id ? "bg-accent text-accent-foreground" : "bg-white text-muted ring-1 ring-border"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-1 border-b border-border bg-slate-50/80 px-2 py-2">
          <Button type="button" variant="ghost" size="sm" className="min-h-11 min-w-11" onClick={() => go(-1)} aria-label="Previous">
            ‹
          </Button>
          <div className="relative min-w-0 flex-1 px-8 text-center">
            <h2 className="truncate text-sm font-semibold text-primary">{headerLabel}</h2>
            <div className="flex items-center justify-center gap-1">
              <button type="button" className="min-h-11 px-2 text-xs font-medium text-muted" onClick={goToday}>
                Today
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted"
                aria-label="Refresh"
                title="Refresh"
                onClick={refresh}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </button>
            </div>
            {showDegraded ? (
              <span className="absolute right-0 top-1/2 -translate-y-1/2">
                <GoogleRateLimitIndicator />
              </span>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="sm" className="min-h-11 min-w-11" onClick={() => go(1)} aria-label="Next">
            ›
          </Button>
        </div>

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {pull > 12 || refreshing ? (
            <p className="py-2 text-center text-xs text-muted" data-pull-refresh={refreshing ? "refreshing" : "pull"}>
              {refreshing || pull > 64 ? "Refreshing…" : "Pull to refresh"}
            </p>
          ) : null}

          {view === "schedule" ? (
            <div className="space-y-6 p-3">
              {scheduleDays.map((dayKey) => {
                const items = dayEvents(dayKey);
                return (
                  <section
                    key={dayKey}
                    data-schedule-day={dayKey}
                    data-schedule-today={dayKey === todayKey ? "true" : undefined}
                  >
                    <h3 className="mb-2 border-b border-border pb-1 text-sm font-semibold text-primary">
                      {formatYmd(dayKey, businessTimeZone, { weekday: "long", month: "long", day: "numeric" })}
                    </h3>
                    {items.shoots.length === 0 && items.external.length === 0 ? (
                      <p className="text-sm text-muted">Nothing scheduled.</p>
                    ) : (
                      <div className="space-y-2">
                        {items.shoots.map((shoot) => (
                          <div key={shoot.id}>{renderShoot(shoot)}</div>
                        ))}
                        {items.external.map((event) => (
                          <div key={`${event.calendarId}-${event.id}`}>{renderExternal(event)}</div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : null}

          {view === "month" ? (
            <div>
              <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-semibold text-muted">
                {WEEKDAYS.map((label, index) => (
                  <div key={`${label}-${index}`} className="py-2">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: leading < 0 ? 0 : leading }).map((_, index) => (
                  <div key={`blank-${index}`} className="min-h-11 border-b border-r border-border bg-slate-50/40" />
                ))}
                {daysInMonth.map((dayKey) => {
                  const dots = dotsFor(dayKey);
                  const isToday = dayKey === todayKey;
                  const selected = dayKey === activeMonthDay;
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      data-month-day={dayKey}
                      onClick={() => setSelectedDay(dayKey)}
                      className={cn(
                        "flex min-h-11 min-w-0 flex-col items-center border-b border-r border-border px-0.5 py-1 touch-manipulation",
                        selected && "bg-accent/10"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                          isToday && "bg-accent text-accent-foreground"
                        )}
                      >
                        {Number(dayKey.slice(-2))}
                      </span>
                      <span className="mt-0.5 flex h-2 items-center justify-center gap-0.5">
                        {dots.map((dot) => (
                          <span key={dot.key} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot.color }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border p-3" data-month-day-events={activeMonthDay}>
                <h3 className="mb-2 text-sm font-semibold text-primary">
                  {formatYmd(activeMonthDay, businessTimeZone, { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <DayList dayKey={activeMonthDay} />
              </div>
            </div>
          ) : null}

          {columnDays.length > 0 ? (
            <div className={cn("grid min-w-0", view === "day" ? "grid-cols-1" : view === "three" ? "grid-cols-3" : "grid-cols-7")}>
              {columnDays.map((dayKey) => (
                <section key={dayKey} className="min-w-0 border-r border-border p-1 last:border-r-0">
                  <p className="mb-1 text-center text-[10px] font-semibold text-muted">
                    {formatYmd(dayKey, businessTimeZone, { weekday: "narrow" })}
                  </p>
                  <p
                    className={cn(
                      "mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                      dayKey === todayKey && "bg-accent text-accent-foreground"
                    )}
                  >
                    {Number(dayKey.slice(-2))}
                  </p>
                  <div className="space-y-1">
                    {dayEvents(dayKey).shoots.map((shoot) => (
                      <div key={shoot.id}>{renderShoot(shoot)}</div>
                    ))}
                    {dayEvents(dayKey).external.map((event) => (
                      <div key={`${event.calendarId}-${event.id}`}>{renderExternal(event)}</div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {canCreateShoot ? (
        <button
          type="button"
          data-create-shoot
          aria-label="Create shoot"
          onClick={() => {
            setShootDate(view === "month" ? activeMonthDay : cursor);
            setProjectId((current) => current || createProjects[0]?.id || "");
            setCreateOpen(true);
          }}
          className="fixed right-4 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-accent-foreground shadow-lg shadow-accent/30 touch-manipulation"
          style={{ bottom: "calc(var(--admin-pwa-nav-height) + env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          +
        </button>
      ) : null}

      {createOpen ? (
        <>
          <button type="button" className="fixed inset-0 z-[120] bg-black/40" aria-label="Close create shoot" onClick={() => setCreateOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[121] rounded-t-2xl bg-white px-4 pt-3 shadow-2xl"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
            role="dialog"
            aria-label="Create shoot"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
            <h2 className="mb-3 text-base font-semibold text-primary">New shoot</h2>
            {createProjects.length === 0 ? (
              <p className="pb-4 text-sm text-muted">No projects are available to schedule.</p>
            ) : (
              <div className="space-y-3 pb-2">
                <div className="space-y-1">
                  <Label htmlFor="mobile-shoot-project">Project</Label>
                  <select
                    id="mobile-shoot-project"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    className="min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm"
                  >
                    {createProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="mobile-shoot-date">Date</Label>
                    <Input id="mobile-shoot-date" type="date" value={shootDate} onChange={(event) => setShootDate(event.target.value)} className="min-h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mobile-shoot-time">Time</Label>
                    <Input id="mobile-shoot-time" type="time" value={shootTime} onChange={(event) => setShootTime(event.target.value)} className="min-h-11" />
                  </div>
                </div>
                <Button type="button" variant="accent" className="min-h-11 w-full" disabled={saving} onClick={() => void submitShoot()}>
                  {saving ? "Creating…" : "Create shoot"}
                </Button>
              </div>
            )}
            <button type="button" className="mb-2 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-muted" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
