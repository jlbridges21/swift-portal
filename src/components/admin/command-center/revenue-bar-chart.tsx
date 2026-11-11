"use client";

import { useEffect, useRef, useState } from "react";
import { ChartTooltip, anchorFor, useChartTooltip } from "@/components/platform/analytics/chart-tooltip";
import { formatCents, niceAxis, type AnalyticsBucket } from "@/lib/dashboard-analytics";
import { cn } from "@/lib/utils";

/**
 * Revenue / New Projects bar chart for the Command Center. Drawn at the container's pixel
 * width so labels stay legible. One or two series: with two, each period gets a pair of
 * side-by-side bars, money on the left axis and counts on the right (gridlines shared).
 * Hover / tap / focus a period for its values; click (or a second tap) opens the period's
 * projects, same drill-down as the full analytics chart.
 */

export type BarSeries = {
  key: string;
  label: string;
  values: number[];
  color: string;
  /** "money" values are cents. */
  format: "money" | "count";
};

const PAD_T = 8;
const PAD_B = 22;
const PAD_L = 46;
const PAD_R_DUAL = 30;

type Axis = { lo: number; hi: number; step: number };

function moneyAxis(values: number[]): Axis {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  if (min < 0) {
    const { step } = niceAxis(max - min, 4);
    return { lo: Math.floor(min / step) * step, hi: Math.max(step, Math.ceil(max / step) * step), step };
  }
  const { max: hi, step } = niceAxis(max || 10000, 4);
  return { lo: 0, hi, step };
}

