"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MARKETING_BRAND } from "@/lib/marketing";

type PlanOpt = {
  key: string;
  name: string;
  price_monthly_cents: number | null;
  price_annual_cents: number | null;
};

export type TimePoint = {
  month: number;
  label: string;
  activeReferrals: number;
  monthlyCommissionCents: number;
  cumulativeEarnedCents: number;
};

const HORIZON_OPTIONS = [
  { id: "1y", label: "1Y", months: 12 },
  { id: "3y", label: "3Y", months: 36 },
  { id: "5y", label: "5Y", months: 60 },
  { id: "10y", label: "10Y", months: 120 },
  { id: "20y", label: "20Y", months: 240 },
] as const;

const DEFAULT_HORIZON = "5y";
const DEFAULT_CHURN_PCT = 4;
const PORTAL_INDIGO = MARKETING_BRAND.indigo;

/** Simulate month-by-month with optional churn (monthly rate 0–1). */
export function simulateCommissionSeries(args: {
  referralsPerMonth: number;
  perReferralCommissionCents: number;
  horizonMonths: number;
  churnPct: number;
  timeAxis: "months" | "years";
}): TimePoint[] {
  const R = Math.max(0, args.referralsPerMonth);
  const churn = Math.max(0, Math.min(100, args.churnPct)) / 100;
  const horizon = Math.max(1, args.horizonMonths);
  const p = args.perReferralCommissionCents;

  const monthlyRows: TimePoint[] = [];
  let active = 0;
  let cumulative = 0;

  for (let m = 1; m <= horizon; m++) {
    active = active * (1 - churn) + R;
    const monthly = Math.round(active * p);
    cumulative += monthly;
    monthlyRows.push({
      month: m,
      label: `Month ${m}`,
      activeReferrals: Math.round(active * 10) / 10,
      monthlyCommissionCents: monthly,
      cumulativeEarnedCents: cumulative,
    });
  }

  if (args.timeAxis === "months") {
    // Subsample long horizons for a smooth line without 240 DOM scrub steps feeling chunky
    if (monthlyRows.length <= 48) return monthlyRows;
    const step = Math.ceil(monthlyRows.length / 48);
    return monthlyRows.filter((_, i) => i === monthlyRows.length - 1 || i % step === 0);
  }

  return monthlyRows
    .filter((row) => row.month % 12 === 0)
    .map((row) => ({
      ...row,
      label: `Year ${row.month / 12}`,
    }));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateAt(series: TimePoint[], t: number): TimePoint {
  if (!series.length) {
    return {
      month: 0,
      label: "—",
      activeReferrals: 0,
      monthlyCommissionCents: 0,
      cumulativeEarnedCents: 0,
    };
  }
  if (series.length === 1) return series[0]!;
  const f = clamp(t, 0, 1) * (series.length - 1);
  const i0 = Math.floor(f);
  const i1 = Math.min(series.length - 1, i0 + 1);
  const frac = f - i0;
  const a = series[i0]!;
  const b = series[i1]!;
  return {
    month: Math.round(lerp(a.month, b.month, frac)),
    label: frac < 0.5 ? a.label : b.label,
    activeReferrals: Math.round(lerp(a.activeReferrals, b.activeReferrals, frac)),
    monthlyCommissionCents: Math.round(
      lerp(a.monthlyCommissionCents, b.monthlyCommissionCents, frac)
    ),
    cumulativeEarnedCents: Math.round(
      lerp(a.cumulativeEarnedCents, b.cumulativeEarnedCents, frac)
    ),
  };
}

/**
 * Interactive scrub chart — estimate only, never ledger data.
 * Uses live plan prices and the passed commission rate (partner or program default).
 */
export function PartnerEarningsCalculator({
  commissionRatePct,
  plans,
}: {
  commissionRatePct: number;
  plans: PlanOpt[];
}) {
  const chartId = useId();
  const svgRef = useRef<SVGSVGElement>(null);

  const defaultPlan = plans.find((p) => p.key === "studio") ?? plans[0];
  const [planKey, setPlanKey] = useState(defaultPlan?.key ?? "");
  const [planBilling, setPlanBilling] = useState<"monthly" | "annual">("monthly");
  const [referralsPerMonth, setReferralsPerMonth] = useState(10);
  const [churnPct, setChurnPct] = useState(DEFAULT_CHURN_PCT);
  const [timeAxis, setTimeAxis] = useState<"months" | "years">("years");
  const [horizonId, setHorizonId] = useState<string>(DEFAULT_HORIZON);
  const [scrubT, setScrubT] = useState<number | null>(null);
  const [keyboardScrub, setKeyboardScrub] = useState(false);
  const [chartGen, setChartGen] = useState(0);

  const plan = plans.find((p) => p.key === planKey) ?? defaultPlan;
  const showPlanSelector = plans.length > 1;
  const horizonMonths =
    HORIZON_OPTIONS.find((h) => h.id === horizonId)?.months ?? 60;

  const priceCents = useMemo(() => {
    if (!plan) return 0;
    if (planBilling === "annual") {
      const annualMonthly = plan.price_annual_cents;
      if (annualMonthly != null && annualMonthly > 0) return annualMonthly;
      return plan.price_monthly_cents ?? 0;
    }
    return plan.price_monthly_cents ?? 0;
  }, [plan, planBilling]);

  const perReferralCommission = Math.round((priceCents * commissionRatePct) / 100);

  const series = useMemo(
    () =>
      simulateCommissionSeries({
        referralsPerMonth,
        perReferralCommissionCents: perReferralCommission,
        horizonMonths,
        churnPct,
        timeAxis,
      }),
    [referralsPerMonth, perReferralCommission, horizonMonths, churnPct, timeAxis]
  );

  useEffect(() => {
    setChartGen((g) => g + 1);
  }, [series]);

  const endPoint = series[series.length - 1];
  const displayPoint = useMemo(() => {
    if (scrubT != null) return interpolateAt(series, scrubT);
    return endPoint ?? interpolateAt(series, 1);
  }, [series, scrubT, endPoint]);

  const plateauReferrals =
    churnPct > 0 ? referralsPerMonth / (churnPct / 100) : null;

  const pointerToT = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || series.length < 2) return 0;
      const rect = svg.getBoundingClientRect();
      const W = 640;
      const padL = 8;
      const padR = 8;
      const plotW = W - padL - padR;
      const xSvg = ((clientX - rect.left) / rect.width) * W;
      return clamp((xSvg - padL) / plotW, 0, 1);
    },
    [series.length]
  );

  const xLabels = useMemo(() => {
    if (timeAxis === "years") {
      const count = series.length;
      const picks =
        count <= 6
          ? series.map((_, i) => i)
          : [0, Math.floor(count / 4), Math.floor(count / 2), Math.floor((3 * count) / 4), count - 1];
      return picks.map((i) => ({
        t: count <= 1 ? 0.5 : i / (count - 1),
        text: series[i]?.label.replace("Year ", "Y") ?? "",
      }));
    }
    const count = series.length;
    const picks =
      count <= 6
        ? series.map((_, i) => i)
        : [0, Math.floor(count / 4), Math.floor(count / 2), Math.floor((3 * count) / 4), count - 1];
    return picks.map((i) => ({
      t: count <= 1 ? 0.5 : i / (count - 1),
      text: `M${series[i]?.month ?? i + 1}`,
    }));
  }, [series, timeAxis]);

  const onChartPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setKeyboardScrub(false);
    setScrubT(pointerToT(e.clientX));
  };

  const onChartPointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    setKeyboardScrub(false);
    setScrubT(pointerToT(e.clientX));
  };

  const onChartPointerUp = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onChartPointerLeave = () => {
    if (!keyboardScrub) setScrubT(null);
  };

  const onChartKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (series.length < 2) return;
    const step = 1 / (series.length - 1);
    const current = scrubT ?? 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setKeyboardScrub(true);
      setScrubT(clamp(current - step, 0, 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setKeyboardScrub(true);
      setScrubT(clamp(current + step, 0, 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setKeyboardScrub(true);
      setScrubT(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setKeyboardScrub(true);
      setScrubT(1);
    } else if (e.key === "Escape") {
      setKeyboardScrub(false);
      setScrubT(null);
    }
  };

  if (!plans.length || !plan) {
    return <p className="text-sm text-muted">No public plans available for estimates.</p>;
  }

  const W = 640;
  const H = 260;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxMonthly = Math.max(1, ...series.map((p) => p.monthlyCommissionCents));
  const xAt = (t: number) => padL + t * plotW;
  const yAt = (cents: number) => padT + plotH - (cents / maxMonthly) * plotH;

  const linePath = series
    .map((p, i) => {
      const t = series.length <= 1 ? 0.5 : i / (series.length - 1);
      return `${i === 0 ? "M" : "L"} ${xAt(t)} ${yAt(p.monthlyCommissionCents)}`;
    })
    .join(" ");

  const areaPath =
    series.length === 0
      ? ""
      : `${linePath} L ${xAt(1)} ${padT + plotH} L ${xAt(0)} ${padT + plotH} Z`;

  const scrubFraction = scrubT ?? 1;
  const crossX = xAt(scrubFraction);
  const crossY = yAt(displayPoint.monthlyCommissionCents);
  const showCrosshair = scrubT != null && series.length > 1;

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Estimate only — not ledger data. Uses commission rate{" "}
        <strong>{commissionRatePct}%</strong> and live plan prices from ShootPortal. This is a
        what-if projection, not a forecast or guarantee.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {showPlanSelector ? (
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor={`${chartId}-plan`}>Plan</Label>
            <select
              id={`${chartId}-plan`}
              className="flex h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor={`${chartId}-billing`}>Plan billing (price source)</Label>
          <select
            id={`${chartId}-billing`}
            className="flex h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"
            value={planBilling}
            onChange={(e) => setPlanBilling(e.target.value as "monthly" | "annual")}
          >
            <option value="monthly">Monthly plan price</option>
            <option value="annual">Annual plan (monthly equivalent)</option>
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${chartId}-refs`}>Referrals added per month</Label>
          <div className="flex items-center gap-3">
            <input
              id={`${chartId}-refs-range`}
              type="range"
              min={1}
              max={100}
              step={1}
              value={referralsPerMonth}
              onChange={(e) => setReferralsPerMonth(Number(e.target.value))}
              className="min-h-11 flex-1 accent-[#4F46E5]"
              aria-valuemin={1}
              aria-valuemax={100}
              aria-valuenow={referralsPerMonth}
            />
            <Input
              id={`${chartId}-refs`}
              type="number"
              min={1}
              max={100}
              className="min-h-11 w-20 shrink-0 text-center"
              value={referralsPerMonth}
              onChange={(e) =>
                setReferralsPerMonth(clamp(Math.round(Number(e.target.value) || 1), 1, 100))
              }
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${chartId}-churn`}>Assumed monthly churn</Label>
          <div className="flex items-center gap-3">
            <input
              id={`${chartId}-churn-range`}
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={churnPct}
              onChange={(e) => setChurnPct(Number(e.target.value))}
              className="min-h-11 flex-1 accent-[#4F46E5]"
            />
            <Input
              id={`${chartId}-churn`}
              type="number"
              min={0}
              max={10}
              step={0.5}
              className="min-h-11 w-20 shrink-0 text-center"
              value={churnPct}
              onChange={(e) =>
                setChurnPct(clamp(Number(e.target.value) || 0, 0, 10))
              }
            />
            <span className="text-sm text-muted">%</span>
          </div>
          {plateauReferrals != null && churnPct > 0 ? (
            <p className="text-xs text-muted">
              Steady-state active base ≈ {Math.round(plateauReferrals)} referrals (add rate ÷
              churn).
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Horizon</span>
        {HORIZON_OPTIONS.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => {
              setHorizonId(h.id);
              setScrubT(null);
            }}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
              horizonId === h.id
                ? "bg-[#4F46E5] text-white"
                : "border border-border bg-white text-heading hover:bg-subtle/80"
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["months", "years"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setTimeAxis(mode);
              setScrubT(null);
            }}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
              timeAxis === mode
                ? "border-2 border-[#4F46E5] bg-white text-[#4F46E5]"
                : "border border-border bg-white text-muted hover:text-heading"
            }`}
          >
            {mode === "months" ? "Month axis" : "Year axis"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted">Plan price / mo (equiv.)</p>
          <p className="mt-1 text-xl font-semibold text-heading">{formatCurrency(priceCents)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted">Per referral / mo</p>
          <p className="mt-1 text-xl font-semibold text-heading">
            {formatCurrency(perReferralCommission)}
          </p>
        </div>
      </div>

      <div>
        <div
          className="mb-4 px-1"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Monthly recurring commission
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-heading sm:text-5xl">
            {formatCurrency(displayPoint.monthlyCommissionCents)}
          </p>
          <p className="mt-2 text-sm text-muted">
            {displayPoint.label}
            {" · "}
            {Math.round(displayPoint.activeReferrals)} active referrals
            {" · "}
            {formatCurrency(displayPoint.cumulativeEarnedCents)} earned to date
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white px-1 py-2 sm:px-2">
          <style>{`
            @keyframes calcChartFade {
              from { opacity: 0.35; }
              to { opacity: 1; }
            }
            .calc-chart-animate {
              animation: calcChartFade 0.45s ease-out;
            }
            @media (prefers-reduced-motion: reduce) {
              .calc-chart-animate { animation: none; }
            }
          `}</style>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
            role="img"
            tabIndex={0}
            aria-labelledby={`${chartId}-title`}
            onKeyDown={onChartKeyDown}
          >
            <title id={`${chartId}-title`}>
              Estimated monthly recurring commission projection
            </title>
            <defs>
              <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PORTAL_INDIGO} stopOpacity="0.28" />
                <stop offset="100%" stopColor={PORTAL_INDIGO} stopOpacity="0" />
              </linearGradient>
            </defs>

            <g key={chartGen} className="calc-chart-animate">
              {areaPath ? (
                <path d={areaPath} fill={`url(#${chartId}-fill)`} stroke="none" />
              ) : null}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke={PORTAL_INDIGO}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
            </g>

            {/* Crosshair */}
            {showCrosshair ? (
              <g pointerEvents="none">
                <line
                  x1={crossX}
                  x2={crossX}
                  y1={padT}
                  y2={padT + plotH}
                  stroke={PORTAL_INDIGO}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.55}
                />
                <circle
                  cx={crossX}
                  cy={crossY}
                  r={6}
                  fill={PORTAL_INDIGO}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </g>
            ) : null}

            {xLabels.map((l) => (
              <text
                key={l.text + l.t}
                x={xAt(l.t)}
                y={H - 8}
                textAnchor="middle"
                className="fill-[#64748B] text-[10px] sm:text-[11px]"
              >
                {l.text}
              </text>
            ))}

            {/* Scrub hit area */}
            <rect
              x={padL}
              y={padT}
              width={plotW}
              height={plotH}
              fill="transparent"
              className="cursor-crosshair"
              onPointerDown={onChartPointerDown}
              onPointerMove={onChartPointerMove}
              onPointerUp={onChartPointerUp}
              onPointerCancel={onChartPointerUp}
              onPointerLeave={onChartPointerLeave}
            />
          </svg>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Assumptions: {referralsPerMonth} new referral{referralsPerMonth === 1 ? "" : "s"} per
          month, {churnPct}% assumed monthly churn
          {churnPct === 0 ? " (theoretical ceiling — no attrition)" : ""}, and every active
          referral pays the selected plan price. Drag across the chart to scrub; use arrow keys when
          the chart is focused. Not a forecast.
        </p>

        <table className="sr-only">
          <caption>Estimated recurring commission projection</caption>
          <thead>
            <tr>
              <th>Period</th>
              <th>Active referrals</th>
              <th>Monthly commission</th>
              <th>Cumulative earned</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.month}>
                <td>{p.label}</td>
                <td>{p.activeReferrals}</td>
                <td>{formatCurrency(p.monthlyCommissionCents)}</td>
                <td>{formatCurrency(p.cumulativeEarnedCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
