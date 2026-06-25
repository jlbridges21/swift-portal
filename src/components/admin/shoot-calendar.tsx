"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, addMonths, subMonths, parseISO,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CalendarShoot {
  id: string;
  project_id: string;
  proposed_at: string;
  project_name: string;
  client_name: string;
  property_address: string;
}

interface ShootCalendarProps {
  shoots: CalendarShoot[];
}

export function ShootCalendar({ shoots: initialShoots }: ShootCalendarProps) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shoots, setShoots] = useState(initialShoots);
  const [selected, setSelected] = useState<CalendarShoot | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [saving, setSaving] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const shootsByDay = useMemo(() => {
    const map = new Map<string, CalendarShoot[]>();
    shoots.forEach((s) => {
      const key = format(parseISO(s.proposed_at), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [shoots]);

  const leadingBlanks = monthStart.getDay();

  function openShoot(shoot: CalendarShoot) {
    const d = parseISO(shoot.proposed_at);
    setSelected(shoot);
    setEditDate(format(d, "yyyy-MM-dd"));
    setEditTime(format(d, "HH:mm"));
  }

  async function saveShootDate() {
    if (!selected || !editDate) return;
    setSaving(true);
    const proposed_at = new Date(`${editDate}T${editTime || "09:00"}`).toISOString();

    const res = await fetch("/api/shoot-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: selected.id, action: "update_date", proposed_at }),
    });

    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to update shoot date");
      return;
    }

    setShoots((prev) =>
      prev.map((s) => (s.id === selected.id ? { ...s, proposed_at } : s))
    );
    toast.success("Shoot date updated");
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-primary">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-slate-50 text-center text-xs font-medium text-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[100px] border-b border-r border-border bg-slate-50/50" />
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayShoots = shootsByDay.get(key) ?? [];
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={key}
                className={cn(
                  "min-h-[100px] border-b border-r border-border p-1.5",
                  !isSameMonth(day, currentMonth) && "bg-slate-50/30"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday && "bg-accent text-white"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-1">
                  {dayShoots.map((shoot) => (
                    <button
                      key={`cal-${shoot.id}`}
                      type="button"
                      onClick={() => openShoot(shoot)}
                      className="w-full rounded-md bg-accent/10 px-1.5 py-1 text-left text-[10px] font-medium text-accent hover:bg-accent/20 transition-colors line-clamp-2"
                    >
                      {format(parseISO(shoot.proposed_at), "h:mm a")} · {shoot.project_name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Scheduled Shoot">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-primary">{selected.project_name}</p>
              <p className="text-sm text-muted">{selected.client_name}</p>
              <p className="text-sm text-muted">{selected.property_address}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="accent" onClick={saveShootDate} disabled={saving}>
                {saving ? "Saving..." : "Save Date"}
              </Button>
              <Link href={`/admin/projects/${selected.project_id}`}>
                <Button variant="outline">
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
