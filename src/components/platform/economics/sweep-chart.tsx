"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { ChartTooltip, useChartTooltip } from "@/components/platform/analytics/chart-tooltip";
import { formatUsd } from "@/lib/economics/assumptions";

/**
 * Numeric-x line chart for simulator sweeps (customers, utilization). Values in dollars;
 * may be negative, with a zero line. Hover/tap shows exact values.
 */
export function SweepChart({
  points,
  series,
  xLabel,
  height = 190,
}: {
  points: { x: number; [k: string]: number }[];
  series: { key: string; label: string; color: string; dashed?: boolean }[];
  xLabel: (x: number) => string;
  height?: number;
}) {
  const { tip, active, show, clear, hostRef } = useChartTooltip<number>();
  const svgRef = useRef<SVGSVGElement>(null);
  if (!points.length) return null;
  const vals = points.flatMap((p) => series.map((s) => p[s.key] ?? 0));
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const W = 640;
  const H = height;
  const padL = 52;
  const padB = 22;
  const innerW = W - padL - 10;
  const innerH = H - padB - 10;
  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => 10 + innerH - ((v - min) / (max - min || 1)) * innerH;
  const ticks = min < 0 ? [min, 0, max] : [0, max / 2, max];

  const onPointer = (e: ReactPointerEvent<SVGRectElement>) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(points.length - 1, Math.round(((sx - padL) / innerW) * (points.length - 1))));
    const p = points[i]!;
    show(i, {
      x: e.clientX,
      y: e.clientY,
      title: xLabel(p.x),
      rows: series.map((s) => ({ label: s.label, value: formatUsd(p[s.key] ?? 0), color: s.color })),
    });
  };

  return (
    <div ref={hostRef}>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y select-none" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - 10} y1={y(t)} y2={y(t)} stroke="currentColor" className={t === 0 ? "text-slate-400" : "text-border"} strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="10" className="fill-current text-muted">
              {formatUsd(t, { cents: false })}
            </text>
          </g>
        ))}
        {active !== null ? <line x1={x(active)} x2={x(active)} y1={10} y2={10 + innerH} stroke="#94A3B8" strokeDasharray="3 3" /> : null}
        {series.map((s) => (
          <path
            key={s.key}
            d={points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[s.key] ?? 0).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeDasharray={s.dashed ? "5 4" : undefined}
            strokeLinejoin="round"
          />
        ))}
        {series.map((s) =>
          active !== null ? <circle key={s.key} cx={x(active)} cy={y(points[active]![s.key] ?? 0)} r={4} fill="white" stroke={s.color} strokeWidth={2} /> : null
        )}
        {points.map((p, i) =>
          i % Math.max(1, Math.ceil(points.length / 7)) === 0 || i === points.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" className="fill-current text-muted">
              {xLabel(p.x)}
            </text>
          ) : null
        )}
        <rect
          x={padL - 10}
          y={0}
          width={innerW + 20}
          height={H - padB + 6}
          fill="transparent"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={(e) => e.pointerType === "mouse" && clear()}
        />
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
