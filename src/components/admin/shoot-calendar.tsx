"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday,
  compareAsc,
  startOfDay,
  endOfDay,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { RemoteImage } from "@/components/ui/remote-image";
import { CoverPlaceholder } from "@/components/projects/cover-placeholder";
import { getStatusColor, getStatusLabel } from "@/lib/constants";
import { useAsyncAction } from "@/lib/use-async-action";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CalendarDays,
  List,
  LayoutGrid,
  GripVertical,
  MapPin,
  Clock,
  PanelLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  RescheduleConfirmModal,
  TIMED_RESCHEDULE_NOTE,
  WeekTimeGrid,
  saveShootTime,
  type DragApi,
  type WeekGridEvent,
} from "@/components/admin/calendar/week-time-grid";
import { externalEventWeekSegments, shootWeekSegment } from "@/lib/calendar-week";
import {
  SHOOT_EVENT_MINUTES,
  compactTime,
  describeSlot,
  formatTimeRange,
  todayKey,
  weekKeys,
  zonedDayAndMinutes,
  zonedTimeToIso,
} from "@/lib/projects-calendar";
import { agendaShootsForMonth } from "@/lib/calendar-agenda";
import type { ExternalCalendarEvent } from "@/lib/google-calendar-pull";
import type { AccountCalendar, ViewerCalendarColorPrefs } from "@/lib/google-calendar";
import { PartnerBrandColorField } from "@/components/partner/partner-brand-color-field";
import {
  EVENT_TEXT_CONTRAST_MIN,
  SHOOTPORTAL_EVENT_COLOR,
  eventChipPaint,
  isSafeCssColor,
  pendingEventBorder,
  pendingEventChipPaint,
} from "@/lib/brand-color";
import { zonedDayKey } from "@/lib/google-calendar-pull";
import { MobileShootCalendar, type CalendarCreateProject } from "@/components/admin/shoot-calendar-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CalendarShoot {
  id: string;
  project_id: string;
  proposed_at: string;
  proposal_status?: "pending" | "confirmed";
  google_sync_status?: string | null;
  google_sync_error?: string | null;
  project_name: string;
  client_name: string;
  property_address: string;
  service_type: string;
  status: string;
  cover_url: string | null;
}

type CalendarView = "month" | "week" | "day" | "agenda";
type EventCardVariant = "full" | "compact" | "pill" | "week";

/** Streamed from the page: the shoots, or a failure the grid reports without blocking. */
export type CalendarShootsResult = { ok: true; shoots: CalendarShoot[] } | { ok: false };

/** Streamed from the page: Google calendars + events for `window` (visible calendars only). */
export type CalendarGoogleResult = {
  connected: boolean;
  calendars: AccountCalendar[];
  hiddenCalendarIds: string[];
  loadedCalendarIds: string[];
  events: ExternalCalendarEvent[];
  degraded: boolean;
  window: { from: string; to: string };
};

interface ShootCalendarProps {
  /**
   * Server promises (React Flight thenables). Consumed with `.then(ok, err)` only — chaining
   * `.catch()` on a streamed thenable throws. A new promise arrives after router.refresh().
   */
  shootsSource: Promise<CalendarShootsResult>;
  coversSource: Promise<Record<string, string | null>>;
  googleSource: Promise<CalendarGoogleResult> | null;
  createProjectsSource: Promise<CalendarCreateProject[]>;
  canLoadExternal?: boolean;
  canChooseColors?: boolean;
  calendarColors?: ViewerCalendarColorPrefs;
  businessTimeZone?: string;
  canCreateShoot?: boolean;
  /** scheduling.confirm and not read-only impersonation. Drag-to-reschedule is hidden otherwise. */
  canReschedule?: boolean;
}

type SourceStatus = "loading" | "ready" | "error";
type GoogleStatus = "loading" | "ready" | "degraded" | "unavailable" | "error";

/** One item in the Week grid: a ShootPortal shoot (draggable) or a read-only Google event. */
type WeekItem = WeekGridEvent &
  ({ kind: "shoot"; key: string; shoot: CalendarShoot } | { kind: "google"; key: string; event: ExternalCalendarEvent });

function externalKey(event: ExternalCalendarEvent) {
  return `${event.calendarId}:${event.id}`;
}

/** Subscribe to a streamed server promise; re-subscribes when a refresh delivers a new one. */
function useStreamed<T>(source: Promise<T> | null, onValue: (value: T) => void, onError?: () => void) {
  const handlers = useRef({ onValue, onError });
  useLayoutEffect(() => {
    handlers.current = { onValue, onError };
  });
  useEffect(() => {
    if (!source) return;
    let live = true;
    // Two-argument then(): a streamed Flight thenable has no usable .catch().
    source.then(
      (value) => {
        if (live) handlers.current.onValue(value);
      },
      () => {
        if (live) handlers.current.onError?.();
      }
    );
    return () => {
      live = false;
    };
  }, [source]);
}

/** The Google fetch window around a month: the month plus a week either side. */
function googleWindowFor(anchor: Date) {
  return {
    from: subDays(startOfMonth(anchor), 7).toISOString(),
    to: addDays(endOfMonth(anchor), 7).toISOString(),
  };
}

const CalendarPaintContext = createContext({
  shootColor: SHOOTPORTAL_EVENT_COLOR,
  colorFor(calendarId: string, fallback?: string | null) {
    return fallback || "#7C3AED";
  },
});

const CALENDAR_COLOR_PRESETS = [
  "#0F172A",
  "#2563EB",
  "#0891B2",
  "#0F766E",
  "#16A34A",
  "#CA8A04",
  "#EA580C",
  "#DC2626",
  "#7C3AED",
  "#DB2777",
  "#64748B",
  "#F8FAFC",
] as const;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DESKTOP_MONTH_VISIBLE = 2;

