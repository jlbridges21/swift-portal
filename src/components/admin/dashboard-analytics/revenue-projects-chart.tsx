"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ChartTooltip, useChartTooltip } from "@/components/platform/analytics/chart-tooltip";
import { formatCents, niceAxis, type AnalyticsBucket } from "@/lib/dashboard-analytics";

/**
 * Dual-axis SVG line chart: revenue (cents, left axis) and new projects (count, right
 * axis). Drawn at the container's real pixel width so labels stay legible on phones.
 * Hover, tap, or arrow keys select the nearest period; the tooltip lists only the
 * metrics that are switched on.
 */

type Metric = {
  label: string;
  color: string;
  values: number[];
  enabled: boolean;
  dashed?: boolean;
};

const H = 260;
const PAD_T = 14;
const PAD_B = 28;

function moneyAxis(values: number[]): { lo: number; hi: number; step: number } {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  if (min < 0) {
    const { step } = niceAxis(max - min, 4);
    return { lo: Math.floor(min / step) * step, hi: Math.max(step, Math.ceil(max / step) * step), step };
  }
  const { max: hi, step } = niceAxis(max || 10000, 4);
  return { lo: 0, hi, step };
}

function countAxis(values: number[]): { lo: number; hi: number; step: number } {
  const max = Math.max(0, ...values);
  if (max <= 4) return { lo: 0, hi: 4, step: 1 };
  const { max: hi, step } = niceAxis(max, 4);
  return { lo: 0, hi, step: Math.max(1, step) };
}

