"use client";

import type { CalendarLeg } from "@/lib/booking/calendar-travel";
import { useContext, useMemo, useState } from "react";
import { Car, CalendarDays, Clock, Route } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/admin/booking/booking-ui";
import { SchedulePanel } from "@/components/admin/booking/schedule-panel";
import { zonedParts } from "@/lib/booking/time";
import type { CalendarCreateProject } from "@/components/admin/shoot-calendar-mobile";
import { createContext } from "react";

type SummaryShoot = { id: string; proposed_at: string; end_at?: string | null; proposal_status?: string };

/** Optional travel data for the summary (provided by the calendar). */
export const DayTravelContext = createContext<Record<string, CalendarLeg>>({});

/** One-line route summary for the selected day: shoots, drive time, first start, last finish. */
export function DayRouteSummary({
  dayKey,
  shoots,
  timeZone,
  travel,
}: {
  dayKey: string;
  shoots: SummaryShoot[];
  timeZone: string;
  travel?: Record<string, CalendarLeg>;
}) {
  const ctxTravel = useContext(DayTravelContext);
  const legs = travel ?? ctxTravel;
  const day = useMemo(
    () => shoots.filter((s) => s.proposal_status !== "pending" && zonedParts(Date.parse(s.proposed_at), timeZone).dayKey === dayKey),
    [shoots, dayKey, timeZone]
  );
  // Every drive that day: from home or the previous shoot into each shoot, and home after the last.
  const driveMinutes = day.reduce((sum, s) => sum + (legs[s.id]?.minutes ?? 0) + (legs[s.id]?.out?.minutes ?? 0), 0);
  const driveMiles = day.reduce((sum, s) => sum + (legs[s.id]?.miles ?? 0) + (legs[s.id]?.out?.miles ?? 0), 0);
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
  const label = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${dayKey}T12:00:00Z`)
  );
  const last = day[day.length - 1];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border bg-card px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2 font-semibold text-heading">
        <Route className="h-4 w-4 text-accent" aria-hidden /> {label}
      </span>
      <span className="flex items-center gap-1.5 text-muted">
        <CalendarDays className="h-4 w-4" aria-hidden /> {day.length} shoot{day.length === 1 ? "" : "s"}
      </span>
      {day.length ? (
        <span className="flex items-center gap-1.5 text-muted">
          <Car className="h-4 w-4" aria-hidden /> {driveMinutes ? `${driveMinutes} min driving · ${Math.round(driveMiles)} mi` : "Drive times unavailable"}
        </span>
      ) : null}
      {day.length ? (
        <span className="flex items-center gap-1.5 text-muted">
          <Clock className="h-4 w-4" aria-hidden /> {fmt(day[0].proposed_at)} – {last.end_at ? fmt(last.end_at) : fmt(last.proposed_at)}
        </span>
      ) : (
        <span className="text-muted">Open day</span>
      )}
    </div>
  );
}

/** "Book shoot": pick a project, then schedule it through the booking engine. */
export function BookShootDialog({
  open,
  onClose,
  projects,
  timeZone,
  team,
  onBooked,
  calendarOverride = false,
}: {
  open: boolean;
  onClose: () => void;
  projects: CalendarCreateProject[];
  timeZone: string;
  team: { userId: string; name: string }[];
  onBooked: () => void;
  /** Owner/admin on the Shoot Calendar: book any time, overriding availability. */
  calendarOverride?: boolean;
}) {
  const [projectId, setProjectId] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Book a shoot" className="sm:max-w-2xl">
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground">Project</span>
          <NativeSelect
            ariaLabel="Project"
            value={projectId}
            onChange={setProjectId}
            options={[{ value: "", label: projects.length ? "Choose a project…" : "No projects yet" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </label>
        {projectId ? (
          <SchedulePanel
            key={projectId}
            projectId={projectId}
            timeZone={timeZone}
            team={team}
            canOverride
            calendarOverride={calendarOverride}
            onDone={onBooked}
          />
        ) : (
          <p className="text-sm text-muted">
            Shoots are booked with the same rules clients see: working hours, buffers, drive time, daily limits and your calendars.
          </p>
        )}
      </div>
    </Modal>
  );
}