function ShootEventCard({
  shoot,
  variant = "full",
  draggable,
  onOpen,
  onDragStart,
  onDragEnd,
  isDragging,
  timeZone,
}: {
  shoot: CalendarShoot;
  variant?: EventCardVariant;
  draggable?: boolean;
  onOpen: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  /** Business timezone. Omitted on desktop so existing local formatting stays. */
  timeZone?: string;
}) {
  const time = timeZone
    ? new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(parseISO(shoot.proposed_at))
    : format(parseISO(shoot.proposed_at), "h:mm a");
  const pending = shoot.proposal_status === "pending";
  const title = `${shoot.client_name} - ${shoot.project_name}`;
  const { shootColor } = useContext(CalendarPaintContext);
  const solid = eventChipPaint(shootColor);
  const pendingPaint = pendingEventChipPaint(shootColor);
  const paint = pending ? pendingPaint : solid;
  const border = pending ? pendingEventBorder(shootColor, pendingPaint.background) : paint.background;
  const chipStyle = {
    backgroundColor: paint.background,
    color: paint.foreground,
    borderColor: border,
  };

  if (variant === "pill") {
    return (
      <span
        className={cn("block truncate rounded border px-1.5 py-0.5 text-center text-[10px] font-medium", pending && "border-dashed")}
        style={chipStyle}
      >
        {time}
      </span>
    );
  }

  if (variant === "compact" || variant === "week") {
    return (
      <button
        type="button"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className={cn(
          "flex w-full min-w-0 flex-col rounded-md border px-1.5 py-1 text-left touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
          pending && "border-dashed",
          isDragging && "opacity-40"
        )}
        style={{ ...chipStyle, outlineColor: paint.foreground }}
      >
        <span className="truncate text-[11px] font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[10px]">
          <span className="tabular-nums">{time}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0 font-medium">Shoot</span>
          {pending ? (
            <span
              className="shrink-0 rounded border px-1 text-[9px] font-medium"
              style={{ backgroundColor: solid.background, color: solid.foreground, borderColor: border }}
            >
              Pending
            </span>
          ) : null}
          {shoot.google_sync_status === "error" ? (
            <span className="text-[9px] font-medium" title={shoot.google_sync_error || "Google Calendar needs attention"}>
              Sync
            </span>
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "flex w-full min-w-0 gap-3 rounded-xl border border-border bg-white surface-dark:bg-card p-3 text-left shadow-sm transition hover:border-accent/30 hover:shadow-md touch-manipulation sm:gap-4 sm:p-4",
        isDragging && "opacity-40"
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 surface-dark:bg-subtle ring-1 ring-black/5 sm:h-16 sm:w-16">
        {shoot.cover_url ? (
          <RemoteImage src={shoot.cover_url} alt="" fill className="object-cover" sizes="64px" />
        ) : (
          <CoverPlaceholder variant="thumb" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-heading sm:text-base">
            {title}
          </p>
          <Badge className={cn("shrink-0 text-[10px] font-medium", getStatusColor(shoot.status))}>
            {getStatusLabel(shoot.status)}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">{shoot.client_name}</p>
        <p className="truncate text-xs text-muted">{shoot.service_type}</p>
        {shoot.property_address ? (
          <p className="mt-1 hidden truncate text-xs text-muted sm:block">
            <MapPin className="mr-1 inline h-3 w-3 opacity-70" />
            {shoot.property_address}
          </p>
        ) : null}
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold tabular-nums text-accent">
          <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" />
          {time}
        </p>
      </div>
      {draggable && <GripVertical className="hidden h-4 w-4 shrink-0 self-center text-muted md:block" />}
    </button>
  );
}

function GoogleEventCard({
  event,
  variant = "full",
  onOpen,
}: {
  event: ExternalCalendarEvent;
  variant?: EventCardVariant;
  onOpen: () => void;
}) {
  const when = event.allDay ? "All day" : event.timeLabel;
  const { colorFor } = useContext(CalendarPaintContext);
  const requested = colorFor(event.calendarId, event.calendarColor);
  const paint = eventChipPaint(requested, "#7C3AED");
  const body = (
    <>
      <span className="truncate text-[11px] font-semibold leading-tight">{event.title}</span>
      <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px]">
        <span className="truncate tabular-nums">{when}</span>
        <span aria-hidden="true">·</span>
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: requested, boxShadow: `0 0 0 1px ${paint.foreground}` }}
        />
        <span className="shrink-0 font-medium">Google</span>
      </span>
    </>
  );
  return (
    <button
      type="button"
      data-external-event={event.id}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "flex w-full min-w-0 flex-col rounded-md border px-1.5 py-1 text-left touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
        variant === "full" && "px-3 py-2"
      )}
      style={{
        backgroundColor: paint.background,
        color: paint.foreground,
        borderColor: paint.background,
        outlineColor: paint.foreground,
      }}
    >
      {body}
    </button>
  );
}

