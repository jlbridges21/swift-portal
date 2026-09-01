"use client";

import { useCallback, useState } from "react";
import { BillingPromoCodeField, type BillingPromoState } from "@/components/billing/billing-promo-code-field";
import { SubscribeButton } from "@/components/billing/billing-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPlanPrice } from "@/lib/plan-catalog";

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
  currentPlanKey: string | null;
  requiresPayment: boolean;
  status: string;
  trialDaysLabel?: (days: number) => string;
};

export function BillingPlansWithPromo({
  plans,
  currentPlanKey,
  requiresPayment,
  status,
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

  return (
    <>
      {primaryPlan && (
        <BillingPromoCodeField
          planKey={primaryPlan.key}
          listMonthlyCents={primaryPlan.price_monthly_cents}
          listAnnualCents={primaryPlan.price_annual_cents}
          onChange={onPromoChange}
        />
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.key === currentPlanKey;
          const canSubscribe = Boolean(plan.stripe_price_monthly_id);
          const alreadyOnPaidPlan = isCurrent && status === "active" && !requiresPayment;

          const monthlyDisplay = promo.monthlyOverride ?? plan.cookieMonthlyDisplay;
          const annualDisplay = promo.annualOverride ?? plan.cookieAnnualDisplay;

          return (
            <Card key={plan.id} className={isCurrent ? "border-accent" : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{plan.name}</span>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {monthlyDisplay ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-semibold text-heading">
                      <span className="mr-2 text-base font-normal text-muted line-through">
                        {formatPlanPrice(monthlyDisplay.listPriceCents)}/mo
                      </span>
                      {formatPlanPrice(monthlyDisplay.discountedPriceCents)}
                      <span className="text-sm font-normal text-muted">/mo</span>
                    </p>
                    <p className="text-xs text-muted">{monthlyDisplay.headline}</p>
                    {promo.promoCode && (
                      <p className="text-xs font-medium text-accent">
                        Promo {promo.promoCode} applied
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-2xl font-semibold text-heading">
                    {formatPlanPrice(plan.price_monthly_cents)}
                    <span className="text-sm font-normal text-muted">/mo</span>
                  </p>
                )}
                {plan.price_annual_cents != null &&
                  (annualDisplay ? (
                    <p className="text-xs text-muted">
                      <span className="line-through">
                        {formatPlanPrice(annualDisplay.listPriceCents)}/mo billed annually
                      </span>
                      {" · "}
                      {annualDisplay.headline}
                    </p>
                  ) : (
                    <p className="text-xs text-muted">
                      or {formatPlanPrice(plan.price_annual_cents)}/mo billed annually
                    </p>
                  ))}
                {canSubscribe ? (
                  <div className="space-y-2">
                    <SubscribeButton
                      planKey={plan.key}
                      interval="monthly"
                      disabled={alreadyOnPaidPlan}
                      label={alreadyOnPaidPlan ? "Current plan" : "Subscribe monthly"}
                      promoCode={promo.promoCode}
                    />
                    {plan.stripe_price_annual_id ? (
                      <SubscribeButton
                        planKey={plan.key}
                        interval="annual"
                        disabled={alreadyOnPaidPlan}
                        label="Subscribe annually"
                        promoCode={promo.promoCode}
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Billing isn&apos;t set up for this studio yet. Contact ShootPortal support.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
