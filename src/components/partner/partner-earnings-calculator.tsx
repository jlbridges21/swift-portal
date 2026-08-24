"use client";

import { useId, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type PlanOpt = {
  key: string;
  name: string;
  price_monthly_cents: number | null;
  price_annual_cents: number | null;
};

type TimePoint = {
  /** 1-based month index along the simulation (1..N). */
  month: number;
  /** Label for the x-axis / tooltip. */
  label: string;
  activeReferrals: number;
  monthlyCommissionCents: number;
  cumulativeEarnedCents: number;
};

/** Months view: 24 months. Years view: 5 years (end of each year). */
const MONTHS_HORIZON = 24;
const YEARS_HORIZON = 5;

/**
 * Interactive estimate only — never confused with the ledger.
 * Uses the partner's (or program default) rate and live plan catalog prices.
 *
 * Chart model: referrals added per month compound — earlier cohorts keep paying
 * while new ones join. Assumes zero churn (stated under the chart).
 */
export function PartnerEarningsCalculator({
  commissionRatePct,
  plans,
}: {
  commissionRatePct: number;
  plans: PlanOpt[];
}) {
  const chartId = useId();
  const defaultPlan = plans.find((p) => p.key === "studio") ?? plans[0];
  const [planKey, setPlanKey] = useState(defaultPlan?.key ?? "");
  /** Plan billing interval — which catalog price to use (annual stored as monthly equiv.). */
  const [planBilling, setPlanBilling] = useState<"monthly" | "annual">("monthly");
  /** Chart time axis — months (1–24) or years (1–5). */
  const [timeAxis, setTimeAxis] = useState<"months" | "years">("months");
  const [referralsPerMonth, setReferralsPerMonth] = useState(5);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const plan = plans.find((p) => p.key === planKey) ?? defaultPlan;

  /** Monthly-equivalent plan price in cents (annual catalog is already monthly equiv.). */
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

  const series = useMemo((): TimePoint[] => {
    const R = Math.max(0, referralsPerMonth);
    const points: TimePoint[] = [];

    if (timeAxis === "months") {
      let cumulative = 0;
      for (let m = 1; m <= MONTHS_HORIZON; m++) {
        const active = R * m;
        const monthly = active * perReferralCommission;
        cumulative += monthly;
        points.push({
          month: m,
          label: `Month ${m}`,
          activeReferrals: active,
          monthlyCommissionCents: monthly,
          cumulativeEarnedCents: cumulative,
        });
      }
    } else {
      for (let y = 1; y <= YEARS_HORIZON; y++) {
        const m = y * 12;
        const active = R * m;
        const monthly = active * perReferralCommission;
        // Sum of monthly commissions from month 1..m: R*p * m*(m+1)/2
        const cumulative = (R * perReferralCommission * m * (m + 1)) / 2;
        points.push({
          month: m,
          label: `Year ${y}`,
          activeReferrals: active,
          monthlyCommissionCents: monthly,
          cumulativeEarnedCents: cumulative,
        });
      }
    }
    return points;
  }, [referralsPerMonth, perReferralCommission, timeAxis]);

  const month12 = useMemo(() => {
    const R = Math.max(0, referralsPerMonth);
    const m = 12;
    const active = R * m;
    const monthly = active * perReferralCommission;
    const cumulative = (R * perReferralCommission * m * (m + 1)) / 2;
    return { active, monthly, cumulative };
  }, [referralsPerMonth, perReferralCommission]);

  const xLabelIndexes = useMemo(() => {
    if (timeAxis === "years") {
      // years series length known at runtime from series — use horizon count
      return Array.from({ length: YEARS_HORIZON }, (_, i) => i);
    }
    const want = [0, 5, 11, 17, 23].filter((i) => i < MONTHS_HORIZON);
    return want;
  }, [timeAxis]);

  if (!plans.length || !plan) {
    return <p className="text-sm text-muted">No public plans available for estimates.</p>;
  }

  const maxMonthly = Math.max(1, ...series.map((p) => p.monthlyCommissionCents));
  const selected = activeIndex != null ? series[activeIndex] : null;

  // Chart geometry (viewBox units)
  const W = 640;
  const H = 220;
  const padL = 52;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xAt = (i: number) =>
    padL + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const yAt = (cents: number) => padT + plotH - (cents / maxMonthly) * plotH;

  const linePoints = series.map((p, i) => `${xAt(i)},${yAt(p.monthlyCommissionCents)}`).join(" ");
  const areaPath =
    series.length === 0
      ? ""
      : `M ${xAt(0)} ${padT + plotH} L ${series
          .map((p, i) => `${xAt(i)} ${yAt(p.monthlyCommissionCents)}`)
          .join(" L ")} L ${xAt(series.length - 1)} ${padT + plotH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxMonthly * t));

  function activate(i: number) {
    setActiveIndex(i);
  }

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Estimate only — not ledger data. Uses commission rate{" "}
        <strong>{commissionRatePct}%</strong> and live plan prices from ShootPortal. This chart is
        a what-if model, separate from your real commission history.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
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
        <div className="space-y-1.5">
          <Label htmlFor={`${chartId}-refs`}>Referrals added per month</Label>
          <Input
            id={`${chartId}-refs`}
            type="number"
            min={0}
            max={100}
            className="min-h-11"
            value={referralsPerMonth}
            onChange={(e) =>
              setReferralsPerMonth(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${chartId}-axis`}>Chart time axis</Label>
          <select
            id={`${chartId}-axis`}
            className="flex h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"
            value={timeAxis}
            onChange={(e) => {
              setTimeAxis(e.target.value as "months" | "years");
              setActiveIndex(null);
            }}
          >
            <option value="months">Months (1–{MONTHS_HORIZON})</option>
            <option value="years">Years (1–{YEARS_HORIZON})</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-muted">
        Plan billing chooses which catalog price feeds the math (annual is stored as a monthly
        equivalent). Chart time axis chooses how the compounding curve is plotted — those are
        independent controls.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
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
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted">Month 12 recurring</p>
          <p className="mt-1 text-xl font-semibold text-heading">
            {formatCurrency(month12.monthly)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {month12.active} active · {formatCurrency(month12.cumulative)} earned to date
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-heading">
          Monthly recurring commission over time (estimate)
        </p>
        <p className="mb-3 text-sm text-muted">
          If you add {referralsPerMonth} referral{referralsPerMonth === 1 ? "" : "s"} every month,
          earlier ones keep paying while new ones join — so recurring income compounds.
        </p>

        <div className="relative rounded-xl border border-border bg-white p-2 sm:p-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-labelledby={`${chartId}-title`}
          >
            <title id={`${chartId}-title`}>
              Estimated monthly recurring commission over{" "}
              {timeAxis === "months" ? `${MONTHS_HORIZON} months` : `${YEARS_HORIZON} years`} at{" "}
              {referralsPerMonth} referrals added per month
            </title>

            {/* Gridlines */}
            {yTicks.map((tick) => {
              const y = yAt(tick);
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    x2={W - padR}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth={1}
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted text-[10px]"
                  >
                    {formatCurrency(tick)}
                  </text>
                </g>
              );
            })}

            {/* Area + line */}
            {areaPath ? (
              <path d={areaPath} className="fill-accent/15" />
            ) : null}
            {linePoints ? (
              <polyline
                points={linePoints}
                fill="none"
                className="stroke-accent"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {/* Points + hit targets */}
            {series.map((p, i) => {
              const cx = xAt(i);
              const cy = yAt(p.monthlyCommissionCents);
              const hitW = plotW / Math.max(series.length, 1);
              return (
                <g key={p.month}>
                  <rect
                    x={cx - hitW / 2}
                    y={padT}
                    width={hitW}
                    height={plotH}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => activate(i)}
                    onFocus={() => activate(i)}
                    onClick={() => activate(i)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      activate(i);
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${p.label}: ${p.activeReferrals} active referrals, ${formatCurrency(p.monthlyCommissionCents)} monthly, ${formatCurrency(p.cumulativeEarnedCents)} cumulative`}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={activeIndex === i ? 5 : 3}
                    className={activeIndex === i ? "fill-accent" : "fill-accent/80"}
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {/* X labels */}
            {xLabelIndexes.map((i) => {
              const p = series[i];
              if (!p) return null;
              return (
                <text
                  key={`x-${i}`}
                  x={xAt(i)}
                  y={H - 10}
                  textAnchor="middle"
                  className="fill-muted text-[10px]"
                >
                  {timeAxis === "months" ? `M${p.month}` : p.label.replace("Year ", "Y")}
                </text>
              );
            })}
          </svg>

          {selected ? (
            <div
              className="mt-2 rounded-lg border border-border bg-subtle/60 px-3 py-2 text-sm text-heading"
              role="status"
            >
              <p className="font-semibold">{selected.label}</p>
              <ul className="mt-1 space-y-0.5 text-muted">
                <li>
                  Active referrals:{" "}
                  <span className="font-medium text-heading">{selected.activeReferrals}</span>
                </li>
                <li>
                  Monthly recurring:{" "}
                  <span className="font-medium text-heading">
                    {formatCurrency(selected.monthlyCommissionCents)}
                  </span>
                </li>
                <li>
                  Cumulative earned:{" "}
                  <span className="font-medium text-heading">
                    {formatCurrency(selected.cumulativeEarnedCents)}
                  </span>
                </li>
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Hover or tap a point on the curve for month (or year), active referrals, monthly
              commission, and cumulative earned.
            </p>
          )}
        </div>

        <p className="mt-3 text-xs text-muted">
          Assumptions: every referred business stays subscribed (0% churn) and pays the selected
          plan price each month. Real retention is lower — treat this as an upper-bound illustration,
          not a forecast.
        </p>

        {/* Accessible data table */}
        <table className="sr-only">
          <caption>
            Estimated recurring commission by{" "}
            {timeAxis === "months" ? "month" : "year"} at {referralsPerMonth} referrals added per
            month
          </caption>
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