function MonthDayCell({
  day,
  dayShoots,
  dayExternal,
  isSelected,
  isDraggingOver,
  variant,
  maxVisible,
  onSelectDay,
  onDrop,
  onOpenShoot,
  onOpenExternal,
  onDragStart,
  onDragEnd,
  draggingId,
  canDrag,
}: {
  canDrag: boolean;
  day: Date;
  dayShoots: CalendarShoot[];
  dayExternal: ExternalCalendarEvent[];
  isSelected: boolean;
  isDraggingOver: boolean;
  variant: "mobile" | "desktop";
  maxVisible: number;
  onSelectDay: () => void;
  onDrop: (e: React.DragEvent) => void;
  onOpenShoot: (shoot: CalendarShoot) => void;
  onOpenExternal: (event: ExternalCalendarEvent) => void;
  onDragStart: (e: React.DragEvent, shoot: CalendarShoot) => void;
  onDragEnd: () => void;
  draggingId: string | null;
}) {
  const today = isToday(day);
  const visible = dayShoots.slice(0, maxVisible);
  const overflow = dayShoots.length - visible.length;
  const externalPreview = dayExternal.slice(0, variant === "desktop" ? 3 : 1);
  const externalOverflow = dayExternal.length - externalPreview.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelectDay}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectDay();
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "border-b border-r border-border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
        variant === "mobile" ? "min-h-[52px] p-1.5" : "min-h-[120px] p-2 lg:min-h-[132px]",
        isDraggingOver && "bg-accent/5",
        isSelected && variant === "mobile" && "bg-accent/8 ring-1 ring-inset ring-accent/25"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
            today && "bg-accent text-accent-foreground",
            !today && isSelected && variant === "mobile" && "bg-accent/15 text-accent"
          )}
        >
          {format(day, "d")}
        </span>
        {variant === "mobile" && (dayShoots.length > 0 || dayExternal.length > 0) && (
          <span className="flex items-center gap-0.5">
            {dayShoots.length > 0 ? (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                {dayShoots.length}
              </span>
            ) : null}
            {dayExternal.length > 0 ? (
              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900">
                {dayExternal.length}
              </span>
            ) : null}
          </span>
        )}
      </div>

      {variant === "mobile" ? (
        <div className="mt-1 space-y-0.5">
          {visible.map((shoot) => (
            <ShootEventCard key={shoot.id} shoot={shoot} variant="pill" onOpen={() => onOpenShoot(shoot)} />
          ))}
          {externalPreview.map((event) => (
            <GoogleEventCard key={event.id} event={event} variant="pill" onOpen={() => onOpenExternal(event)} />
          ))}
        </div>
      ) : (
        <div className="mt-1.5 space-y-1">
          {visible.map((shoot) => (
            <ShootEventCard
              key={shoot.id}
              shoot={shoot}
              variant="compact"
              draggable={canDrag}
              isDragging={draggingId === shoot.id}
              onOpen={() => onOpenShoot(shoot)}
              onDragStart={(e) => onDragStart(e, shoot)}
              onDragEnd={onDragEnd}
            />
          ))}
          {externalPreview.map((event) => (
            <GoogleEventCard key={event.id} event={event} variant="compact" onOpen={() => onOpenExternal(event)} />
          ))}
          {externalOverflow > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectDay();
              }}
              className="w-full rounded-md px-1 py-0.5 text-left text-[10px] font-medium text-indigo-800 hover:bg-indigo-50"
            >
              +{externalOverflow} more
            </button>
          )}
          {overflow > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectDay();
              }}
              className="w-full rounded-md px-1 py-0.5 text-left text-[10px] font-medium text-accent hover:bg-accent/10"
            >
              +{overflow} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarColorMenu({
  open,
  top,
  left,
  label,
  value,
  fallback,
  onChange,
  onReset,
  onClose,
}: {
  open: boolean;
  top: number;
  left: number;
  label: string;
  value: string;
  fallback: string;
  onChange: (color: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node | null;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-color-trigger]")) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);
  if (!open) return null;
  const shown = (isSafeCssColor(draft) ? draft.trim() : "") || fallback;
  const paint = eventChipPaint(shown, fallback);
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${label} color`}
      data-color-menu
      className="fixed z-50 w-60 rounded-lg border border-border bg-white surface-dark:bg-card p-2 shadow-lg"
      style={{ top, left }}
    >
      <div className="grid grid-cols-6 gap-1">
        {CALENDAR_COLOR_PRESETS.map((color) => {
          const selected = shown.toUpperCase() === color;
          return (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={selected}
              className="h-5 w-5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              style={{
                backgroundColor: color,
                boxShadow: selected ? "0 0 0 2px white, 0 0 0 3px #0F172A" : "inset 0 0 0 1px rgba(15,23,42,0.15)",
              }}
              onClick={() => {
                setDraft(color);
                onChange(color);
              }}
            />
          );
        })}
      </div>
      <div className="mt-2">
        <PartnerBrandColorField
          id={`calendar-color-${label.replace(/\s+/g, "-").toLowerCase()}`}
          label="Custom"
          value={draft}
          fallback={fallback}
          help="Hex, or rgb() with 0–255 channels."
          onChange={(next) => {
            setDraft(next);
            if (isSafeCssColor(next)) onChange(next.trim());
          }}
          onReset={() => {
            setDraft("");
            onReset();
          }}
        />
      </div>
      {paint.adjusted ? (
        <p className="mt-1 text-[11px] leading-snug text-amber-900">
          This color cannot reach {EVENT_TEXT_CONTRAST_MIN}:1 against light or dark text. Event fills shift slightly so the text stays readable.
        </p>
      ) : null}
    </div>
  );
}

/** Small per-source loading / error notes. Renders nothing once everything has loaded. */
function SourceStatusBar({
  shootsStatus,
  googleStatus,
  onRetryShoots,
  onRetryGoogle,
}: {
  shootsStatus: SourceStatus;
  googleStatus: GoogleStatus | null;
  onRetryShoots: () => void;
  onRetryGoogle: () => void;
}) {
  const items: React.ReactNode[] = [];
  if (shootsStatus === "loading") {
    items.push(
      <span key="s" className="inline-flex items-center gap-1 text-muted">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Loading shoots…
      </span>
    );
  } else if (shootsStatus === "error") {
    items.push(
      <span key="s" className="inline-flex items-center gap-1 text-red-700">
        Shoots couldn’t load.
        <button type="button" onClick={onRetryShoots} className="inline-flex items-center gap-0.5 font-semibold underline">
          <RefreshCw className="h-3 w-3" aria-hidden /> Retry
        </button>
      </span>
    );
  }
  if (googleStatus === "loading") {
    items.push(
      <span key="g" className="inline-flex items-center gap-1 text-muted">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Loading Google…
      </span>
    );
  } else if (googleStatus === "degraded" || googleStatus === "error") {
    items.push(
      <span key="g" className="inline-flex items-center gap-1 text-amber-800">
        {googleStatus === "error" ? "Google events couldn’t load." : "Some Google calendars didn’t load."}
        <button type="button" onClick={onRetryGoogle} className="inline-flex items-center gap-0.5 font-semibold underline">
          <RefreshCw className="h-3 w-3" aria-hidden /> Retry
        </button>
      </span>
    );
  } else if (googleStatus === "unavailable") {
    items.push(
      <span key="g" className="text-amber-800">
        Google Calendar is unavailable — reconnect it in Settings.
      </span>
    );
  }
  if (!items.length) return null;
  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-calendar-status>
      {items}
    </div>
  );
}

function GoogleAllDayChip({ event, onOpen }: { event: ExternalCalendarEvent; onOpen: () => void }) {
  const { colorFor } = useContext(CalendarPaintContext);
  const color = eventChipPaint(colorFor(event.calendarId, event.calendarColor), "#7C3AED").background;
  return (
    <button
      type="button"
      data-external-event={event.id}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={`${event.title} · All day · Google (read-only)`}
      className="flex h-5 w-full min-w-0 items-center gap-1 rounded-md border bg-card px-1 text-left text-[11px] font-medium text-heading sm:px-1.5"
      style={{ borderColor: color, borderLeftWidth: 3 }}
    >
      <span className="min-w-0 truncate">{event.title}</span>
    </button>
  );
}

/**
 * Week block colors. ShootPortal shoots: a tint of the Shoots color with a solid edge (pending:
 * dashed outline) — the same shape Projects → Week uses. Google events: white card, outlined in
 * their calendar color and labelled "Google", so the two never look alike.
 */
function weekBlockAppearance(
  item: WeekItem,
  shootColor: string,
  colorFor: (calendarId: string, fallback?: string | null) => string,
  timeZone: string
) {
  if (item.kind === "shoot") {
    const solid = eventChipPaint(shootColor).background;
    const pending = item.shoot.proposal_status === "pending";
    return {
      className: "text-heading",
      style: {
        borderLeftColor: solid,
        backgroundColor: `color-mix(in srgb, ${solid} 16%, var(--color-card))`,
        ...(pending ? { outline: `1px dashed ${solid}`, outlineOffset: -1 } : {}),
      },
      title: `${item.shoot.client_name} - ${item.shoot.project_name} · ${formatTimeRange(item.shoot.proposed_at, SHOOT_EVENT_MINUTES, timeZone)}${pending ? " · Pending" : ""}`,
    };
  }
  const color = eventChipPaint(colorFor(item.event.calendarId, item.event.calendarColor), "#7C3AED").background;
  return {
    className: "bg-card text-heading",
    style: { borderLeftColor: color, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` },
    title: `${item.event.title} · ${item.event.timeLabel} · Google (${item.event.calendarSummary}) — read-only`,
  };
}

