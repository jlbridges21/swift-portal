"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Shared hover/tap tooltip for analytics charts. Rendered with position: fixed and
 * clamped to the viewport, so chart overflow containers can never clip it.
 */

export type ValueType = "int" | "money" | "pct" | "decimal";

export function formatValue(value: number | null | undefined, type: ValueType = "int"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (type) {
    case "money":
      return (value / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value % 100 ? 2 : 0 });
    case "pct":
      return `${(value * 100).toFixed(1)}%`;
    case "decimal":
      return value.toFixed(1);
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}

export type TooltipRow = { label: string; value: string; color?: string; emphasis?: boolean };
export type TooltipContent = { title: string; rows: TooltipRow[] };
export type TooltipState = (TooltipContent & { x: number; y: number }) | null;

/** Formats an ISO day (YYYY-MM-DD) as "Wed, Oct 15, 2026" without timezone drift. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Tooltip + highlighted-item state for one chart. Every dismissal path (tap outside,
 * scroll, resize, blur, mouse leave) clears both, so highlights never linger.
 */
export function useChartTooltip<K extends string | number>() {
  const [tip, setTipState] = useState<TooltipState>(null);
  const [active, setActive] = useState<K | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const show = (key: K, next: NonNullable<TooltipState>) => {
    setActive(key);
    setTipState(next);
  };
  const clear = () => {
    setActive(null);
    setTipState(null);
  };

  useEffect(() => {
    if (!tip) return;
    const onDown = (e: PointerEvent) => {
      if (hostRef.current && !hostRef.current.contains(e.target as Node)) {
        setActive(null);
        setTipState(null);
      }
    };
    const close = () => {
      setActive(null);
      setTipState(null);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [tip]);

  return { tip, active, show, clear, hostRef };
}

export function ChartTooltip({ tip }: { tip: TooltipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!tip || !ref.current) {
      setPos(null);
      return;
    }
    const { width, height } = ref.current.getBoundingClientRect();
    const margin = 8;
    const gap = 14;
    // Prefer above the pointer; flip below when there isn't room. Clamp horizontally.
    let top = tip.y - height - gap;
    if (top < margin) top = tip.y + gap;
    top = Math.min(top, window.innerHeight - height - margin);
    let left = tip.x - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    setPos({ left, top: Math.max(margin, top) });
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-[60] min-w-[9rem] max-w-[18rem] rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-xs shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] backdrop-blur-sm transition-opacity duration-100"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, opacity: pos ? 1 : 0 }}
    >
      <p className="mb-1.5 font-semibold text-slate-900">{tip.title}</p>
      <ul className="space-y-1">
        {tip.rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-500">
              {r.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden /> : null}
              <span className="truncate">{r.label}</span>
            </span>
            <span className={r.emphasis === false ? "tabular-nums text-slate-600" : "font-semibold tabular-nums text-slate-900"}>
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pointer position helper: uses the pointer for mouse/pen, the element's top-center for touch. */
export function anchorFor(e: React.PointerEvent | React.FocusEvent | React.KeyboardEvent, el: Element): { x: number; y: number } {
  if ("clientX" in e && "pointerType" in e && e.pointerType === "mouse") return { x: e.clientX, y: e.clientY };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top };
}
