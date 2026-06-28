"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  isToday,
  compareAsc,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { RemoteImage } from "@/components/ui/remote-image";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CalendarShoot {
  id: string;
  project_id: string;
  proposed_at: string;
  project_name: string;
  client_name: string;
  property_address: string;
  service_type: string;
  status: string;
  cover_url: string | null;
}

type CalendarView = "month" | "week" | "agenda";
type EventCardVariant = "full" | "compact" | "pill" | "week";

interface ShootCalendarProps {
  shoots: CalendarShoot[];
}

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
}: {
  shoot: CalendarShoot;
  variant?: EventCardVariant;
  draggable?: boolean;
  onOpen: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const time = format(parseISO(shoot.proposed_at), "h:mm a");

  if (variant === "pill") {
    return (
      <span className="block truncate rounded-full bg-accent/15 px-2 py-0.5 text-center text-[10px] font-semibold text-accent">
        {time}
      </span>
    );
  }

  if (variant === "compact") {
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
          "flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/15 bg-white px-2 py-1.5 text-left shadow-sm transition hover:border-accent/35 hover:shadow touch-manipulation",
          isDragging && "opacity-40"
        )}
      >
        {draggable && <GripVertical className="hidden h-3 w-3 shrink-0 text-muted sm:block" />}
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-accent">{time}</span>
        <span className="min-w-0 truncate text-[11px] font-medium text-primary">{shoot.project_name}</span>
      </button>
    );
  }

  if (variant === "week") {
    return (
      <button
        type="button"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        className={cn(
          "group relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white text-left shadow-sm transition hover:border-accent/35 hover:shadow-md touch-manipulation",
          isDragging && "opacity-40"
        )}
      >
        {draggable && (
          <GripVertical className="absolute right-1 top-1 z-10 h-3.5 w-3.5 text-muted/60 group-hover:text-muted" />
        )}
        <div className="relative h-14 w-full shrink-0 overflow-hidden bg-slate-100">
          {shoot.cover_url ? (
            <RemoteImage src={shoot.cover_url} alt="" fill className="object-cover" sizes="120px" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted">—</div>
          )}
        </div>
        <div className="min-w-0 overflow-hidden p-2">
          <p className="truncate text-xs font-semibold leading-tight text-primary">{shoot.project_name}</p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted">{shoot.client_name}</p>
          <p className="truncate text-[10px] leading-tight text-muted">{shoot.service_type}</p>
          <div className="mt-1.5 min-w-0 overflow-hidden">
            <Badge
              className={cn(
                "inline-block max-w-full truncate text-[9px] font-medium leading-tight",
                getStatusColor(shoot.status)
              )}
            >
              {getStatusLabel(shoot.status)}
            </Badge>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold tabular-nums text-accent">
            <Clock className="h-3 w-3 shrink-0 opacity-80" />
            <span className="truncate">{time}</span>
          </p>
        </div>
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
        "flex w-full min-w-0 gap-3 rounded-xl border border-border bg-white p-3 text-left shadow-sm transition hover:border-accent/30 hover:shadow-md touch-manipulation sm:gap-4 sm:p-4",
        isDragging && "opacity-40"
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-black/5 sm:h-16 sm:w-16">
        {shoot.cover_url ? (
          <RemoteImage src={shoot.cover_url} alt="" fill className="object-cover" sizes="64px" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">—</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-primary sm:text-base">
            {shoot.project_name}
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

function MonthDayCell({
  day,
  dayShoots,
  isSelected,
  isDraggingOver,
  variant,
  maxVisible,
  onSelectDay,
  onDrop,
  onOpenShoot,
  onDragStart,
  onDragEnd,
  draggingId,
}: {
  day: Date;
  dayShoots: CalendarShoot[];
  isSelected: boolean;
  isDraggingOver: boolean;
  variant: "mobile" | "desktop";
  maxVisible: number;
  onSelectDay: () => void;
  onDrop: (e: React.DragEvent) => void;
  onOpenShoot: (shoot: CalendarShoot) => void;
  onDragStart: (e: React.DragEvent, shoot: CalendarShoot) => void;
  onDragEnd: () => void;
  draggingId: string | null;
}) {
  const today = isToday(day);
  const visible = dayShoots.slice(0, maxVisible);
  const overflow = dayShoots.length - visible.length;

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
            today && "bg-accent text-white",
            !today && isSelected && variant === "mobile" && "bg-accent/15 text-accent"
          )}
        >
          {format(day, "d")}
        </span>
        {variant === "mobile" && dayShoots.length > 0 && (
          <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            {dayShoots.length}
          </span>
        )}
      </div>

      {variant === "mobile" ? (
        <div className="mt-1 space-y-0.5">
          {visible.map((shoot) => (
            <ShootEventCard key={shoot.id} shoot={shoot} variant="pill" onOpen={() => onOpenShoot(shoot)} />
          ))}
        </div>
      ) : (
        <div className="mt-1.5 space-y-1">
          {visible.map((shoot) => (
            <ShootEventCard
              key={shoot.id}
              shoot={shoot}
              variant="compact"
              draggable
              isDragging={draggingId === shoot.id}
              onOpen={() => onOpenShoot(shoot)}
              onDragStart={(e) => onDragStart(e, shoot)}
              onDragEnd={onDragEnd}
            />
          ))}
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

export function ShootCalendar({ shoots: initialShoots }: ShootCalendarProps) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [shoots, setShoots] = useState(initialShoots);
  const [selected, setSelected] = useState<CalendarShoot | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const revertRef = useRef<CalendarShoot[] | null>(null);

  const { run: runUpdate, pending: saving } = useAsyncAction(
    async (id: string, proposed_at: string) => {
      const res = await fetch("/api/shoot-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, action: "update_date", proposed_at }),
      });
      if (!res.ok) throw new Error("Failed");
      return res;
    }
  );

  const sortedShoots = useMemo(
    () => [...shoots].sort((a, b) => compareAsc(parseISO(a.proposed_at), parseISO(b.proposed_at))),
    [shoots]
  );

  const shootsByDay = useMemo(() => {
    const map = new Map<string, CalendarShoot[]>();
    shoots.forEach((s) => {
      const key = format(parseISO(s.proposed_at), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    map.forEach((list) => list.sort((a, b) => compareAsc(parseISO(a.proposed_at), parseISO(b.proposed_at))));
    return map;
  }, [shoots]);

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = monthStart.getDay();

  const weekStart = startOfWeek(anchor, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const selectedDayShoots = shootsByDay.get(selectedDayKey) ?? [];

  useEffect(() => {
    const today = new Date();
    if (isSameMonth(anchor, today)) {
      setSelectedDayKey(format(today, "yyyy-MM-dd"));
    } else {
      setSelectedDayKey(format(monthStart, "yyyy-MM-dd"));
    }
  }, [anchor, monthStart]);

  const openShoot = useCallback((shoot: CalendarShoot) => {
    const d = parseISO(shoot.proposed_at);
    setSelected(shoot);
    setEditDate(format(d, "yyyy-MM-dd"));
    setEditTime(format(d, "HH:mm"));
  }, []);

  const applyDateChange = useCallback(
    async (shoot: CalendarShoot, targetDay: Date, keepTime = true) => {
      const old = parseISO(shoot.proposed_at);
      const next = new Date(targetDay);
      if (keepTime) {
        next.setHours(old.getHours(), old.getMinutes(), 0, 0);
      }
      const proposed_at = next.toISOString();

      revertRef.current = shoots;
      setShoots((prev) => prev.map((s) => (s.id === shoot.id ? { ...s, proposed_at } : s)));

      try {
        await runUpdate(shoot.id, proposed_at);
        toast.success("Shoot rescheduled");
        router.refresh();
      } catch {
        if (revertRef.current) setShoots(revertRef.current);
        toast.error("Failed to reschedule shoot");
      }
    },
    [runUpdate, router, shoots]
  );

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
    const id = e.dataTransfer.getData("shootId");
    const shoot = shoots.find((s) => s.id === id);
    if (!shoot) return;
    if (isSameDay(parseISO(shoot.proposed_at), day)) return;
    void applyDateChange(shoot, day);
    setDraggingId(null);
    setSelectedDayKey(format(day, "yyyy-MM-dd"));
  }

  function navPrev() {
    if (view === "month") setAnchor(subMonths(anchor, 1));
    else if (view === "week") setAnchor(subWeeks(anchor, 1));
    else setAnchor(subMonths(anchor, 1));
  }

  function navNext() {
    if (view === "month") setAnchor(addMonths(anchor, 1));
    else if (view === "week") setAnchor(addWeeks(anchor, 1));
    else setAnchor(addMonths(anchor, 1));
  }

  const headerLabel =
    view === "week"
      ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
      : format(anchor, "MMMM yyyy");

  const viewOptions = [
    { id: "month" as const, label: "Month", icon: LayoutGrid },
    { id: "week" as const, label: "Week", icon: CalendarDays },
    { id: "agenda" as const, label: "Agenda", icon: List },
  ];

  return (
    <>
      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-full rounded-xl border border-border bg-white p-1 shadow-sm sm:w-auto">
            {viewOptions.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition touch-manipulation min-h-11 sm:flex-initial sm:px-4",
                  view === id ? "bg-accent text-white shadow-sm" : "text-muted hover:bg-slate-50 hover:text-primary"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted sm:max-w-sm sm:text-right">
            <span className="hidden md:inline">Drag shoots to another day to reschedule. </span>
            Tap any event to edit time or open the project.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-slate-50/80 px-3 py-3 sm:px-4">
          <Button variant="ghost" size="sm" className="min-h-11 min-w-11" onClick={navPrev} aria-label="Previous">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 text-center">
            <h2 className="truncate text-base font-semibold text-primary sm:text-lg">{headerLabel}</h2>
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
            <div className="grid grid-cols-7 border-b border-border bg-slate-50 text-center text-[11px] font-semibold uppercase tracking-wide text-muted sm:text-xs">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="py-2.5">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Mobile month grid — compact cells + selected-day list below */}
            <div className="md:hidden">
              <div className="grid grid-cols-7">
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`m-blank-${i}`} className="min-h-[52px] border-b border-r border-border bg-slate-50/40" />
                ))}
                {monthDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayShoots = shootsByDay.get(key) ?? [];
                  return (
                    <MonthDayCell
                      key={`m-${key}`}
                      day={day}
                      dayShoots={dayShoots}
                      isSelected={selectedDayKey === key}
                      isDraggingOver={!!draggingId}
                      variant="mobile"
                      maxVisible={2}
                      onSelectDay={() => setSelectedDayKey(key)}
                      onDrop={(e) => handleDropOnDay(e, day)}
                      onOpenShoot={openShoot}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      draggingId={draggingId}
                    />
                  );
                })}
              </div>

              <div className="border-t border-border bg-slate-50/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-primary">
                  {format(parseISO(`${selectedDayKey}T12:00:00`), "EEEE, MMMM d")}
                </h3>
                {selectedDayShoots.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-white px-4 py-8 text-center text-sm text-muted">
                    No shoots scheduled this day.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedDayShoots.map((shoot) => (
                      <ShootEventCard key={shoot.id} shoot={shoot} onOpen={() => openShoot(shoot)} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop month grid — wider cells with compact draggable cards */}
            <div className="hidden md:grid md:grid-cols-7">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`d-blank-${i}`} className="min-h-[120px] border-b border-r border-border bg-slate-50/40 lg:min-h-[132px]" />
              ))}
              {monthDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayShoots = shootsByDay.get(key) ?? [];
                return (
                  <MonthDayCell
                    key={`d-${key}`}
                    day={day}
                    dayShoots={dayShoots}
                    isSelected={false}
                    isDraggingOver={!!draggingId}
                    variant="desktop"
                    maxVisible={DESKTOP_MONTH_VISIBLE}
                    onSelectDay={() => setSelectedDayKey(key)}
                    onDrop={(e) => handleDropOnDay(e, day)}
                    onOpenShoot={openShoot}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    draggingId={draggingId}
                  />
                );
              })}
            </div>
          </>
        )}

        {view === "week" && (
          <div className="p-3 sm:p-0">
            {/* Mobile: stacked full-width day sections */}
            <div className="space-y-5 md:hidden">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayShoots = shootsByDay.get(key) ?? [];
                const today = isToday(day);
                return (
                  <section
                    key={`wm-${key}`}
                    className="rounded-xl border border-border bg-slate-50/40 p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnDay(e, day)}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                          today ? "bg-accent text-white" : "bg-white text-primary ring-1 ring-border"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-primary">{format(day, "EEEE")}</p>
                        <p className="text-xs text-muted">{format(day, "MMMM d")}</p>
                      </div>
                    </div>
                    {dayShoots.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border bg-white px-3 py-4 text-center text-xs text-muted">
                        No shoots
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dayShoots.map((shoot) => (
                          <ShootEventCard key={shoot.id} shoot={shoot} onOpen={() => openShoot(shoot)} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Desktop: 7-column week grid with compact vertical cards */}
            <div className="hidden md:grid md:grid-cols-7 md:divide-x md:divide-border">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayShoots = shootsByDay.get(key) ?? [];
                const today = isToday(day);

                return (
                  <div
                    key={`wd-${key}`}
                    className="min-h-[320px] min-w-0 px-1.5 py-2 lg:min-h-[360px] lg:px-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnDay(e, day)}
                  >
                    <div className="mb-2 text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{format(day, "EEE")}</p>
                      <p
                        className={cn(
                          "mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                          today && "bg-accent text-white"
                        )}
                      >
                        {format(day, "d")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {dayShoots.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border/80 bg-slate-50/50 px-1 py-6 text-center text-[10px] text-muted">
                          —
                        </div>
                      ) : (
                        dayShoots.map((shoot) => (
                          <ShootEventCard
                            key={shoot.id}
                            shoot={shoot}
                            variant="week"
                            draggable
                            isDragging={draggingId === shoot.id}
                            onOpen={() => openShoot(shoot)}
                            onDragStart={(e) => handleDragStart(e, shoot)}
                            onDragEnd={handleDragEnd}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "agenda" && (
          <div className="space-y-8 p-4 sm:p-6">
            {sortedShoots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted">
                No shoots in this period.
              </p>
            ) : (
              (() => {
                const groups = new Map<string, CalendarShoot[]>();
                sortedShoots.forEach((s) => {
                  const key = format(parseISO(s.proposed_at), "yyyy-MM-dd");
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(s);
                });
                return Array.from(groups.entries()).map(([dateKey, items]) => (
                  <section key={dateKey}>
                    <h3 className="mb-3 border-b border-border pb-2 text-sm font-semibold text-primary sm:text-base">
                      {format(parseISO(`${dateKey}T12:00:00`), "EEEE, MMMM d, yyyy")}
                    </h3>
                    <div className="space-y-3">
                      {items.map((shoot) => (
                        <ShootEventCard key={shoot.id} shoot={shoot} onOpen={() => openShoot(shoot)} />
                      ))}
                    </div>
                  </section>
                ));
              })()
            )}
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Scheduled Shoot">
        {selected && (
          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-black/5 sm:h-20 sm:w-20">
                {selected.cover_url ? (
                  <RemoteImage src={selected.cover_url} alt="" fill className="object-cover" sizes="80px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">—</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-primary">{selected.project_name}</p>
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
    </>
  );
}