/** Integer step (1, 2, 5, 10, 20, 25, 50…) so `positive` intervals reach `max`. */
function countStep(max: number, positive: number): number {
  const rough = max / Math.max(1, positive);
  if (rough <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const n = rough / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return Math.max(1, Math.ceil(nice * pow));
}

/**
 * Count axis laid on the same gridlines as `base` (same interval count, zero on the same
 * line), so paired bars share a baseline even when refunds push revenue below zero.
 */
function countAxis(values: number[], base?: Axis): Axis {
  const max = Math.max(0, ...values);
  const intervals = base ? Math.round((base.hi - base.lo) / base.step) : 4;
  const below = base ? Math.round(-base.lo / base.step) : 0;
  const step = countStep(max, intervals - below);
  return { lo: below ? -below * step : 0, hi: (intervals - below) * step, step };
}

function formatValue(s: BarSeries, v: number, compact = false): string {
  return s.format === "money" ? formatCents(v, { compact }) : Math.round(v).toLocaleString("en-US");
}

export function RevenueBarChart({
  buckets,
  series,
  height = 168,
  emptyMessage,
  onSelect,
}: {
  buckets: AnalyticsBucket[];
  /** One or two series; with two, the second is read against the right-hand axis. */
  series: BarSeries[];
  height?: number;
  emptyMessage?: string;
  onSelect?: (index: number) => void;
}) {
  const { tip, active, show, clear, hostRef } = useChartTooltip<number>();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const lastTap = useRef<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dual = series.length > 1;
  // Money keeps the left axis; a count-only chart uses it for counts.
  const leftAxis = series[0]?.format === "money" ? moneyAxis(series[0].values) : countAxis(series[0]?.values ?? []);
  const axes: Axis[] = series.map((s, i) => (i === 0 ? leftAxis : s.format === "money" ? moneyAxis(s.values) : countAxis(s.values, leftAxis)));

  const n = Math.max(1, buckets.length);
  const padR = dual ? PAD_R_DUAL : 0;
  const plotW = width - PAD_L - padR;
  const plotH = height - PAD_T - PAD_B;
  const yOn = (axis: Axis) => (v: number) => PAD_T + plotH - ((v - axis.lo) / (axis.hi - axis.lo || 1)) * plotH;
  const y0 = yOn(leftAxis);
  const slot = plotW / n;
  const groupW = Math.min(dual ? 40 : 28, slot * (dual ? 0.74 : 0.62));
  const gap = dual && groupW >= 10 ? Math.min(3, groupW * 0.12) : 0;
  const barW = Math.max(1, (groupW - gap * (series.length - 1)) / Math.max(1, series.length));
  const ticks: number[] = [];
  for (let v = leftAxis.lo; v <= leftAxis.hi + leftAxis.step / 1000; v += leftAxis.step) ticks.push(Math.round(v));
  const rightAxis = dual ? axes[1]! : null;
  // About six evenly spaced date labels, always including the first and last.
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 72))));
  const empty = series.every((s) => s.values.every((v) => v === 0));

  const describe = (i: number) => series.map((s) => `${s.label} ${formatValue(s, s.values[i] ?? 0)}`).join(", ");

  const tipFor = (i: number, anchor: { x: number; y: number }) =>
    show(i, {
      x: anchor.x,
      y: anchor.y,
      title: buckets[i]?.title ?? "",
      rows: [
        ...series.map((s) => ({ label: s.label, value: formatValue(s, s.values[i] ?? 0), color: s.color })),
        ...(onSelect ? [{ label: "Click to see its projects", value: "", emphasis: false }] : []),
      ],
    });

  return (
    <div ref={hostRef} className="relative w-full min-w-0">
      <div ref={boxRef} className="w-full min-w-0">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block touch-pan-y select-none"
          role="img"
          aria-label={`${series.map((s) => s.label).join(" and ")} by period`}
          onPointerLeave={(e) => e.pointerType === "mouse" && clear()}
        >
          {ticks.map((t, ti) => {
            const rv = rightAxis ? rightAxis.lo + ti * rightAxis.step : null;
            return (
              <g key={t}>
                <line x1={PAD_L} x2={width - padR} y1={y0(t)} y2={y0(t)} className="stroke-border" strokeDasharray={t === 0 ? undefined : "3 4"} />
                <text x={PAD_L - 8} y={y0(t) + 4} textAnchor="end" fontSize="11" className="fill-current text-muted">
                  {formatValue(series[0]!, t, true)}
                </text>
                {rightAxis && rv !== null && rv >= 0 ? (
                  <text x={width - padR + 8} y={y0(t) + 4} textAnchor="start" fontSize="11" style={{ fill: series[1]!.color }}>
                    {formatValue(series[1]!, rv, true)}
                  </text>
                ) : null}
              </g>
            );
          })}
          {buckets.map((b, i) => {
            const isActive = active === i;
            const groupX = PAD_L + slot * i + (slot - groupW) / 2;
            return (
              <g key={b.key}>
                {/* Full-height hit target so thin bars are easy to hover and tap. */}
                <rect
                  x={PAD_L + slot * i}
                  y={PAD_T}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  className={onSelect ? "cursor-pointer" : undefined}
                  tabIndex={0}
                  role="button"
                  aria-label={`${b.title}: ${describe(i)}`}
                  onPointerEnter={(e) => tipFor(i, anchorFor(e, e.currentTarget))}
                  onPointerMove={(e) => e.pointerType === "mouse" && tipFor(i, { x: e.clientX, y: e.clientY })}
                  onFocus={(e) => tipFor(i, anchorFor(e, e.currentTarget))}
                  onBlur={clear}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && onSelect) {
                      e.preventDefault();
                      onSelect(i);
                    }
                  }}
                  onPointerUp={(e) => {
                    if (!onSelect) return;
                    // Touch: first tap shows the values, a second tap on the same period opens it.
                    if (e.pointerType !== "mouse" && lastTap.current !== i) {
                      lastTap.current = i;
                      tipFor(i, anchorFor(e, e.currentTarget));
                      return;
                    }
                    lastTap.current = null;
                    clear();
                    onSelect(i);
                  }}
                />
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  const y = yOn(axes[si]!);
                  const top = y(Math.max(0, v));
                  const bottom = y(Math.min(0, v));
                  const h = Math.max(v === 0 ? 0 : 2, bottom - top);
                  if (h <= 0) return null;
                  return (
                    <rect
                      key={s.key}
                      x={groupX + si * (barW + gap)}
                      y={top}
                      width={barW}
                      height={h}
                      rx={Math.min(4, barW / 2)}
                      fill={s.color}
                      opacity={active === null || isActive ? (v < 0 ? 0.45 : 0.9) : 0.35}
                      className="pointer-events-none transition-opacity"
                    />
                  );
                })}
                {i % labelEvery === 0 || i === n - 1 ? (
                  <text
                    x={PAD_L + slot * i + slot / 2}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize="11"
                    className={cn(
                      "pointer-events-none fill-current text-muted",
                      // Drop the last label if it would collide with the previous one.
                      i === n - 1 && i % labelEvery !== 0 && (i % labelEvery) < labelEvery / 2 && "hidden"
                    )}
                  >
                    {b.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {empty ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 pl-12 text-center text-xs text-muted">
          {emptyMessage ?? "No activity in this range."}
        </p>
      ) : null}
      <ChartTooltip tip={tip} />
    </div>
  );
}
