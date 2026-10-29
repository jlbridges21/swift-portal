"use client";

import { useCallback, useState } from "react";
import { BillingPromoCodeField, type BillingPromoState } from "@/components/billing/billing-promo-code-field";
import { SubscribeButton } from "@/components/billing/billing-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPlanPrice } from "@/lib/plan-catalog";
import { formatUsd } from "@/lib/trial-conversion";
import { cn } from "@/lib/utils";

export type PlanPriceDisplay = {
  listPriceCents: number;
  discountedPriceCents: number;
  headline: string;
};

type PlanCard = {
  id: string;
  key: string;
  name: string;
  price_monthly_cents: number | null;
  /** Per-month equivalent of the annual plan (plans.price_annual_cents); charged ×12 yearly. */
  price_annual_cents: number | null;
  stripe_price_monthly_id: string | null;
  stripe_price_annual_id: string | null;
  description?: string | null;
  trial_days?: number;
  cookieMonthlyDisplay: PlanPriceDisplay | null;
  cookieAnnualDisplay: PlanPriceDisplay | null;
};

type Props = {
  plans: PlanCard[];
  /**
   * pay_now: charged at checkout (Subscribe Now accounts, expired trials).
   * schedule: trial users — card now, first charge on the stored trial end date.
   */
  mode: "pay_now" | "schedule";
  /** e.g. "November 15" — the stored trial end, shown for schedule mode. */
  firstChargeDateLabel?: string | null;
  /** Remembered Subscribe Now choice (?plan= or signup). */
  preferredInterval?: "monthly" | "annual" | null;
  /** Attribution only. */
  context?: string;
  /** Rendered right under the plan cards (e.g. the free-trial alternative). */
  afterPlans?: React.ReactNode;
};

export function BillingPlansWithPromo({
  plans,
  mode,
  firstChargeDateLabel,
  preferredInterval,
  context = "billing",
  afterPlans,
}: Props) {
  const [promo, setPromo] = useState<BillingPromoState>({
    promoCode: null,
    appliedLabel: null,
    error: null,
    monthlyOverride: null,
    annualOverride: null,
  });

  const onPromoChange = useCallback((next: BillingPromoState) => {
    setPromo(next);
  }, []);

  const primaryPlan = plans[0];
  const scheduling = mode === "schedule";

  return (
    <>
      {plans.map((plan) => {
        const canSubscribe = Boolean(plan.stripe_price_monthly_id);
        const monthlyDisplay = promo.monthlyOverride ?? plan.cookieMonthlyDisplay;
        const annualDisplay = promo.annualOverride ?? plan.cookieAnnualDisplay;
        const annualTotal = plan.price_annual_cents != null ? plan.price_annual_cents * 12 : null;
        const hasAnnual = Boolean(plan.stripe_price_annual_id) && annualTotal != null;

        if (!canSubscribe) {
          return (
            <p key={plan.id} className="mb-8 text-sm text-muted">
              Billing isn&apos;t set up for this studio yet. Contact ShootPortal support.
            </p>
          );
        }

        return (
          <div key={plan.id} className={cn("mb-4 grid gap-4", hasAnnual && "sm:grid-cols-2")}>
            <Card className={cn("flex flex-col", preferredInterval === "monthly" && "border-accent ring-2 ring-accent/15")}>
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <p className="text-sm font-semibold text-heading">Monthly</p>
                  {monthlyDisplay ? (
                    <p className="mt-1 text-3xl font-bold text-heading">
                      <span className="mr-2 text-base font-normal text-muted line-through">
                        {formatPlanPrice(monthlyDisplay.listPriceCents)}
                      </span>
                      {formatPlanPrice(monthlyDisplay.discountedPriceCents)}
                      <span className="text-sm font-normal text-muted">/month</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-3xl font-bold text-heading">
                      {formatUsd(plan.price_monthly_cents)}
                      <span className="text-sm font-normal text-muted">/month</span>
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted">Billed monthly · Full access to {plan.name === "Studio" ? "ShootPortal" : plan.name}</p>
                  {monthlyDisplay ? <p className="mt-1 text-xs text-muted">{monthlyDisplay.headline}</p> : null}
                </div>
                <div className="mt-auto">
                  <SubscribeButton
                    planKey={plan.key}
                    interval="monthly"
                    label={scheduling ? "Choose Monthly" : "Subscribe Monthly"}
                    promoCode={promo.promoCode}
                    context={context}
                    variant={preferredInterval === "monthly" ? "accent" : "outline"}
                    className="w-full min-h-11"
                  />
                </div>
              </CardContent>
            </Card>

            {hasAnnual ? (
              <Card
                className={cn(
                  "relative flex flex-col",
                  preferredInterval !== "monthly" && "border-accent ring-2 ring-accent/15"
                )}
              >
                <Badge variant="success" className="absolute -top-2.5 right-4">
                  Best Value
                </Badge>
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <p className="text-sm font-semibold text-heading">Annual</p>
                    <p className="mt-1 text-3xl font-bold text-heading">
                      {formatUsd(annualTotal)}
                      <span className="text-sm font-normal text-muted">/year</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {annualDisplay ? (
                        <>
                          <span className="line-through">{formatPlanPrice(annualDisplay.listPriceCents)}/mo</span>{" "}
                          {annualDisplay.headline}
                        </>
                      ) : (
                        <>Equivalent to {formatUsd(plan.price_annual_cents)}/month · billed once a year</>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted">Full access to {plan.name === "Studio" ? "ShootPortal" : plan.name}</p>
                  </div>
                  <div className="mt-auto">
                    <SubscribeButton
                      planKey={plan.key}
                      interval="annual"
                      label={scheduling ? "Choose Annual" : "Subscribe Annually"}
                      promoCode={promo.promoCode}
                      context={context}
                      variant={preferredInterval === "monthly" ? "outline" : "accent"}
                      className="w-full min-h-11"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        );
      })}

      <p className="mb-6 text-center text-sm text-muted">
        {scheduling
          ? firstChargeDateLabel
            ? `You won't be charged until your free trial ends on ${firstChargeDateLabel}. Your trial continues as usual until then.`
            : "You won't be charged until your free trial ends."
          : "You'll be charged today through Stripe's secure checkout. Cancel anytime from Manage billing."}
        {promo.promoCode ? ` Promo ${promo.promoCode} applied.` : ""}
      </p>

      {afterPlans}

      {primaryPlan && (
        <div className="mb-8">
          <BillingPromoCodeField
            planKey={primaryPlan.key}
            listMonthlyCents={primaryPlan.price_monthly_cents}
            listAnnualCents={primaryPlan.price_annual_cents}
            onChange={onPromoChange}
          />
        </div>
      )}
    </>
  );
}
