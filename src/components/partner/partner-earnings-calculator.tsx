"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type PlanOpt = {
  key: string;
  name: string;
  price_monthly_cents: number | null;
  price_annual_cents: number | null;
};

/**
 * Interactive estimate only — never confused with the ledger.
 * Uses the partner's real rate and live plan catalog prices.
 */
export function PartnerEarningsCalculator({
  commissionRatePct,
  plans,
}: {
  commissionRatePct: number;
  plans: PlanOpt[];
}) {
  const defaultPlan = plans.find((p) => p.key === "studio") ?? plans[0];
  const [planKey, setPlanKey] = useState(defaultPlan?.key ?? "");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [referrals, setReferrals] = useState(5);

  const plan = plans.find((p) => p.key === planKey) ?? defaultPlan;

  const priceCents = useMemo(() => {
    if (!plan) return 0;
    if (interval === "yearly") {
      // Annual plans store monthly-equivalent cents in price_annual_cents when set.
      const annualMonthly = plan.price_annual_cents;
      if (annualMonthly != null && annualMonthly > 0) return annualMonthly;
      return plan.price_monthly_cents ?? 0;
    }
    return plan.price_monthly_cents ?? 0;
  }, [plan, interval]);

  const perReferralCommission = Math.round((priceCents * commissionRatePct) / 100);
  const totalMonthly = perReferralCommission * Math.max(0, referrals);

  const growth = useMemo(() => {
    const points: { n: number; cents: number }[] = [];
    const max = Math.max(10, referrals);
    for (let n = 0; n <= max; n++) {
      points.push({ n, cents: perReferralCommission * n });
    }
    return points;
  }, [perReferralCommission, referrals]);

  const maxCents = Math.max(1, ...growth.map((g) => g.cents));

  if (!plans.length || !plan) {
    return <p className="text-sm text-muted">No public plans available for estimates.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Estimate only — not ledger data. Uses your current rate ({commissionRatePct}%) and live
        plan prices from ShootPortal.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="calc-plan">Plan</Label>
          <select
            id="calc-plan"
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
          <Label htmlFor="calc-interval">Billing</Label>
          <select
            id="calc-interval"
            className="flex h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"
            value={interval}
            onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly (monthly equiv.)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-refs">Paying referrals</Label>
          <Input
            id="calc-refs"
            type="number"
            min={0}
            max={500}
            className="min-h-11"
            value={referrals}
            onChange={(e) => setReferrals(Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted">Plan price / mo</p>
          <p className="mt-1 text-xl font-semibold text-heading">{formatCurrency(priceCents)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted">Per referral / mo</p>
          <p className="mt-1 text-xl font-semibold text-heading">
            {formatCurrency(perReferralCommission)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted">Estimated recurring</p>
          <p className="mt-1 text-xl font-semibold text-heading">{formatCurrency(totalMonthly)}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-heading">
          Recurring earnings vs referral count (estimate)
        </p>
        <div className="flex h-36 items-end gap-1">
          {growth.map((g) => (
            <div key={g.n} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full max-w-[28px] rounded-t-sm bg-accent/80"
                style={{
                  height: `${Math.max(g.cents > 0 ? 4 : 0, Math.round((g.cents / maxCents) * 100))}%`,
                }}
                title={`${g.n} → ${formatCurrency(g.cents)}`}
              />
              {(g.n === 0 || g.n === referrals || g.n === growth[growth.length - 1]?.n) && (
                <span className="text-[10px] text-muted">{g.n}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
