"use client";

import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { EmptyChart } from "@/components/platform/analytics/ui";
import {
  ChartTooltip,
  anchorFor,
  formatDay,
  formatValue,
  useChartTooltip,
  type ValueType,
} from "@/components/platform/analytics/chart-tooltip";
import { cn } from "@/lib/utils";

/**
 * Dependency-free SVG/CSS charts for the analytics dashboard (the repo has no chart
 * library). Every chart shows an exact-value tooltip on hover, tap, or keyboard focus
 * (arrow keys move between points). Hit areas span the full column/row so small and
 * zero values are easy to target. Display only: values are rendered as passed in.
 */

function shortDay(day: string) {
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
}

type Point = { day: string; [k: string]: number | string };

export function TrendChart({
  points,
  series,
  height = 200,
}: {
  points: Point[];
  series: { key: string; label: string; color: string; type?: ValueType }[];
  height?: number;
}) {
  const { tip, active, show: showTip, clear, hostRef } = useChartTooltip<number>();
  const svgRef = useRef<SVGSVGElement>(null);

  const values = points.flatMap((p) => series.map((s) => Number(p[s.key] ?? 0)));
  const max = Math.max(1, ...values);
  if (!points.length || values.every((v) => v === 0)) return <EmptyChart>No data in this range yet.</EmptyChart>;

  const W = 720;
  const H = height;
  const padL = 36;
  const padB = 22;
  const innerW = W - padL - 8;
  const innerH = H - padB - 8;
  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => 8 + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  const show = (i: number, anchor: { x: number; y: number }) => {
    const p = points[i]!;
    showTip(i, {
      x: anchor.x,
      y: anchor.y,
      title: formatDay(p.day),
      rows: series.map((s) => ({ label: s.label, value: formatValue(Number(p[s.key] ?? 0), s.type ?? "int"), color: s.color })),
    });
  };

  /** Nearest point to the pointer, in SVG coordinates. */
  const indexAt = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    if (points.length === 1) return 0;
    return Math.max(0, Math.min(points.length - 1, Math.round(((sx - padL) / innerW) * (points.length - 1))));
  };

  /** Viewport anchor above the highest series value at index i. */
  const anchorAt = (i: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const top = Math.min(...series.map((s) => y(Number(points[i]![s.key] ?? 0))));
    return { x: r.left + (x(i) / W) * r.width, y: r.top + (top / H) * r.height };
  };

  const onPointer = (e: ReactPointerEvent<SVGRectElement>) => {
    const i = indexAt(e.clientX);
    show(i, e.pointerType === "mouse" ? { x: e.clientX, y: e.clientY } : anchorAt(i));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const cur = active ?? (e.key === "ArrowLeft" ? points.length : -1);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
    show(next, anchorAt(next));
  };

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      onKeyDown={onKey}
      onFocus={(e) => {
        if (e.target === e.currentTarget && active === null) show(points.length - 1, anchorAt(points.length - 1));
      }}
      onBlur={clear}
      aria-label={`${series.map((s) => s.label).join(" and ")} by day. Use arrow keys to read values.`}
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
    >
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y select-none" role="img" aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border" strokeDasharray="3 4" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="10" className="fill-current text-muted">
              {formatValue(t, series[0]?.type === "money" ? "money" : "int")}
            </text>
          </g>
        ))}
        {active !== null ? (
          <line x1={x(active)} x2={x(active)} y1={8} y2={8 + innerH} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 3" />
        ) : null}
        {series.map((s, si) => {
          const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(Number(p[s.key] ?? 0)).toFixed(1)}`).join(" ");
          const area = `${d} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
          return (
            <g key={s.key}>
              {si === 0 ? <path d={area} fill={s.color} opacity="0.08" /> : null}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(Number(p[s.key] ?? 0))}
                  r={active === i ? 5 : points.length > 45 ? 1.5 : 3}
                  fill={active === i ? "white" : s.color}
                  stroke={s.color}
                  strokeWidth={active === i ? 2.5 : 0}
                />
              ))}
            </g>
          );
        })}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" className="fill-current text-muted">
              {shortDay(p.day)}
            </text>
          ) : null
        )}
        {/* Full-height hit area: hover/tap anywhere selects the nearest day. */}
        <rect
          x={padL - 12}
          y={0}
          width={innerW + 24}
          height={H - padB + 6}
          fill="transparent"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") clear();
          }}
          style={{ cursor: "crosshair" }}
        />
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}

