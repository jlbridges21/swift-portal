import { EmptyChart, fmtInt } from "@/components/platform/analytics/ui";

/**
 * Dependency-free SVG/CSS charts for the analytics dashboard (the repo has no
 * chart library; see partner-program-charts.tsx for the same approach). Each data
 * point carries a <title> so values are readable on hover and by screen readers.
 */

function shortDay(day: string) {
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function TrendChart({
  points,
  series,
  height = 200,
  format = fmtInt,
}: {
  points: { day: string; [k: string]: number | string }[];
  series: { key: string; label: string; color: string }[];
  height?: number;
  format?: (n: number) => string;
}) {
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

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Trend of ${series.map((s) => s.label).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border" strokeDasharray="3 4" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="10" className="fill-current text-muted">
              {fmtInt(t)}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(Number(p[s.key] ?? 0)).toFixed(1)}`).join(" ");
          const area = `${d} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
          return (
            <g key={s.key}>
              {si === 0 ? <path d={area} fill={s.color} opacity="0.08" /> : null}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(Number(p[s.key] ?? 0))} r={points.length > 45 ? 1.5 : 3} fill={s.color}>
                  <title>{`${p.day} · ${s.label}: ${format(Number(p[s.key] ?? 0))}`}</title>
                </circle>
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
      </svg>
    </div>
  );
}

export function ColumnChart({
  points,
  valueKey,
  label,
  color = "#4F46E5",
  format = fmtInt,
}: {
  points: { day: string; [k: string]: number | string }[];
  valueKey: string;
  label: string;
  color?: string;
  format?: (n: number) => string;
}) {
  const vals = points.map((p) => Number(p[valueKey] ?? 0));
  const max = Math.max(1, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return <EmptyChart>No {label.toLowerCase()} in this range.</EmptyChart>;
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  return (
    <div>
      <div className="flex h-36 items-end gap-[2px]" role="img" aria-label={`${label} per day, total ${format(total)}`}>
        {points.map((p, i) => (
          <div key={p.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-sm transition-opacity group-hover:opacity-80"
              style={{ height: `${(vals[i]! / max) * 100}%`, minHeight: vals[i] ? 3 : 0, background: color }}
              title={`${p.day}: ${format(vals[i]!)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
        {points.map((p, i) => (
          <span key={p.day} className="flex-1 text-center">
            {i % labelEvery === 0 ? shortDay(p.day) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarList({
  rows,
  format = fmtInt,
  empty = "No data in this range yet.",
}: {
  rows: { key: string; label: string; value: number; color?: string; sub?: string }[];
  format?: (n: number) => string;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.some((r) => r.value > 0)) return <EmptyChart>{empty}</EmptyChart>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-heading">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {format(r.value)}
              {r.sub ? <span className="ml-1.5 text-xs">{r.sub}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-subtle">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? "#4F46E5" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FunnelChart({ stages }: { stages: { key: string; label: string; unit: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => (
        <li key={s.key} title={`${s.label}: ${fmtInt(s.count)} ${s.unit}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-heading">
              <span className="mr-1.5 text-muted">{i + 1}.</span>
              {s.label}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-heading">{fmtInt(s.count)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-subtle">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500"
              style={{ width: `${s.count ? Math.max((s.count / max) * 100, 1.5) : 0}%` }}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-muted">{s.unit}</p>
        </li>
      ))}
    </ol>
  );
}
