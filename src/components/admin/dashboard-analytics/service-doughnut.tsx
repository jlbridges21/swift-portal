"use client";

import Link from "next/link";
import { ChartTooltip, anchorFor, useChartTooltip, type TooltipRow } from "@/components/platform/analytics/chart-tooltip";
import { OTHER_SERVICE_KEY, type ServiceBreakdown } from "@/lib/dashboard-analytics";
import { cn } from "@/lib/utils";

/**
 * Projects by service. Slices are service associations (a multi-service project counts
 * once per service); the center shows unique projects. Hover, tap, or focus a slice or
 * legend row for the exact count and share.
 */

const SIZE = 200;
const R_OUT = 92;
const R_IN = 60;
const C = SIZE / 2;

function polar(r: number, angle: number): [number, number] {
  return [C + r * Math.sin(angle), C - r * Math.cos(angle)];
}

function arcPath(start: number, end: number): string {
  // A full ring is two half arcs (an SVG arc cannot start and end at the same point).
  if (end - start >= Math.PI * 2 - 1e-6) {
    return `${arcPath(0, Math.PI)} ${arcPath(Math.PI, Math.PI * 2)}`;
  }
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = polar(R_OUT, start);
  const [x2, y2] = polar(R_OUT, end);
  const [x3, y3] = polar(R_IN, end);
  const [x4, y4] = polar(R_IN, start);
  return `M${x1},${y1} A${R_OUT},${R_OUT} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${R_IN},${R_IN} 0 ${large} 0 ${x4},${y4} Z`;
}

function pct(share: number): string {
  const v = share * 100;
  return `${v >= 10 || v === 0 ? v.toFixed(0) : v.toFixed(1)}%`;
}

export function ServiceDoughnut({
  data,
  colors,
  otherColor,
}: {
  data: ServiceBreakdown;
  colors: string[];
  otherColor: string;
}) {
  const { tip, active, show: showTip, clear, hostRef } = useChartTooltip<string>();

  if (data.uniqueProjects === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-40 w-40" aria-hidden>
          <path d={arcPath(0, Math.PI * 2)} className="fill-slate-100" fillRule="evenodd" />
          <text x={C} y={C + 6} textAnchor="middle" fontSize="22" fontWeight="700" className="fill-current text-heading">
            0
          </text>
        </svg>
        <p className="text-sm text-muted">No projects were created in this range.</p>
        {data.configuredServices === 0 ? (
          <Link href="/admin/settings#settings-services" className="text-sm text-accent hover:underline">
            Set up your services
          </Link>
        ) : null}
      </div>
    );
  }

  let colorIdx = 0;
  const slices = data.slices.map((s) => ({
    ...s,
    color: s.key === OTHER_SERVICE_KEY ? otherColor : colors[colorIdx++ % Math.max(1, colors.length)] ?? otherColor,
  }));

  const gap = slices.length > 1 ? 0.012 : 0;
  let angle = 0;
  const arcs = slices.map((s) => {
    const sweep = s.share * Math.PI * 2;
    const a = { ...s, start: angle + gap / 2, end: angle + sweep - gap / 2 };
    angle += sweep;
    return a;
  });

  const show = (s: (typeof slices)[number], anchor: { x: number; y: number }) => {
    const rows: TooltipRow[] = [
      { label: "Projects", value: s.count.toLocaleString("en-US"), color: s.color },
      { label: "Share of services", value: pct(s.share), emphasis: false },
    ];
    for (const m of (s.members ?? []).slice(0, 6)) {
      rows.push({ label: m.label, value: m.count.toLocaleString("en-US"), emphasis: false });
    }
    if ((s.members?.length ?? 0) > 6) {
      rows.push({ label: `+${s.members!.length - 6} more`, value: "", emphasis: false });
    }
    showTip(s.key, { x: anchor.x, y: anchor.y, title: s.label, rows });
  };

  const handlers = (s: (typeof slices)[number]) => ({
    onPointerEnter: (e: React.PointerEvent<Element>) => show(s, anchorFor(e, e.currentTarget)),
    onPointerMove: (e: React.PointerEvent<Element>) => e.pointerType === "mouse" && show(s, { x: e.clientX, y: e.clientY }),
    onPointerDown: (e: React.PointerEvent<Element>) => show(s, anchorFor(e, e.currentTarget)),
    onPointerLeave: (e: React.PointerEvent<Element>) => e.pointerType === "mouse" && clear(),
  });

  return (
    <div ref={hostRef} className="flex flex-col items-center gap-5 sm:flex-row sm:items-start lg:flex-col lg:items-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-48 w-48 shrink-0 touch-pan-y select-none" role="img" aria-label={`${data.uniqueProjects} projects across ${data.associations} service associations`}>
        {arcs.map((a) => (
          <path
            key={a.key}
            d={arcPath(a.start, a.end)}
            fill={a.color}
            fillRule="evenodd"
            opacity={active === null || active === a.key ? 1 : 0.35}
            className="cursor-default transition-opacity"
            {...handlers(a)}
          />
        ))}
        <text x={C} y={C + 4} textAnchor="middle" fontSize="30" fontWeight="700" className="pointer-events-none fill-current text-heading">
          {data.uniqueProjects.toLocaleString("en-US")}
        </text>
        <text x={C} y={C + 24} textAnchor="middle" fontSize="12" className="pointer-events-none fill-current text-muted">
          {data.uniqueProjects === 1 ? "project" : "projects"}
        </text>
      </svg>

      <ul className="w-full min-w-0 space-y-0.5">
        {slices.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              className={cn(
                "flex w-full min-w-0 cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60",
                active === s.key ? "bg-subtle" : "bg-transparent"
              )}
              aria-label={`${s.label}: ${s.count} projects, ${pct(s.share)} of service associations`}
              {...handlers(s)}
              onFocus={(e) => show(s, anchorFor(e, e.currentTarget))}
              onBlur={clear}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-heading">{s.label}</span>
              <span className="shrink-0 tabular-nums text-muted">{s.count}</span>
              <span className="w-11 shrink-0 text-right tabular-nums font-medium text-heading">{pct(s.share)}</span>
            </button>
          </li>
        ))}
      </ul>
      <ChartTooltip tip={tip} />
    </div>
  );
}
