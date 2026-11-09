"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FilterTrigger, useDismiss } from "@/components/ui/checkbox-dropdown";

export type DateRangePreset = "all" | "today" | "7d" | "30d" | "year" | "custom";

export interface DateRangeValue {
  preset: DateRangePreset;
  /** yyyy-mm-dd (local), custom only */
  start?: string;
  /** yyyy-mm-dd (local), custom only */
  end?: string;
}

export const ALL_TIME: DateRangeValue = { preset: "all" };

const PRESETS: { value: Exclude<DateRangePreset, "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseLocalDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatShort(ymd: string): string {
  const d = parseLocalDate(ymd);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ymd;
}

/** Inclusive ISO bounds (local-time days) for a range; undefined = unbounded. */
export function dateRangeToIso(value: DateRangeValue, now = new Date()): { from?: string; to?: string } {
  const today = startOfLocalDay(now);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };
  switch (value.preset) {
    case "today":
      return { from: today.toISOString() };
    case "7d":
      return { from: daysAgo(6) };
    case "30d":
      return { from: daysAgo(29) };
    case "year":
      return { from: new Date(today.getFullYear(), 0, 1).toISOString() };
    case "custom": {
      const start = value.start ? parseLocalDate(value.start) : null;
      const end = value.end ? parseLocalDate(value.end) : null;
      if (end) end.setHours(23, 59, 59, 999);
      return { from: start?.toISOString(), to: end?.toISOString() };
    }
    default:
      return {};
  }
}

export function isDateRangeActive(value: DateRangeValue): boolean {
  if (value.preset === "custom") return Boolean(value.start || value.end);
  return value.preset !== "all";
}

export function describeDateRange(value: DateRangeValue): string | null {
  if (!isDateRangeActive(value)) return null;
  if (value.preset !== "custom") return PRESETS.find((p) => p.value === value.preset)?.label ?? null;
  if (value.start && value.end) return `${formatShort(value.start)} – ${formatShort(value.end)}`;
  if (value.start) return `From ${formatShort(value.start)}`;
  return `Until ${formatShort(value.end!)}`;
}

/** Date range picker: quick presets plus a custom start / end date. */
export function DateRangeFilter({
  label = "Date",
  value,
  onChange,
  className,
}: {
  label?: string;
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useDismiss(open, ref, () => setOpen(false));

  const start = value.preset === "custom" ? value.start ?? "" : "";
  const end = value.preset === "custom" ? value.end ?? "" : "";
  const invalid = Boolean(start && end && start > end);

  function setCustom(next: { start?: string; end?: string }) {
    const s = next.start ?? start;
    const e = next.end ?? end;
    onChange(s || e ? { preset: "custom", start: s || undefined, end: e || undefined } : ALL_TIME);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <FilterTrigger
        label={label}
        summary={describeDateRange(value)}
        active={isDateRangeActive(value)}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        onClear={() => onChange(ALL_TIME)}
        controls={panelId}
      />
      {open ? (
        <div
          id={panelId}
          className="absolute left-0 z-30 mt-2 w-full min-w-72 rounded-xl border border-border bg-white surface-dark:bg-card p-3 shadow-lg"
        >
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map((p) => {
              const activePreset = value.preset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    onChange(p.value === "all" ? ALL_TIME : { preset: p.value });
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50 surface-dark:hover:bg-subtle",
                    activePreset && "bg-accent/10 font-medium text-heading"
                  )}
                  aria-pressed={activePreset}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                Start
                <input
                  type="date"
                  value={start}
                  max={end || undefined}
                  onChange={(e) => setCustom({ start: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white surface-dark:bg-card px-2 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted">
                End
                <input
                  type="date"
                  value={end}
                  min={start || undefined}
                  onChange={(e) => setCustom({ end: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white surface-dark:bg-card px-2 text-sm text-foreground"
                />
              </label>
            </div>
            {invalid ? (
              <p className="mt-2 text-xs text-red-600">Start date is after the end date.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