export function ColumnChart({
  points,
  valueKey,
  label,
  color = "#4F46E5",
  type = "int",
}: {
  points: Point[];
  valueKey: string;
  label: string;
  color?: string;
  type?: ValueType;
}) {
  const { tip, active, show: showTip, clear, hostRef } = useChartTooltip<number>();
  const vals = points.map((p) => Number(p[valueKey] ?? 0));
  const max = Math.max(1, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return <EmptyChart>No {label.toLowerCase()} in this range.</EmptyChart>;
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  const show = (i: number, anchor: { x: number; y: number }) =>
    showTip(i, { x: anchor.x, y: anchor.y, title: formatDay(points[i]!.day), rows: [{ label, value: formatValue(vals[i]!, type), color }] });

  return (
    <div ref={hostRef}>
      <div className="flex h-36 items-end gap-[2px] touch-pan-y" role="group" aria-label={`${label} per day, total ${formatValue(total, type)}`}>
        {points.map((p, i) => (
          <button
            key={p.day}
            type="button"
            aria-label={`${formatDay(p.day)}: ${formatValue(vals[i]!, type)} ${label.toLowerCase()}`}
            className="group relative flex h-full flex-1 cursor-default items-end rounded-sm outline-none focus-visible:bg-indigo-50"
            onPointerEnter={(e) => show(i, anchorFor(e, e.currentTarget.firstElementChild ?? e.currentTarget))}
            onPointerMove={(e) => e.pointerType === "mouse" && show(i, { x: e.clientX, y: e.clientY })}
            onPointerDown={(e) => show(i, anchorFor(e, e.currentTarget.firstElementChild ?? e.currentTarget))}
            onPointerLeave={(e) => e.pointerType === "mouse" && clear()}
            onFocus={(e) => show(i, anchorFor(e, e.currentTarget.firstElementChild ?? e.currentTarget))}
            onBlur={clear}
          >
            {/* Full-height hover column so zero and tiny values are easy to target. */}
            <span className={cn("absolute inset-0 rounded-sm transition-colors", active === i ? "bg-slate-100" : "bg-transparent")} aria-hidden />
            <span
              className="relative w-full rounded-t-sm transition-opacity"
              style={{
                height: `${(vals[i]! / max) * 100}%`,
                minHeight: vals[i] ? 3 : 0,
                background: color,
                opacity: active === null || active === i ? 1 : 0.55,
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-muted" aria-hidden>
        {points.map((p, i) => (
          <span key={p.day} className="flex-1 text-center">
            {i % labelEvery === 0 ? shortDay(p.day) : ""}
          </span>
        ))}
      </div>
      <ChartTooltip tip={tip} />
    </div>
  );
}

export type BarRow = {
  key: string;
  label: string;
  value: number;
  color?: string;
  sub?: string;
  /** Extra metrics shown in the tooltip (e.g. impressions, CTR, position). */
  details?: { label: string; value: number | null; type?: ValueType }[];
};

export function BarList({
  rows,
  type = "int",
  metric = "Value",
  empty = "No data in this range yet.",
}: {
  rows: BarRow[];
  type?: ValueType;
  /** Metric name shown in the tooltip, e.g. "Sessions" or "Clicks". */
  metric?: string;
  empty?: string;
}) {
  const { tip, active, show: showTip, clear, hostRef } = useChartTooltip<string>();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.some((r) => r.value > 0)) return <EmptyChart>{empty}</EmptyChart>;

  const show = (r: BarRow, anchor: { x: number; y: number }) =>
    showTip(r.key, {
      x: anchor.x,
      y: anchor.y,
      title: r.label,
      rows: [
        { label: metric, value: formatValue(r.value, type), color: r.color ?? "#4F46E5" },
        ...(r.details ?? []).map((d) => ({ label: d.label, value: formatValue(d.value, d.type ?? "int") })),
      ],
    });

  return (
    <div ref={hostRef}>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              aria-label={`${r.label}: ${formatValue(r.value, type)} ${metric.toLowerCase()}`}
              className={cn(
                "block w-full cursor-default rounded-lg px-1.5 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/60",
                active === r.key ? "bg-subtle" : "bg-transparent"
              )}
              onPointerEnter={(e) => show(r, anchorFor(e, e.currentTarget))}
              onPointerMove={(e) => e.pointerType === "mouse" && show(r, { x: e.clientX, y: e.clientY })}
              onPointerDown={(e) => show(r, anchorFor(e, e.currentTarget))}
              onPointerLeave={(e) => e.pointerType === "mouse" && clear()}
              onFocus={(e) => show(r, anchorFor(e, e.currentTarget))}
              onBlur={clear}
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-heading">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {formatValue(r.value, type)}
                  {r.sub ? <span className="ml-1.5 text-xs">{r.sub}</span> : null}
                </span>
              </span>
              <span className="mt-1 block h-2 rounded-full bg-subtle">
                <span
                  className="block h-full rounded-full transition-opacity"
                  style={{
                    width: `${(r.value / max) * 100}%`,
                    background: r.color ?? "#4F46E5",
                    opacity: active === null || active === r.key ? 1 : 0.6,
                  }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ChartTooltip tip={tip} />
    </div>
  );
}

export function FunnelChart({ stages }: { stages: { key: string; label: string; unit: string; count: number }[] }) {
  const { tip, active, show: showTip, clear, hostRef } = useChartTooltip<string>();
  const max = Math.max(1, ...stages.map((s) => s.count));

  const show = (s: (typeof stages)[number], i: number, anchor: { x: number; y: number }) =>
    showTip(s.key, { x: anchor.x, y: anchor.y, title: `${i + 1}. ${s.label}`, rows: [{ label: s.unit, value: formatValue(s.count, "int"), color: "#6366F1" }] });

  return (
    <div ref={hostRef}>
      <ol className="space-y-1">
        {stages.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              aria-label={`${s.label}: ${formatValue(s.count, "int")} ${s.unit}`}
              className={cn(
                "block w-full cursor-default rounded-lg px-1.5 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/60",
                active === s.key ? "bg-subtle" : "bg-transparent"
              )}
              onPointerEnter={(e) => show(s, i, anchorFor(e, e.currentTarget))}
              onPointerMove={(e) => e.pointerType === "mouse" && show(s, i, { x: e.clientX, y: e.clientY })}
              onPointerDown={(e) => show(s, i, anchorFor(e, e.currentTarget))}
              onPointerLeave={(e) => e.pointerType === "mouse" && clear()}
              onFocus={(e) => show(s, i, anchorFor(e, e.currentTarget))}
              onBlur={clear}
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-heading">
                  <span className="mr-1.5 text-muted">{i + 1}.</span>
                  {s.label}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-heading">{formatValue(s.count, "int")}</span>
              </span>
              <span className="mt-1 block h-2.5 rounded-full bg-subtle">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500"
                  style={{ width: `${s.count ? Math.max((s.count / max) * 100, 1.5) : 0}%` }}
                />
              </span>
              <span className="mt-0.5 block text-[11px] text-muted">{s.unit}</span>
            </button>
          </li>
        ))}
      </ol>
      <ChartTooltip tip={tip} />
    </div>
  );
}