function ticks(axis: { lo: number; hi: number; step: number }): number[] {
  const out: number[] = [];
  for (let v = axis.lo; v <= axis.hi + axis.step / 1000; v += axis.step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function RevenueProjectsChart({
  buckets,
  revenue,
  projects,
  emptyMessage,
  onSelect,
}: {
  buckets: AnalyticsBucket[];
  revenue: Metric;
  projects: Metric;
  emptyMessage?: string | null;
  /** Click (mouse), second tap on the same point (touch), or Enter opens a drill-down. */
  onSelect?: (index: number) => void;
}) {
  const { tip, active, show: showTip, clear, hostRef } = useChartTooltip<number>();
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = buckets.length;
  const showRev = revenue.enabled;
  const showProj = projects.enabled;
  const narrow = width < 480;
  const padL = showRev ? (narrow ? 46 : 58) : 14;
  const padR = showProj ? (narrow ? 30 : 40) : 14;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = H - PAD_T - PAD_B;

  const revAxis = moneyAxis(revenue.values);
  const projAxis = countAxis(projects.values);
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = (axis: { lo: number; hi: number }) => (v: number) =>
    PAD_T + innerH - ((v - axis.lo) / (axis.hi - axis.lo || 1)) * innerH;
  const yRev = yFor(revAxis);
  const yProj = yFor(projAxis);

  const labelSpace = narrow ? 52 : 64;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / labelSpace))));
  const showDots = n <= Math.floor(innerW / 9);

  const show = (i: number, anchor: { x: number; y: number }) => {
    const b = buckets[i];
    if (!b) return;
    const rows = [];
    if (showRev) rows.push({ label: revenue.label, value: formatCents(revenue.values[i] ?? 0), color: revenue.color });
    if (showProj) rows.push({ label: projects.label, value: String(projects.values[i] ?? 0), color: projects.color });
    if (onSelect && rows.length) rows.push({ label: "Click to list projects", value: "", emphasis: false });
    showTip(i, { x: anchor.x, y: anchor.y, title: b.title, rows });
  };

  const indexAt = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * width;
    if (n <= 1) return 0;
    return Math.max(0, Math.min(n - 1, Math.round(((sx - padL) / innerW) * (n - 1))));
  };

  const anchorAt = (i: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const ys: number[] = [];
    if (showRev) ys.push(yRev(revenue.values[i] ?? 0));
    if (showProj) ys.push(yProj(projects.values[i] ?? 0));
    const top = ys.length ? Math.min(...ys) : PAD_T;
    return { x: r.left + (x(i) / width) * r.width, y: r.top + (top / H) * r.height };
  };

  const onPointer = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!n || (!showRev && !showProj)) return;
    const i = indexAt(e.clientX);
    show(i, e.pointerType === "mouse" ? { x: e.clientX, y: e.clientY } : anchorAt(i));
  };

  // Touch: the first tap reads the value; tapping the same point again opens it.
  const onPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!n || (!showRev && !showProj)) return;
    const i = indexAt(e.clientX);
    if (e.pointerType !== "mouse" && onSelect && active === i) {
      onSelect(i);
      return;
    }
    onPointer(e);
  };

  const onClick = (e: React.MouseEvent<SVGRectElement>) => {
    if (!onSelect || !n || (!showRev && !showProj)) return;
    const pe = e.nativeEvent as PointerEvent;
    if (pe.pointerType && pe.pointerType !== "mouse") return;
    onSelect(indexAt(e.clientX));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onSelect && active !== null && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onSelect(active);
      return;
    }
    if (!n || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const cur = active ?? (e.key === "ArrowLeft" ? n : -1);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? n - 1 : Math.max(0, Math.min(n - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
    show(next, anchorAt(next));
  };

  const linePath = (values: number[], y: (v: number) => number) =>
    values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const gridAxis = showRev ? revAxis : projAxis;
  const gridY = showRev ? yRev : yProj;
  const noneEnabled = !showRev && !showProj;

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      onKeyDown={onKey}
      onBlur={clear}
      aria-label={`${[showRev && revenue.label, showProj && projects.label].filter(Boolean).join(" and ") || "No metrics"} by period. Use arrow keys to read values${onSelect ? " and Enter to list the projects" : ""}.`}
      className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2"
    >
      <div ref={boxRef} className="w-full min-w-0">
        <svg
          ref={svgRef}
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          className="block h-auto w-full touch-pan-y select-none"
          role="img"
          aria-hidden
        >
          {ticks(gridAxis).map((t) => (
            <line
              key={`g${t}`}
              x1={padL}
              x2={width - padR}
              y1={gridY(t)}
              y2={gridY(t)}
              stroke="currentColor"
              className={t === 0 ? "text-slate-300" : "text-border"}
              strokeDasharray={t === 0 ? undefined : "3 4"}
            />
          ))}
          {showRev
            ? ticks(revAxis).map((t) => (
                <text key={`l${t}`} x={padL - 6} y={yRev(t) + 4} textAnchor="end" fontSize="11" fill={revenue.color}>
                  {formatCents(t, { compact: true })}
                </text>
              ))
            : null}
          {showProj
            ? ticks(projAxis).map((t) => (
                <text key={`r${t}`} x={width - padR + 6} y={yProj(t) + 4} textAnchor="start" fontSize="11" fill={projects.color}>
                  {t}
                </text>
              ))
            : null}

          {active !== null && !noneEnabled ? (
            <line x1={x(active)} x2={x(active)} y1={PAD_T} y2={PAD_T + innerH} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 3" />
          ) : null}

          {showRev && n > 0 ? (
            <g>
              <path
                d={`${linePath(revenue.values, yRev)} L${x(n - 1).toFixed(1)},${yRev(Math.max(0, revAxis.lo))} L${x(0).toFixed(1)},${yRev(Math.max(0, revAxis.lo))} Z`}
                fill={revenue.color}
                opacity="0.08"
              />
              <path d={linePath(revenue.values, yRev)} fill="none" stroke={revenue.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ) : null}
          {showProj && n > 0 ? (
            <path
              d={linePath(projects.values, yProj)}
              fill="none"
              stroke={projects.color}
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={projects.dashed ? "6 4" : undefined}
            />
          ) : null}

          {[showRev ? { m: revenue, y: yRev, k: "r" } : null, showProj ? { m: projects, y: yProj, k: "p" } : null]
            .filter((s): s is { m: Metric; y: (v: number) => number; k: string } => s !== null)
            .map(({ m, y, k }) =>
              m.values.map((v, i) =>
                showDots || active === i ? (
                  <circle
                    key={`${k}${i}`}
                    cx={x(i)}
                    cy={y(v)}
                    r={active === i ? 5 : 2.5}
                    fill={active === i ? "white" : m.color}
                    stroke={m.color}
                    strokeWidth={active === i ? 2.5 : 0}
                  />
                ) : null
              )
            )}

          {buckets.map((b, i) =>
            // Anchor labels on the last period so the newest date is always shown without collisions.
            (n - 1 - i) % labelEvery === 0 ? (
              <text
                key={b.key}
                x={x(i)}
                y={H - 8}
                textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}
                fontSize="11"
                className="fill-current text-muted"
              >
                {b.label}
              </text>
            ) : null
          )}

          <rect
            x={padL - 10}
            y={0}
            width={innerW + 20}
            height={H - PAD_B + 6}
            fill="transparent"
            onPointerMove={onPointer}
            onPointerDown={onPointerDown}
            onClick={onClick}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") clear();
            }}
            style={{ cursor: noneEnabled ? "default" : onSelect ? "pointer" : "crosshair" }}
          />
        </svg>
      </div>
      {noneEnabled ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
          Turn on Revenue or New Projects to chart it.
        </p>
      ) : emptyMessage ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit max-w-[90%] rounded-md bg-card/90 px-3 py-1.5 text-center text-sm text-muted">
          {emptyMessage}
        </p>
      ) : null}
      <ChartTooltip tip={tip} />
    </div>
  );
}
