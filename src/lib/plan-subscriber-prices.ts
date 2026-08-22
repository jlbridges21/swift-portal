/**
 * Compare active Stripe subscription Prices to the current catalog map
 * so platform operators can see listed vs billed price gaps.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { subscriptionIdForMode, type BillingBusinessRow } from "@/lib/stripe-billing";

export type PlanSubscriberPriceBreakdown = {
  planKey: string;
  mode: "test" | "live";
  currentMonthlyPriceId: string | null;
  currentAnnualPriceId: string | null;
  /** Active/past_due/unpaid subs whose Stripe Price matches current monthly map. */
  onCurrentMonthly: number;
  /** Same for annual. */
  onCurrentAnnual: number;
  /** Subs on a different Price than current catalog for this plan. */
  onLegacyPrice: number;
  /** Subs we could not resolve (missing id, Stripe error, etc.). */
  unresolved: number;
  /** Paying/subscribed businesses counted. */
  totalWithSubscription: number;
};

function detectMode(): "test" | "live" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live_") ? "live" : "test";
}

export async function getPlanSubscriberPriceBreakdown(
  planKey: string
): Promise<PlanSubscriberPriceBreakdown> {
  const mode = detectMode();
  const raw = await createServiceClient();

  const { data: plan } = await raw
    .from("plans")
    .select("id, key")
    .eq("key", planKey)
    .maybeSingle();

  let currentMonthlyPriceId: string | null = null;
  let currentAnnualPriceId: string | null = null;

  if (plan) {
    const { data: priceRows } = await raw
      .from("plan_stripe_prices")
      .select("billing_interval, stripe_price_id")
      .eq("plan_id", plan.id)
      .eq("mode", mode);
    for (const row of priceRows ?? []) {
      if (row.billing_interval === "monthly") currentMonthlyPriceId = row.stripe_price_id;
      if (row.billing_interval === "annual") currentAnnualPriceId = row.stripe_price_id;
    }
  }

  const { data: businesses } = await raw
    .from("businesses")
    .select(
      "id, plan, subscription_status, stripe_subscription_id, stripe_subscription_id_test, stripe_subscription_id_live, stripe_customer_id, stripe_customer_id_test, stripe_customer_id_live"
    )
    .eq("plan", planKey)
    .is("deleted_at", null)
    .in("subscription_status", ["active", "past_due", "unpaid"]);

  const result: PlanSubscriberPriceBreakdown = {
    planKey,
    mode,
    currentMonthlyPriceId,
    currentAnnualPriceId,
    onCurrentMonthly: 0,
    onCurrentAnnual: 0,
    onLegacyPrice: 0,
    unresolved: 0,
    totalWithSubscription: 0,
  };

  if (!businesses?.length) return result;

  const { stripe } = getStripe();
  const currentIds = new Set(
    [currentMonthlyPriceId, currentAnnualPriceId].filter(Boolean) as string[]
  );

  for (const biz of businesses) {
    const subId = subscriptionIdForMode(biz as BillingBusinessRow, mode);
    if (!subId) {
      result.unresolved += 1;
      continue;
    }
    result.totalWithSubscription += 1;
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const priceId = sub.items.data[0]?.price?.id ?? null;
      const interval = sub.items.data[0]?.price?.recurring?.interval ?? null;
      if (!priceId) {
        result.unresolved += 1;
        continue;
      }
      if (currentIds.has(priceId)) {
        if (interval === "year" || priceId === currentAnnualPriceId) result.onCurrentAnnual += 1;
        else result.onCurrentMonthly += 1;
      } else {
        result.onLegacyPrice += 1;
      }
    } catch {
      result.unresolved += 1;
    }
  }

  return result;
}
