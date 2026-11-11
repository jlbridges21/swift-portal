"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, Loader2 } from "lucide-react";
import { addDays, DASHBOARD_ANALYTICS_MAX_DAYS, dayCount, isIsoDay } from "@/lib/dashboard-analytics";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

/**
 * Dashboard date range: a compact button showing the range, opening presets plus custom
 * From / To dates. Applies the same limits as the analytics API (To ≤ today, ≤ max days).
 */
export function DateRangePicker({
  from,
  to,
  today,
  loading,
  onChange,
}: {
  from: string;
  to: string;
  today: string;
  loading?: boolean;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from);
    setDraftTo(to);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, from, to]);

  const draftError =
    !isIsoDay(draftFrom) || !isIsoDay(draftTo)
      ? "Choose a From and To date."
      : draftFrom > draftTo
        ? "From must be on or before To."
        : draftTo > today
          ? "To can't be in the future."
          : dayCount(draftFrom, draftTo) > DASHBOARD_ANALYTICS_MAX_DAYS
            ? `Choose a range of ${DASHBOARD_ANALYTICS_MAX_DAYS} days or less.`
            : null;

  const activePreset = to === today ? PRESETS.find((p) => from === addDays(today, -(p.days - 1)))?.days : undefined;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-10 max-w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-heading shadow-sm transition hover:border-accent/40"
      >
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" aria-label="Loading" /> : <Calendar className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
        <span className="truncate">
          {fmt(from)} – {fmt(to)}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Dashboard date range"
          className="absolute right-0 top-full z-[60] mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 shadow-xl max-sm:left-0 max-sm:right-auto"
        >
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => {
                  onChange({ from: addDays(today, -(p.days - 1)), to: today });
                  setOpen(false);
                }}
                aria-pressed={activePreset === p.days}
                className={cn(
                  "min-h-9 rounded-lg px-2.5 text-left text-xs font-medium transition-colors",
                  activePreset === p.days ? "bg-accent-subtle text-accent" : "text-heading hover:bg-subtle"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold text-heading">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col text-[11px] font-medium text-muted">
                From
                <input
                  type="date"
                  value={draftFrom}
                  max={draftTo || today}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="mt-0.5 min-h-9 w-full min-w-0 rounded-lg border border-border bg-card px-2 text-sm text-heading"
                />
              </label>
              <label className="flex flex-col text-[11px] font-medium text-muted">
                To
                <input
                  type="date"
                  value={draftTo}
                  min={draftFrom || undefined}
                  max={today}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="mt-0.5 min-h-9 w-full min-w-0 rounded-lg border border-border bg-card px-2 text-sm text-heading"
                />
              </label>
            </div>
            {draftError ? <p className="mt-2 text-xs text-red-600">{draftError}</p> : null}
            <button
              type="button"
              disabled={Boolean(draftError)}
              onClick={() => {
                onChange({ from: draftFrom, to: draftTo });
                setOpen(false);
              }}
              className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