export function ShootCalendar({
  shootsSource,
  coversSource,
  googleSource,
  createProjectsSource,
  canLoadExternal = false,
  canChooseColors = false,
  calendarColors: initialColors = {},
  businessTimeZone = "America/New_York",
  canCreateShoot = false,
  canReschedule = false,
}: ShootCalendarProps) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(new Date());

  // ── Sources: each fills in on its own; the grid never waits for them ──
  const [shoots, setShoots] = useState<CalendarShoot[]>([]);
  const [shootsStatus, setShootsStatus] = useState<SourceStatus>("loading");
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [createProjects, setCreateProjects] = useState<CalendarCreateProject[]>([]);
  const [googleCalendars, setGoogleCalendars] = useState<AccountCalendar[]>([]);
  const [externalEvents, setExternalEvents] = useState<ExternalCalendarEvent[]>([]);
  const [externalWindow, setExternalWindow] = useState<{ from: string; to: string } | null>(null);
  const [loadedCalendarIds, setLoadedCalendarIds] = useState<string[]>([]);
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<string[]>([]);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>(googleSource ? "loading" : "ready");
  const [googleRetry, setGoogleRetry] = useState(0);
  // The streamed first window has arrived (or failed): only then may navigation fetch more.
  const [googleStreamDone, setGoogleStreamDone] = useState(!googleSource);
  const [calendarColors, setCalendarColors] = useState<ViewerCalendarColorPrefs>(initialColors);

  // Optimistic reschedules (shoot id → new instant), dropped on Cancel / failure / fresh data.
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [pendingMove, setPendingMove] = useState<{ shoot: CalendarShoot; toDay: string; toIso: string } | null>(null);
  const [movingSaving, setMovingSaving] = useState(false);
  const movingRef = useRef(false);
  const suppressClick = useRef(false);

  useStreamed(
    shootsSource,
    (result) => {
      if (result.ok) {
        setShoots(result.shoots);
        setMoves({});
        setShootsStatus("ready");
      } else {
        setShootsStatus("error");
      }
    },
    () => setShootsStatus("error")
  );
  useStreamed(coversSource, setCovers);
  useStreamed(createProjectsSource, setCreateProjects);
  useStreamed(
    googleSource,
    (result) => {
      setGoogleCalendars(result.calendars);
      setHiddenCalendarIds(result.hiddenCalendarIds);
      setLoadedCalendarIds(result.loadedCalendarIds);
      setExternalEvents(result.events);
      setExternalWindow(result.window);
      setGoogleStatus(!result.connected ? "unavailable" : result.degraded ? "degraded" : "ready");
      setGoogleStreamDone(true);
    },
    () => {
      setGoogleStatus("error");
      setGoogleStreamDone(true);
    }
  );
  const [colorMenu, setColorMenu] = useState<{ key: string; top: number; left: number; label: string; fallback: string } | null>(null);
  const [showShoots, setShowShoots] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [googleOpen, setGoogleOpen] = useState(true);
  const [openedExternal, setOpenedExternal] = useState<ExternalCalendarEvent | null>(null);
  const [selected, setSelected] = useState<CalendarShoot | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const revertRef = useRef<CalendarShoot[] | null>(null);

  const { run: runUpdate, pending: saving } = useAsyncAction(
    async (id: string, proposed_at: string) => {
      await saveShootTime(id, proposed_at);
    }
  );

  const shownShoots = useMemo(
    () =>
      shoots.map((s) => {
        const moved = moves[s.id];
        const cover = covers[s.project_id];
        if (!moved && cover === undefined) return s;
        return { ...s, ...(moved ? { proposed_at: moved } : {}), ...(cover !== undefined ? { cover_url: cover } : {}) };
      }),
    [shoots, moves, covers]
  );
  const sortedShoots = useMemo(
    () => [...shownShoots].sort((a, b) => compareAsc(parseISO(a.proposed_at), parseISO(b.proposed_at))),
    [shownShoots]
  );
  const agendaShoots = useMemo(
    () => agendaShootsForMonth(showShoots ? sortedShoots : [], anchor),
    [showShoots, sortedShoots, anchor]
  );
  const shownExternal = useMemo(() => {
    if (!canLoadExternal) return [];
    const hidden = new Set(hiddenCalendarIds);
    return externalEvents.filter((event) => !hidden.has(event.calendarId));
  }, [canLoadExternal, externalEvents, hiddenCalendarIds]);
  const visibleShoots = useMemo(
    () => (showShoots ? sortedShoots : []),
    [showShoots, sortedShoots]
  );
  const agendaRef = useRef<HTMLDivElement>(null);

  const shootsByDay = useMemo(() => {
    const map = new Map<string, CalendarShoot[]>();
    visibleShoots.forEach((s) => {
      const key = format(parseISO(s.proposed_at), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    map.forEach((list) => list.sort((a, b) => compareAsc(parseISO(a.proposed_at), parseISO(b.proposed_at))));
    return map;
  }, [visibleShoots]);

  const externalByDay = useMemo(() => {
    const map = new Map<string, ExternalCalendarEvent[]>();
    for (const event of shownExternal) {
      for (const key of event.dayKeys) {
        const list = map.get(key) ?? [];
        list.push(event);
        map.set(key, list);
      }
    }
    return map;
  }, [shownExternal]);

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = monthStart.getDay();

  const weekStart = startOfWeek(anchor, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    if (window.localStorage.getItem("sp-calendar-show-shoots") === "0") setShowShoots(false);
  }, []);

  useEffect(() => {
    const today = new Date();
    if (isSameMonth(anchor, today)) {
      setSelectedDayKey(format(today, "yyyy-MM-dd"));
    } else {
      setSelectedDayKey(format(monthStart, "yyyy-MM-dd"));
    }
  }, [anchor, monthStart]);

  // ── Google: fetch the window the view needs when it isn't loaded yet (navigation / retry) ──
  // The days this view shows (local dates; the window carries a week of slack either side).
  const needFrom =
    view === "week" ? startOfWeek(anchor, { weekStartsOn: 0 }) : view === "day" ? startOfDay(anchor) : startOfMonth(anchor);
  const needTo = view === "week" ? endOfWeek(anchor, { weekStartsOn: 0 }) : view === "day" ? endOfDay(anchor) : endOfMonth(anchor);
  const needFromMs = needFrom.getTime();
  const needToMs = needTo.getTime();
  useEffect(() => {
    if (!canLoadExternal || !googleStreamDone) return;
    // Nothing loaded yet (the streamed window failed): wait for an explicit Retry.
    if (!externalWindow && googleRetry === 0) return;
    const covered =
      externalWindow &&
      needFromMs >= new Date(externalWindow.from).getTime() &&
      needToMs <= new Date(externalWindow.to).getTime();
    if (covered && googleRetry === 0) return;
    const win = googleWindowFor(new Date(needFromMs + (needToMs - needFromMs) / 2));
    const controller = new AbortController();
    setGoogleStatus("loading");
    fetch(
      `/api/integrations/google-calendar/events?from=${encodeURIComponent(win.from)}&to=${encodeURIComponent(win.to)}`,
      { credentials: "include", signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          connected?: boolean;
          events?: ExternalCalendarEvent[];
          loadedCalendarIds?: string[];
          degraded?: boolean;
        };
        setExternalEvents(data.events ?? []);
        setLoadedCalendarIds(data.loadedCalendarIds ?? []);
        setExternalWindow(win);
        setGoogleStatus(data.connected === false ? "unavailable" : data.degraded ? "degraded" : "ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // Keep the shoots and any events already on the page when Google is unavailable.
        setGoogleStatus("error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setGoogleRetry(0);
      });
    return () => controller.abort();
    // Watching externalWindow can't loop: every window fetched here covers the view that asked
    // for it. It does catch a refresh resetting the window while another month is on screen.
  }, [canLoadExternal, googleStreamDone, externalWindow, needFromMs, needToMs, googleRetry]);

  // A calendar turned back on whose events weren't loaded for this window: fetch just that one.
  const missingCalendarIds = useMemo(() => {
    if (!canLoadExternal || !externalWindow) return [];
    const hidden = new Set(hiddenCalendarIds);
    const loaded = new Set(loadedCalendarIds);
    return googleCalendars.map((c) => c.id).filter((id) => !hidden.has(id) && !loaded.has(id));
  }, [canLoadExternal, externalWindow, googleCalendars, hiddenCalendarIds, loadedCalendarIds]);
  const missingKey = missingCalendarIds.join(",");
  useEffect(() => {
    if (!missingKey || !externalWindow || googleStatus === "loading") return;
    const win = externalWindow;
    const controller = new AbortController();
    fetch(
      `/api/integrations/google-calendar/events?from=${encodeURIComponent(win.from)}&to=${encodeURIComponent(win.to)}&calendars=${encodeURIComponent(missingKey)}`,
      { credentials: "include", signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { events?: ExternalCalendarEvent[]; loadedCalendarIds?: string[] };
        const added = data.events ?? [];
        setExternalEvents((current) => {
          const seen = new Set(current.map(externalKey));
          return [...current, ...added.filter((e) => !seen.has(externalKey(e)))];
        });
        // Mark them loaded even if Google returned nothing, so this never loops.
        setLoadedCalendarIds((current) => [...new Set([...current, ...missingKey.split(",")])]);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadedCalendarIds((current) => [...new Set([...current, ...missingKey.split(",")])]);
        setGoogleStatus("degraded");
      });
    return () => controller.abort();
    // externalWindow identity changes only with a new window fetch, which also resets the loaded set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, externalWindow]);

  useLayoutEffect(() => {
    if (view !== "agenda") return;
    const root = agendaRef.current;
    if (!root) return;
    // Current month: put today at the top of the agenda scroller. Earlier days
    // sit above it. Another month: start at the earliest day in that month.
    // Cards load images after first paint, so realign until layout settles.
    const align = () => {
      if (!isSameMonth(anchor, new Date())) {
        root.style.paddingBottom = "";
        root.scrollTop = 0;
        return;
      }
      const today = root.querySelector<HTMLElement>("[data-agenda-today]");
      if (!today) {
        root.style.paddingBottom = "";
        root.scrollTop = 0;
        return;
      }
      // Later days may be shorter than the scroller. Extra padding lets today
      // sit at the top, with earlier days still reachable by scrolling up.
      const pad = Math.max(0, root.clientHeight - today.offsetHeight);
      const padPx = `${pad}px`;
      if (root.style.paddingBottom !== padPx) root.style.paddingBottom = padPx;
      const delta = today.getBoundingClientRect().top - root.getBoundingClientRect().top;
      if (Math.abs(delta) > 1) root.scrollTop += delta;
    };
    align();
    const raf = requestAnimationFrame(align);
    const observer = new ResizeObserver(align);
    observer.observe(root);
    const stop = window.setTimeout(() => observer.disconnect(), 1200);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.clearTimeout(stop);
    };
  }, [view, anchor, agendaShoots, shownExternal]);

  function openShoot(shoot: CalendarShoot) {
    const d = parseISO(shoot.proposed_at);
    setSelected(shoot);
    setEditDate(format(d, "yyyy-MM-dd"));
    setEditTime(format(d, "HH:mm"));
  }

  // ── Drag to reschedule (Week + Month): propose → confirm → save once ──
  function requestMove(shoot: CalendarShoot, toDay: string, toMin: number) {
    if (movingRef.current || pendingMove) return;
    const toIso = zonedTimeToIso(toDay, toMin, businessTimeZone);
    if (new Date(toIso).getTime() === new Date(shoot.proposed_at).getTime()) return; // same slot
    setMoves((m) => ({ ...m, [shoot.id]: toIso }));
    setPendingMove({ shoot, toDay, toIso });
  }

  function clearMove(id: string) {
    setMoves((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
  }

  function cancelMove() {
    if (movingRef.current || !pendingMove) return;
    clearMove(pendingMove.shoot.id);
    setPendingMove(null);
  }

  async function confirmMove() {
    if (movingRef.current || !pendingMove) return;
    movingRef.current = true;
    setMovingSaving(true);
    const { shoot, toDay, toIso } = pendingMove;
    try {
      await saveShootTime(shoot.id, toIso);
      toast.success(`${shoot.project_name} moved to ${describeSlot(toDay, toIso, businessTimeZone)}`);
      setSelectedDayKey(toDay);
      // Fresh shoots replace the optimistic move when they stream in (and Projects' cache too).
      router.refresh();
    } catch (err) {
      clearMove(shoot.id);
      toast.error(err instanceof Error ? err.message : "Couldn’t reschedule the shoot.");
    } finally {
      movingRef.current = false;
      setMovingSaving(false);
      setPendingMove(null);
    }
  }

  async function saveShootDate() {
    if (!selected || !editDate) return;
    const proposed_at = new Date(`${editDate}T${editTime || "09:00"}`).toISOString();
    revertRef.current = shoots;
    setShoots((prev) => prev.map((s) => (s.id === selected.id ? { ...s, proposed_at } : s)));

    try {
      await runUpdate(selected.id, proposed_at);
      toast.success("Shoot date updated");
      setSelected(null);
      router.refresh();
    } catch {
      if (revertRef.current) setShoots(revertRef.current);
      toast.error("Failed to update shoot date");
    }
  }

  function handleDragStart(e: React.DragEvent, shoot: CalendarShoot) {
    e.dataTransfer.setData("shootId", shoot.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(shoot.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  function handleDropOnDay(e: React.DragEvent, day: Date) {
    e.preventDefault();
    setDraggingId(null);
    const id = e.dataTransfer.getData("shootId");
    const shoot = shownShoots.find((s) => s.id === id);
    if (!shoot || !canReschedule) return;
    // Month cells move the day and keep the time of day (business zone), like Projects → Month.
    const from = zonedDayAndMinutes(shoot.proposed_at, businessTimeZone);
    if (!from) return;
    requestMove(shoot, format(day, "yyyy-MM-dd"), from.minutes);
  }

  function navPrev() {
    if (view === "month" || view === "agenda") setAnchor(subMonths(anchor, 1));
    else if (view === "week") setAnchor(subWeeks(anchor, 1));
    else setAnchor(subDays(anchor, 1));
  }

  function navNext() {
    if (view === "month" || view === "agenda") setAnchor(addMonths(anchor, 1));
    else if (view === "week") setAnchor(addWeeks(anchor, 1));
    else setAnchor(addDays(anchor, 1));
  }

  function handleMobileCursor(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    const next = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    setAnchor((current) => (isSameDay(current, next) ? current : next));
  }

  const shootColor = canChooseColors && calendarColors.shoots ? calendarColors.shoots : SHOOTPORTAL_EVENT_COLOR;
  const colorFor = useCallback(
    (calendarId: string, fallback?: string | null) => {
      const override = canChooseColors ? calendarColors.calendars?.[calendarId] : undefined;
      return override || fallback || "#7C3AED";
    },
    [calendarColors.calendars, canChooseColors]
  );

  async function persistColor(key: string, value: string | null) {
    setCalendarColors((current) => {
      const next: ViewerCalendarColorPrefs = {
        ...current,
        calendars: { ...(current.calendars || {}) },
      };
      if (key === "shoots") {
        if (value === null) delete next.shoots;
        else next.shoots = value;
      } else if (next.calendars) {
        if (value === null) delete next.calendars[key];
        else next.calendars[key] = value;
      }
      return next;
    });
    if (!canChooseColors) return;
    const res = await fetch("/api/integrations/google-calendar/calendars", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: { key, value } }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => ({}))) as { error?: string };
      toast.error(data.error || "Could not save calendar color");
    }
  }

  function openColorMenu(event: React.MouseEvent<HTMLButtonElement>, key: string, label: string, fallback: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 240;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.bottom + 6;
    setColorMenu({ key, label, fallback, top, left });
  }

  async function persistHidden(next: string[]) {
    setHiddenCalendarIds(next);
    if (!canLoadExternal) return;
    await fetch("/api/integrations/google-calendar/calendars", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hiddenCalendarIds: next }),
    }).catch(() => {
      toast.error("Could not save calendar visibility");
    });
  }

  // ── Week grid items (business time zone, same model as Projects → Calendar → Week) ──
  const weekDayKeys = weekKeys(format(anchor, "yyyy-MM-dd"));
  const weekStartKey = weekDayKeys[0];
  const businessToday = todayKey(businessTimeZone);
  const weekByDay = useMemo(() => {
    const map = new Map<string, WeekItem[]>();
    if (view !== "week") return map;
    const days = new Set(weekKeys(weekStartKey));
    const push = (item: WeekItem) => {
      if (!days.has(item.dayKey)) return;
      const list = map.get(item.dayKey);
      if (list) list.push(item);
      else map.set(item.dayKey, [item]);
    };
    for (const shoot of visibleShoots) {
      const seg = shootWeekSegment(shoot.proposed_at, businessTimeZone);
      if (seg) push({ kind: "shoot", key: `shoot:${shoot.id}`, shoot, ...seg });
    }
    for (const event of shownExternal) {
      const base = `google:${externalKey(event)}`;
      for (const seg of externalEventWeekSegments(event, businessTimeZone)) {
        push({ kind: "google", key: `${base}:${seg.dayKey}`, event, ...seg });
      }
    }
    return map;
  }, [view, weekStartKey, visibleShoots, shownExternal, businessTimeZone]);

  const weekDrag: DragApi<WeekItem> = {
    canDrag: (item) => item.kind === "shoot" && canReschedule,
    drop: (item, toDay, toMin) => {
      if (item.kind === "shoot") requestMove(item.shoot, toDay, toMin);
    },
    suppressClick,
  };

  function openWeekItem(item: WeekItem) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (item.kind === "shoot") openShoot(item.shoot);
    else setOpenedExternal(item.event);
  }

  const sourceStatus = (
    <SourceStatusBar
      shootsStatus={shootsStatus}
      googleStatus={canLoadExternal ? googleStatus : null}
      onRetryShoots={() => router.refresh()}
      onRetryGoogle={() => setGoogleRetry((n) => n + 1)}
    />
  );

  const headerLabel =
    view === "week"
      ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
      : view === "day"
        ? format(anchor, "EEEE, MMMM d, yyyy")
        : format(anchor, "MMMM yyyy");

  const viewOptions = [
    { id: "month" as const, label: "Month", icon: LayoutGrid },
    { id: "week" as const, label: "Week", icon: CalendarDays },
    { id: "day" as const, label: "Day", icon: Clock },
    { id: "agenda" as const, label: "Agenda", icon: List },
  ];

  const hiddenSet = new Set(hiddenCalendarIds);
  const miniDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const menuValue =
    colorMenu?.key === "shoots"
      ? calendarColors.shoots || ""
      : colorMenu
        ? calendarColors.calendars?.[colorMenu.key] || ""
        : "";

  return (
    <CalendarPaintContext.Provider value={{ shootColor, colorFor }}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="min-w-0 md:hidden">
        <div className="mb-2 empty:hidden">{sourceStatus}</div>
        <MobileShootCalendar
          shoots={visibleShoots}
          externalEvents={shownExternal}
          businessTimeZone={businessTimeZone}
          canCreateShoot={canCreateShoot}
          createProjects={createProjects}
          shootColor={shootColor}
          colorFor={colorFor}
          onCursorChange={handleMobileCursor}
          onRefresh={() => router.refresh()}
          renderShoot={(shoot) => (
            <ShootEventCard
              shoot={shoot}
              variant="compact"
              timeZone={businessTimeZone}
              onOpen={() => openShoot(shoot)}
            />
          )}
          renderExternal={(event) => (
            <GoogleEventCard event={event} variant="compact" onOpen={() => setOpenedExternal(event)} />
          )}
        />
      </div>
      {sidebarOpen ? (
        <aside className="hidden min-w-0 shrink-0 border-b border-border bg-card md:block lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="space-y-4 p-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-heading">{format(anchor, "MMMM yyyy")}</p>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label}>{label.slice(0, 1)}</div>
                ))}
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`mini-blank-${i}`} />
                ))}
                {miniDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const today = isToday(day);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setAnchor(day);
                        setSelectedDayKey(key);
                      }}
                      className={cn(
                        "rounded-full py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700",
                        today && "bg-blue-600 text-white",
                        !today && selectedDayKey === key && "bg-blue-100 text-blue-900",
                        !today && selectedDayKey !== key && "hover:bg-slate-100 surface-dark:hover:bg-subtle"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-heading">ShootPortal</p>
              <div className="flex h-8 min-w-0 items-center gap-2 text-sm">
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showShoots}
                    onChange={(e) => {
                      setShowShoots(e.target.checked);
                      window.localStorage.setItem("sp-calendar-show-shoots", e.target.checked ? "1" : "0");
                    }}
                  />
                  {canChooseColors ? null : (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-blue-600" aria-hidden="true" />
                  )}
                  <span className="truncate">Shoots</span>
                </label>
                {canChooseColors ? (
                  <button
                    type="button"
                    data-color-trigger
                    className="h-3.5 w-3.5 shrink-0 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                    style={{ backgroundColor: shootColor }}
                    aria-label="Shoots color"
                    aria-haspopup="dialog"
                    aria-expanded={colorMenu?.key === "shoots"}
                    onClick={(event) => openColorMenu(event, "shoots", "Shoots", SHOOTPORTAL_EVENT_COLOR)}
                  />
                ) : null}
              </div>
            </div>

            {canLoadExternal ? (
              <div>
                <button
                  type="button"
                  className="mb-1 flex w-full items-center justify-between text-xs font-semibold text-heading"
                  onClick={() => setGoogleOpen((open) => !open)}
                  aria-expanded={googleOpen}
                >
                  Google calendars
                  <ChevronRight className={cn("h-3.5 w-3.5 transition", googleOpen && "rotate-90")} />
                </button>
                {googleOpen ? (
                  <div className="space-y-1">
                    <div className="flex gap-2 text-[11px]">
                      <button type="button" className="text-blue-700 underline" onClick={() => void persistHidden([])}>
                        Select all
                      </button>
                      <button
                        type="button"
                        className="text-blue-700 underline"
                        onClick={() => void persistHidden(googleCalendars.map((calendar) => calendar.id))}
                      >
                        Hide all
                      </button>
                    </div>
                    {googleCalendars.map((calendar) => {
                      const checked = !hiddenSet.has(calendar.id);
                      return (
                        <div key={calendar.id} className="flex h-8 min-w-0 items-center gap-2 text-sm">
                          <label className="flex min-w-0 flex-1 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? [...hiddenCalendarIds, calendar.id]
                                  : hiddenCalendarIds.filter((id) => id !== calendar.id);
                                void persistHidden(next);
                              }}
                            />
                            <span className="min-w-0 truncate">{calendar.summary}</span>
                            {calendar.primary ? <span className="sr-only">Primary calendar</span> : null}
                          </label>
                          <button
                            type="button"
                            data-color-trigger
                            className="h-3.5 w-3.5 shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                            style={{ backgroundColor: colorFor(calendar.id, calendar.backgroundColor) }}
                            aria-label={`${calendar.summary} color`}
                            aria-haspopup="dialog"
                            aria-expanded={colorMenu?.key === calendar.id}
                            onClick={(event) =>
                              openColorMenu(
                                event,
                                calendar.id,
                                calendar.summary,
                                calendar.backgroundColor || "#7C3AED"
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex">
      <div className="mb-3 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 min-w-11"
              aria-label={sidebarOpen ? "Hide calendars" : "Show calendars"}
              title={sidebarOpen ? "Hide calendars" : "Show calendars"}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <div className="inline-flex min-w-0 flex-1 rounded-xl border border-border bg-white surface-dark:bg-card p-1 shadow-sm sm:w-auto">
            {viewOptions.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition touch-manipulation min-h-11 sm:flex-initial sm:px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700",
                  view === id ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:bg-slate-50 surface-dark:hover:bg-subtle hover:text-heading"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
            {sourceStatus}
            <p className="text-xs leading-relaxed text-muted sm:max-w-sm sm:text-right">
              {canReschedule ? (
                <span className="hidden md:inline">
                  {view === "week" ? "Drag shoots to a new day or time to reschedule. " : "Drag shoots to another day to reschedule. "}
                </span>
              ) : null}
              Tap a ShootPortal event to {canReschedule ? "edit" : "view"} it.
              {canLoadExternal ? " Google events are read-only and open in Google Calendar." : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-border bg-white surface-dark:bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-slate-50/80 surface-dark:bg-subtle/80 px-3 py-3 sm:px-4">
          <Button variant="ghost" size="sm" className="min-h-11 min-w-11" onClick={navPrev} aria-label="Previous">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 text-center">
            <h2 className="truncate text-base font-semibold text-heading sm:text-lg">{headerLabel}</h2>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-muted"
              onClick={() => {
                const today = new Date();
                setAnchor(today);
                setSelectedDayKey(format(today, "yyyy-MM-dd"));
              }}
            >
              Today
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="min-h-11 min-w-11" onClick={navNext} aria-label="Next">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {view === "month" && (
          <>
            <div className="grid min-w-0 grid-cols-7 border-b border-border bg-slate-50 surface-dark:bg-subtle text-center text-[11px] font-semibold text-muted sm:text-xs">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="py-2.5">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            <div className="min-w-0 grid grid-cols-7">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`d-blank-${i}`} className="min-h-[120px] border-b border-r border-border bg-slate-50/40 surface-dark:bg-subtle/40 lg:min-h-[132px]" />
              ))}
              {monthDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayShoots = shootsByDay.get(key) ?? [];
                const dayExternal = externalByDay.get(key) ?? [];
                return (
                  <MonthDayCell
                    key={`d-${key}`}
                    day={day}
                    dayShoots={dayShoots}
                    dayExternal={dayExternal}
                    isSelected={false}
                    isDraggingOver={!!draggingId}
                    variant="desktop"
                    maxVisible={DESKTOP_MONTH_VISIBLE}
                    onSelectDay={() => setSelectedDayKey(key)}
                    onDrop={(e) => handleDropOnDay(e, day)}
                    onOpenShoot={openShoot}
                    onOpenExternal={setOpenedExternal}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    draggingId={draggingId}
                    canDrag={canReschedule}
                  />
                );
              })}
            </div>
          </>
        )}

        {view === "week" && (
          <WeekTimeGrid<WeekItem>
            className="h-[calc(var(--app-height,100dvh)-15rem)] min-h-[28rem] lg:h-auto lg:min-h-0 lg:flex-1"
            days={weekDayKeys}
            today={businessToday}
            byDay={weekByDay}
            timeZone={businessTimeZone}
            drag={weekDrag}
            onOpenEvent={(item) => openWeekItem(item)}
            eventKey={(item) => item.key}
            ghostLabel={(item) => (item.kind === "shoot" ? item.shoot.project_name : item.event.title)}
            renderAllDay={(item) =>
              item.kind === "google" ? (
                <GoogleAllDayChip event={item.event} onOpen={() => setOpenedExternal(item.event)} />
              ) : null
            }
            blockAppearance={(item) => weekBlockAppearance(item, shootColor, colorFor, businessTimeZone)}
            renderBlock={(item, roomy) =>
              item.kind === "shoot" ? (
                <>
                  <span className="block truncate font-semibold">{item.shoot.project_name}</span>
                  {roomy ? (
                    <>
                      <span className="flex min-w-0 items-center gap-1 truncate opacity-80">
                        <span className="tabular-nums">{compactTime(item.shoot.proposed_at, businessTimeZone)}</span>
                        {item.shoot.proposal_status === "pending" ? <span className="font-semibold">· Pending</span> : null}
                        {item.shoot.google_sync_status === "error" ? <span className="font-semibold">· Sync</span> : null}
                      </span>
                      <span className="block truncate opacity-80">{item.shoot.client_name}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="block truncate font-semibold">{item.event.title}</span>
                  {roomy ? (
                    <span className="block truncate opacity-80">
                      {item.event.timeLabel} · Google
                    </span>
                  ) : null}
                </>
              )
            }
          />
        )}

        {view === "day" && (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {(shootsByDay.get(format(anchor, "yyyy-MM-dd")) ?? []).map((shoot) => (
              <ShootEventCard key={shoot.id} shoot={shoot} variant="full" onOpen={() => openShoot(shoot)} />
            ))}
            {(externalByDay.get(format(anchor, "yyyy-MM-dd")) ?? []).map((event) => (
              <GoogleEventCard key={event.id} event={event} variant="full" onOpen={() => setOpenedExternal(event)} />
            ))}
            {(shootsByDay.get(format(anchor, "yyyy-MM-dd")) ?? []).length === 0 &&
            (externalByDay.get(format(anchor, "yyyy-MM-dd")) ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Nothing scheduled.</p>
            ) : null}
          </div>
        )}

        {view === "agenda" && (
          <div ref={agendaRef} className="min-h-0 flex-1 space-y-8 overflow-y-auto p-4 sm:p-6">
            {(() => {
              const month = format(anchor, "yyyy-MM");
              const groups = new Map<string, { shoots: CalendarShoot[]; external: ExternalCalendarEvent[] }>();
              const ensure = (key: string) => {
                if (!groups.has(key)) groups.set(key, { shoots: [], external: [] });
                return groups.get(key)!;
              };
              agendaShoots.forEach((shoot) => {
                ensure(format(parseISO(shoot.proposed_at), "yyyy-MM-dd")).shoots.push(shoot);
              });
              shownExternal.forEach((event) => {
                event.dayKeys.forEach((key) => {
                  if (key.startsWith(month)) ensure(key).external.push(event);
                });
              });
              const todayKey = zonedDayKey(new Date().toISOString(), businessTimeZone);
              const viewingCurrentMonth = isSameMonth(anchor, new Date());
              const hasContent =
                agendaShoots.length > 0 ||
                shownExternal.some((event) => event.dayKeys.some((key) => key.startsWith(month)));
              if (!hasContent) {
                return (
                  <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted">
                    No shoots in {format(anchor, "MMMM yyyy")}.
                  </p>
                );
              }
              if (viewingCurrentMonth && !groups.has(todayKey)) ensure(todayKey);
              const entries = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
              return entries.map(([dateKey, items]) => (
                <section key={dateKey} data-agenda-today={dateKey === todayKey ? "true" : undefined}>
                  <h3 className="mb-3 border-b border-border pb-2 text-sm font-semibold text-heading sm:text-base">
                    {format(parseISO(`${dateKey}T12:00:00`), "EEEE, MMMM d, yyyy")}
                  </h3>
                  {items.shoots.length === 0 && items.external.length === 0 ? (
                    <p className="text-sm text-muted">No shoots today.</p>
                  ) : (
                    <div className="space-y-3">
                      {items.shoots.map((shoot) => (
                        <ShootEventCard key={shoot.id} shoot={shoot} onOpen={() => openShoot(shoot)} />
                      ))}
                      {items.external.map((event) => (
                        <GoogleEventCard key={event.id} event={event} onOpen={() => setOpenedExternal(event)} />
                      ))}
                    </div>
                  )}
                </section>
              ));
            })()}
          </div>
        )}
      </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Scheduled Shoot">
        {selected && (
          <div className="space-y-5">
            <p className="text-xs font-medium text-blue-700">ShootPortal</p>
            {selected.proposal_status === "pending" ? (
              <p className="text-sm text-blue-800">Pending — waiting for the client to approve this time.</p>
            ) : null}
            {selected.google_sync_status === "error" ? (
              <p className="text-sm text-amber-800">
                Google Calendar needs attention{selected.google_sync_error ? `: ${selected.google_sync_error}` : ""}. The
                shoot is still saved in ShootPortal.
              </p>
            ) : null}
            <div className="flex gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 surface-dark:bg-subtle ring-1 ring-black/5 sm:h-20 sm:w-20">
                {selected.cover_url || covers[selected.project_id] ? (
                  <RemoteImage src={(selected.cover_url || covers[selected.project_id])!} alt="" fill className="object-cover" sizes="80px" />
                ) : (
                  <CoverPlaceholder variant="thumb" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-heading">{selected.project_name}</p>
                <p className="truncate text-sm text-muted">{selected.client_name}</p>
                <p className="truncate text-sm text-muted">{selected.property_address}</p>
                <p className="mt-1 text-xs text-muted">{selected.service_type}</p>
                <Badge className={cn("mt-2 text-[10px]", getStatusColor(selected.status))}>
                  {getStatusLabel(selected.status)}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="min-h-11"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="accent" onClick={saveShootDate} disabled={saving} className="min-h-11">
                {saving ? "Saving…" : "Save Date"}
              </Button>
              <Link href={`/admin/projects/${selected.project_id}#scheduling`}>
                <Button variant="outline" className="min-h-11">
                  Open Project <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <RescheduleConfirmModal
        open={!!pendingMove}
        title={pendingMove ? `${pendingMove.shoot.client_name} - ${pendingMove.shoot.project_name}` : ""}
        fromLabel={
          pendingMove
            ? describeSlot(
                zonedDayAndMinutes(pendingMove.shoot.proposed_at, businessTimeZone)?.dayKey ?? pendingMove.toDay,
                pendingMove.shoot.proposed_at,
                businessTimeZone
              )
            : ""
        }
        toLabel={pendingMove ? describeSlot(pendingMove.toDay, pendingMove.toIso, businessTimeZone) : ""}
        note={TIMED_RESCHEDULE_NOTE}
        saving={movingSaving}
        onCancel={cancelMove}
        onConfirm={() => void confirmMove()}
      />

      <Modal open={!!openedExternal} onClose={() => setOpenedExternal(null)} title="Google Calendar">
        {openedExternal ? (
          <div className="space-y-4">
            <p className="text-base font-semibold text-heading">{openedExternal.title}</p>
            <p className="text-sm text-indigo-800">{openedExternal.allDay ? "All day" : openedExternal.timeLabel}</p>
            <p className="text-sm text-muted">Google · {openedExternal.calendarSummary}</p>
            <p className="text-sm text-muted">This event is read-only in ShootPortal.</p>
            {openedExternal.htmlLink ? (
              <a
                href={openedExternal.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 text-sm font-medium text-indigo-900"
              >
                Open in Google Calendar <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <p className="text-sm text-muted">Google did not provide a link for this event.</p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
    {colorMenu && canChooseColors ? (
      <CalendarColorMenu
        open
        top={colorMenu.top}
        left={colorMenu.left}
        label={colorMenu.label}
        value={menuValue}
        fallback={colorMenu.fallback}
        onChange={(color) => void persistColor(colorMenu.key, color)}
        onReset={() => void persistColor(colorMenu.key, null)}
        onClose={() => setColorMenu(null)}
      />
    ) : null}
    </CalendarPaintContext.Provider>
  );
}
