"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Camera, Home, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMilesShort, formatMinutes, type DriveLeg } from "@/lib/team-pay/types";

const FROM: Record<DriveLeg["kind"], { from: string; to: string }> = {
  from_home: { from: "Home", to: "Shoot" },
  from_previous: { from: "Last shoot", to: "Shoot" },
  home: { from: "Shoot", to: "Home" },
};

function Stop({ label }: { label: string }) {
  const Icon = label === "Home" ? Home : Camera;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-heading">
      <Icon className="h-3.5 w-3.5 text-muted" aria-hidden />
      {label}
    </span>
  );
}

/** Each counted drive as "Home → Shoot · 30 min · 15 mi", so nobody has to guess one way or round trip. */
export function DriveLegList({ legs, className, showTotal = false }: { legs: DriveLeg[]; className?: string; showTotal?: boolean }) {
  const totalMinutes = legs.reduce((sum, l) => sum + l.minutes, 0);
  const totalMiles = legs.reduce((sum, l) => sum + l.miles, 0);
  return (
    <ul className={cn("space-y-1", className)}>
      {legs.map((leg, i) => (
        <li key={leg.kind} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
          {showTotal && i > 0 ? <span className="w-3 text-muted">+</span> : showTotal ? <span className="w-3" /> : null}
          <Stop label={FROM[leg.kind].from} />
          <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
          <Stop label={FROM[leg.kind].to} />
          <span className="text-muted">
            · {formatMinutes(leg.minutes)} · {formatMilesShort(leg.miles)}
          </span>
        </li>
      ))}
      {showTotal && legs.length > 1 ? (
        <li className="flex items-center gap-x-1.5 border-t border-border pt-1 text-sm font-medium text-heading">
          <span className="w-3 text-muted">=</span>
          Enter {formatMilesShort(totalMiles)} · {formatMinutes(totalMinutes)}
        </li>
      ) : null}
    </ul>
  );
}

/**
 * A small (i) that explains a field. Opens on hover or keyboard focus, and on tap (phones have
 * no hover); closes on Escape or a tap elsewhere.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = open || pinned;

  useEffect(() => {
    if (!pinned) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      setPinned(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [pinned]);

  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={shown ? id : undefined}
        aria-expanded={shown}
        onClick={() => setPinned((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors",
          shown ? "bg-accent-subtle text-accent" : "text-muted hover:bg-subtle hover:text-accent"
        )}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {shown ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl sm:left-1/2 sm:-translate-x-1/2 border border-border bg-card p-3 text-left text-sm font-normal text-foreground shadow-lg"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
