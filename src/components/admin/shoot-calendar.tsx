"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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

interface ShootCalendarProps {
  shoots: CalendarShoot[];
}

function ShootEventCard({
  shoot,
  compact,
  draggable,
  onOpen,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  shoot: CalendarShoot;
  compact?: boolean;
  draggable?: boolean;
  onOpen: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const time = format(parseISO(shoot.proposed_at), "h:mm a");

  if (compact) {
    return (
      <button
        type="button"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-1 rounded-md bg-accent/10 px-1.5 py-1 text-left text-[10px] font-medium text-accent hover:bg-accent/20 transition-colors touch-manipulation",
          isDragging && "opacity-40"
        )}
      >
        {draggable && <GripVertical className="h-3 w-3 shrink-0 opacity-50 hidden sm:block" />}
        <span className="line-clamp-2">
          {time} · {shoot.project_name}
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
        "flex w-full gap-3 rounded-xl border border-border bg-white p-3 text-left shadow-sm transition hover:border-accent/40 hover:shadow touch-manipulation",
        isDragging && "opacity-40"
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {shoot.cover_url ? (
          <RemoteImage src={shoot.cover_url} alt="" fill className="object-cover" sizes="56px" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">—</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-primary truncate">{shoot.project_name}</p>
          <Badge className={cn("text-[10px]", getStatusColor(shoot.status))}>
            {getStatusLabel(shoot.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted truncate">{shoot.property_address}</p>
        <p className="text-xs text-muted mt-0.5">
          {shoot.client_name} · {shoot.service_type}
        </p>
        <p className="text-sm font-medium text-accent mt-1">{time}</p>
      </div>
      {draggable && <GripVertical className="h-4 w-4 shrink-0 self-center text-muted hidden sm:block" />}
    </button>
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

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border bg-white p-1 shadow-sm">
          {(
            [
              { id: "month" as const, label: "Month", icon: LayoutGrid },
              { id: "week" as const, label: "Week", icon: CalendarDays },
              { id: "agenda" as const, label: "Agenda", icon: List },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition touch-manipulation min-h-11",
                view === id ? "bg-accent text-white" : "text-muted hover:text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden xs:inline">{label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted sm:max-w-xs">
          Drag shoots to another day to reschedule. Tap any event to edit time or open the project.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 gap-2">
          <Button variant="ghost" size="sm" className="min-h-11 min-w-11" onClick={navPrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-primary">{headerLabel}</h2>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted" onClick={() => setAnchor(new Date())}>
              Today
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="min-h-11 min-w-11" onClick={navNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {view === "month" && (
          <>
            <div className="grid grid-cols-7 border-b border-border bg-slate-50 text-center text-xs font-medium text-muted">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[88px] sm:min-h-[110px] border-b border-r border-border bg-slate-50/50" />
              ))}
              {monthDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayShoots = shootsByDay.get(key) ?? [];
                const today = isToday(day);

                return (
                  <div
                    key={key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnDay(e, day)}
                    className={cn(
                      "min-h-[88px] sm:min-h-[110px] border-b border-r border-border p-1.5 transition-colors",
                      draggingId && "bg-accent/5"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        today && "bg-accent text-white"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayShoots.map((shoot) => (
                        <ShootEventCard
                          key={shoot.id}
                          shoot={shoot}
                          compact
                          draggable
                          isDragging={draggingId === shoot.id}
                          onOpen={() => openShoot(shoot)}
                          onDragStart={(e) => handleDragStart(e, shoot)}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === "week" && (
          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-7 divide-x divide-border">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayShoots = shootsByDay.get(key) ?? [];
                const today = isToday(day);

                return (
                  <div
                    key={key}
                    className="min-h-[320px] p-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnDay(e, day)}
                  >
                    <div className="mb-2 text-center">
                      <p className="text-xs font-medium text-muted">{format(day, "EEE")}</p>
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
                      {dayShoots.map((shoot) => (
                        <ShootEventCard
                          key={shoot.id}
                          shoot={shoot}
                          draggable
                          isDragging={draggingId === shoot.id}
                          onOpen={() => openShoot(shoot)}
                          onDragStart={(e) => handleDragStart(e, shoot)}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "agenda" && (
          <div className="divide-y divide-border p-4 space-y-6">
            {sortedShoots.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No shoots in this period.</p>
            ) : (
              (() => {
                const groups = new Map<string, CalendarShoot[]>();
                sortedShoots.forEach((s) => {
                  const key = format(parseISO(s.proposed_at), "yyyy-MM-dd");
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(s);
                });
                return Array.from(groups.entries()).map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <h3 className="mb-3 text-sm font-semibold text-primary">
                      {format(parseISO(`${dateKey}T12:00:00`), "EEEE, MMMM d, yyyy")}
                    </h3>
                    <div className="space-y-3">
                      {items.map((shoot) => (
                        <ShootEventCard
                          key={shoot.id}
                          shoot={shoot}
                          onOpen={() => openShoot(shoot)}
                        />
                      ))}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Scheduled Shoot">
        {selected && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {selected.cover_url ? (
                  <RemoteImage src={selected.cover_url} alt="" fill className="object-cover" sizes="64px" />
                ) : null}
              </div>
              <div>
                <p className="font-semibold text-primary">{selected.project_name}</p>
                <p className="text-sm text-muted">{selected.client_name}</p>
                <p className="text-sm text-muted">{selected.property_address}</p>
                <p className="text-xs text-muted mt-1">{selected.service_type}</p>
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

            <div className="flex flex-wrap gap-2 pt-2">
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
