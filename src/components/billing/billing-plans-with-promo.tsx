"use client";

import { useCallback, useMemo, useState } from "react";
import { BillingPromoCodeField, type BillingPromoState } from "@/components/billing/billing-promo-code-field";
import { SubscribeButton } from "@/components/billing/billing-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/trial-conversion";
import { introOfferSavingsLabel, type IntervalKey, type IntervalQuote, type OfferDisplay, type OfferKind } from "@/lib/intro-offer";
import { cn } from "@/lib/utils";

/** Legacy display shape (partner promo preview). */
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
  /** What checkout will charge for this plan (intro, referral, or regular — one offer only). */
  quotes: OfferDisplay["quotes"];
};

type Props = {
  plans: PlanCard[];
  /** Which offer the quotes reflect. */
  offerKind: OfferKind;
  /** A free trial is running now — subscribing ends it and bills today. */
  trialing?: boolean;
  /** Remembered Subscribe Now choice (?plan= or signup). */
  preferredInterval?: "monthly" | "annual" | null;
  /** Attribution only. */
  context?: string;
  /** Rendered right under the plan cards (e.g. the free-trial alternative). */
  afterPlans?: React.ReactNode;
};

function addPeriod(interval: IntervalKey, from = new Date()): string {
  const d = new Date(from);
  if (interval === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function nextPaymentCents(q: IntervalQuote): number {
  // Monthly intro: months 2..N are still discounted.
  return q.interval === "monthly" && q.introInvoices >= 2 ? q.introChargeCents : q.regularCents;
}

function IntervalCard({
  plan,
  interval,
  quote,
  highlighted,
  badge,
  promoCode,
  expectedOffer,
  context,
}: {
  plan: PlanCard;
  interval: IntervalKey;
  quote: IntervalQuote;
  highlighted: boolean;
  badge: string | null;
  promoCode: string | null;
  expectedOffer: OfferKind;
  context: string;
}) {
  const discounted = quote.savingsCents > 0;
  const productName = plan.name === "Studio" ? "ShootPortal" : plan.name;
  const label = interval === "annual" ? "Annual" : "Monthly";
  return (
    <Card className={cn("relative flex flex-col", highlighted && "border-accent ring-2 ring-accent/15")}>
      {badge ? (
        <Badge variant="success" className="absolute -top-2.5 right-4">
          {badge}
        </Badge>
      ) : null}
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-sm font-semibold text-heading">{label}</p>
          <p className="mt-1 text-3xl font-bold text-heading">
            {discounted ? (
              <span className="mr-2 text-base font-normal text-muted line-through">{formatUsd(quote.regularCents)}</span>
            ) : null}
            {formatUsd(quote.firstChargeCents)}
            <span className="text-sm font-normal text-muted">
              {interval === "monthly" ? "/month" : discounted ? " first year" : "/year"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {discounted
              ? quote.summary
              : interval === "monthly"
                ? "Billed monthly"
                : `Billed once a year · ${formatUsd(Math.round(quote.regularCents / 12))}/month equivalent`}
          </p>
          {discounted ? (
            <p className="mt-1 text-sm font-medium text-emerald-700">You save {formatUsd(quote.savingsCents)}</p>
          ) : null}
          <dl className="mt-3 space-y-1 rounded-lg bg-background px-3 py-2 text-xs text-muted">
            <div className="flex justify-between gap-2">
              <dt>Due today</dt>
              <dd className="font-semibold text-heading">{formatUsd(quote.firstChargeCents)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Next payment</dt>
              <dd>
                {formatUsd(nextPaymentCents(quote))} on {addPeriod(interval)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">Full access to {productName} · cancel anytime</p>
        </div>
        <div className="mt-auto">
          <SubscribeButton
            planKey={plan.key}
            interval={interval}
            label={`Subscribe ${label === "Annual" ? "Annually" : "Monthly"} · ${formatUsd(quote.firstChargeCents)} today`}
            promoCode={promoCode}
            expectedOffer={expectedOffer}
            context={context}
            variant={highlighted ? "accent" : "outline"}
            className="w-full min-h-11"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function BillingPlansWithPromo({
  plans,
  offerKind,
  trialing = false,
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
    quotes: null,
  });

  const onPromoChange = useCallback((next: BillingPromoState) => {
    setPromo(next);
  }, []);

  const primaryPlan = plans[0];
  // A partner code replaces Subscribe & Save — never both.
  const effectiveKind: OfferKind = promo.promoCode && promo.quotes ? "referral" : offerKind;
  const save = introOfferSavingsLabel();

  const cards = useMemo(
    () =>
      plans.map((plan) => ({
        plan,
        quotes: plan === primaryPlan && promo.promoCode && promo.quotes ? promo.quotes : plan.quotes,
      })),
    [plans, primaryPlan, promo.promoCode, promo.quotes]
  );

  return (
    <>
      {cards.map(({ plan, quotes }) => {
        if (!plan.stripe_price_monthly_id || !quotes.monthly) {
          return (
            <p key={plan.id} className="mb-8 text-sm text-muted">
              Billing isn&apos;t set up for this studio yet. Contact ShootPortal support.
            </p>
          );
        }
        const hasAnnual = Boolean(plan.stripe_price_annual_id) && Boolean(quotes.annual);
        const badgeFor = (q: IntervalQuote | undefined, fallback: string | null) =>
          q && q.savingsCents > 0
            ? effectiveKind === "intro"
              ? `Save ${save}`
              : `Partner discount`
            : fallback;
        return (
          <div key={plan.id} className={cn("mb-4 grid gap-4", hasAnnual && "sm:grid-cols-2")}>
            <IntervalCard
              plan={plan}
              interval="monthly"
              quote={quotes.monthly}
              highlighted={preferredInterval === "monthly"}
              badge={badgeFor(quotes.monthly, null)}
              promoCode={promo.promoCode}
              expectedOffer={effectiveKind}
              context={context}
            />
            {hasAnnual && quotes.annual ? (
              <IntervalCard
                plan={plan}
                interval="annual"
                quote={quotes.annual}
                highlighted={preferredInterval !== "monthly"}
                badge={badgeFor(quotes.annual, "Best Value")}
                promoCode={promo.promoCode}
                expectedOffer={effectiveKind}
                context={context}
              />
            ) : null}
          </div>
        );
      })}

      <p className="mb-6 text-center text-sm text-muted">
        {trialing
          ? "Subscribing ends your free trial and starts your paid plan today. You'll confirm the amount on Stripe's secure checkout before you're charged."
          : "You'll be charged today through Stripe's secure checkout. Cancel anytime from Manage billing."}
        {promo.promoCode ? ` Promo ${promo.promoCode} applied${effectiveKind === "referral" && offerKind === "intro" ? ` — partner pricing replaces the ${save} Subscribe & Save offer` : ""}.` : ""}
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
