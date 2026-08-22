"use client";

import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { DEMO_SHOOTS } from "./demo-data";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Compact month grid inspired by ShootCalendar. */
export function DemoCalendarPanel({
  phase,
}: {
  phase: "idle" | "proposed" | "counter" | "confirmed";
}) {
  // Fixed fictional month layout: days 1–28 starting Wednesday
  const startOffset = 3;
  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-3 py-2.5">
        <div className="flex items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B]">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold text-[#0F172A]">March 2026</h3>
          <span className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B]">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <div className="flex gap-1 text-[11px] font-medium text-[#64748B]">
          <span className="rounded-md bg-[#EEF2FF] px-2 py-1 text-[#4F46E5]">Month</span>
          <span className="rounded-md px-2 py-1">Week</span>
          <span className="rounded-md px-2 py-1">Agenda</span>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-[#F8FAFC] px-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            {d}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-5 gap-px bg-[#E2E8F0] p-px">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`pad-${i}`} className="min-h-[56px] bg-[#F8FAFC]" />
        ))}
        {days.map((day) => {
          const shoot = DEMO_SHOOTS.find((s) => s.day === day);
          const showProposed = shoot?.proposed && (phase === "proposed" || phase === "counter" || phase === "confirmed");
          const showCounter = shoot?.counter && (phase === "counter" || phase === "confirmed");
          const showConfirmed = shoot?.confirmed && phase === "confirmed";
          const active =
            (shoot?.proposed && phase === "proposed") ||
            (shoot?.counter && phase === "counter") ||
            (shoot?.confirmed && phase === "confirmed");

          return (
            <div
              key={day}
              data-demo-target={active ? "calendar-day" : undefined}
              className={`min-h-[56px] bg-white p-1 ${active ? "ring-2 ring-inset ring-[#4F46E5]" : ""}`}
            >
              <span className="text-[11px] font-medium text-[#64748B]">{day}</span>
              {shoot && (showProposed || showCounter || showConfirmed || (!shoot.proposed && !shoot.counter && !shoot.confirmed)) ? (
                <button
                  type="button"
                  tabIndex={-1}
                  className={`mt-0.5 block w-full truncate rounded-md px-1 py-0.5 text-left text-[10px] font-semibold ${
                    showCounter && phase === "counter"
                      ? "bg-amber-50 text-amber-800"
                      : showConfirmed
                        ? "bg-teal-50 text-teal-800"
                        : "bg-[#EEF2FF] text-[#4F46E5]"
                  }`}
                >
                  {showCounter && phase === "counter" ? "4:30 PM · counter" : shoot.time}
                </button>
              ) : shoot ? (
                <span className="mt-0.5 block truncate rounded-full bg-[#EEF2FF]/60 px-1 py-0.5 text-center text-[9px] font-semibold text-[#4F46E5]/70">
                  {shoot.time}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
        {phase === "proposed" ? (
          <p className="flex items-start gap-2 text-xs text-[#475569]">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4F46E5]" aria-hidden />
            Proposed: Saturday 9:00 AM — North Pier Construction Progress
          </p>
        ) : phase === "counter" ? (
          <p className="flex items-start gap-2 text-xs text-[#475569]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
            Client counter-proposed 4:30 PM for Harbor View Twilight Set
          </p>
        ) : phase === "confirmed" ? (
          <p className="flex items-start gap-2 text-xs text-[#475569]">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
            Confirmed: Cedar Grove Exterior + Aerial · 10:00 AM
          </p>
        ) : (
          <p className="text-xs text-[#64748B]">Upcoming shoots appear on the month board — same calendar admins use.</p>
        )}
      </div>
    </div>
  );
}
