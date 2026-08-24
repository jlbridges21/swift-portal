/**
 * When a plan's catalog price changes in the DB, Stripe Price objects are
 * immutable — create a replacement Price and remap plan_stripe_prices for the
 * current Stripe mode. Existing subscribers keep their old Price until they
 * change plans or you migrate them in Stripe.
 */

import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

type StripeMode = "test" | "live";
type BillingInterval = "monthly" | "annual";

export type PlanStripeSyncResult = {
  remapped: boolean;
  ok: boolean;
  mode: StripeMode;
  message: string;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
};

export type PlanStripePriceMismatch = {
  planKey: string;
  planName: string;
  mode: StripeMode;
  billingInterval: BillingInterval;
  catalogCents: number;
  stripeUnitAmountCents: number | null;
  stripePriceId: string | null;
  reason: "amount_mismatch" | "missing_mapping" | "stripe_price_missing" | "stripe_inactive";
};

export type PlanStripeConsistencyReport = {
  modeChecked: StripeMode;
  checkedAt: string;
  mismatches: PlanStripePriceMismatch[];
  rowsChecked: number;
};

function detectMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_")) return "live";
  return "test";
}

async function ensureProduct(
  stripe: Stripe,
  plan: { id: string; key: string; name: string; description: string | null },
  existingProductId: string | null
): Promise<string> {
  if (existingProductId) {
    try {
      const product = await stripe.products.retrieve(existingProductId);
      if (product && !product.deleted) return product.id;
    } catch {
      /* create below */
    }
  }

  const listed = await stripe.products.list({ limit: 100, active: true });
  const hit = listed.data.find((p) => p.metadata?.shootportal_plan_key === plan.key);
  if (hit) return hit.id;

  const created = await stripe.products.create({
    name: plan.name,
    description: plan.description || undefined,
    metadata: {
      shootportal_plan_key: plan.key,
      shootportal_billing: "true",
    },
  });
  return created.id;
}

async function createOrReusePrice(
  stripe: Stripe,
  options: {
    productId: string;
    planKey: string;
    unitAmount: number;
    interval: "month" | "year";
    billingInterval: BillingInterval;
  }
): Promise<string> {
  const listed = await stripe.prices.list({
    product: options.productId,
    active: true,
    limit: 100,
  });
  const match = listed.data.find(
    (p) =>
      p.unit_amount === options.unitAmount &&
      p.recurring?.interval === options.interval &&
      p.currency === "usd" &&
      p.metadata?.shootportal_plan_key === options.planKey
  );
  if (match) return match.id;

  const created = await stripe.prices.create({
    product: options.productId,
    unit_amount: options.unitAmount,
    currency: "usd",
    recurring: { interval: options.interval },
    metadata: {
      shootportal_plan_key: options.planKey,
      shootportal_billing: "true",
      shootportal_interval: options.billingInterval,
    },
  });
  return created.id;
}

/**
 * Remap Stripe Prices for the current mode after catalog cents change.
 * Returns a structured summary for the platform UI (and persists via caller).
 */
export async function syncPlanStripePricesAfterCatalogChange(
  planId: string
): Promise<PlanStripeSyncResult> {
  const mode = detectMode();
  if (planId === "founding") {
    return {
      remapped: false,
      ok: true,
      mode,
      message: "Founding plan is outside Checkout.",
      monthlyPriceId: null,
      annualPriceId: null,
    };
  }

  const raw = await createServiceClient();
  const { data: plan, error } = await raw
    .from("plans")
    .select("id, key, name, description, price_monthly_cents, price_annual_cents")
    .eq("id", planId)
    .maybeSingle();
  if (error || !plan) {
    return {
      remapped: false,
      ok: false,
      mode,
      message: "Plan not found for Stripe remap.",
      monthlyPriceId: null,
      annualPriceId: null,
    };
  }
  if (plan.key === "founding") {
    return {
      remapped: false,
      ok: true,
      mode,
      message: "Founding plan is outside Checkout.",
      monthlyPriceId: null,
      annualPriceId: null,
    };
  }

  const { stripe } = getStripe();
  const { data: existingRows } = await raw
    .from("plan_stripe_prices")
    .select("billing_interval, stripe_product_id, stripe_price_id")
    .eq("plan_id", planId)
    .eq("mode", mode);

  const byInterval = new Map(
    (existingRows ?? []).map((r) => [r.billing_interval as BillingInterval, r])
  );

  const notes: string[] = [];
  let monthlyPriceId: string | null = null;
  let annualPriceId: string | null = null;

  if (typeof plan.price_monthly_cents === "number" && plan.price_monthly_cents > 0) {
    const prior = byInterval.get("monthly");
    const productId = await ensureProduct(stripe, plan, prior?.stripe_product_id ?? null);
    monthlyPriceId = await createOrReusePrice(stripe, {
      productId,
      planKey: plan.key,
      unitAmount: plan.price_monthly_cents,
      interval: "month",
      billingInterval: "monthly",
    });
    const { error: upErr } = await raw.from("plan_stripe_prices").upsert(
      {
        plan_id: planId,
        mode,
        billing_interval: "monthly",
        stripe_product_id: productId,
        stripe_price_id: monthlyPriceId,
      },
      { onConflict: "plan_id,mode,billing_interval" }
    );
    if (upErr) throw new Error(`plan_stripe_prices monthly upsert: ${upErr.message}`);
    notes.push(`monthly→${monthlyPriceId}`);
  }

  if (typeof plan.price_annual_cents === "number" && plan.price_annual_cents > 0) {
    const prior = byInterval.get("annual");
    const productId = await ensureProduct(stripe, plan, prior?.stripe_product_id ?? null);
    // Catalog stores "annual monthly equivalent"; Checkout annual is 12× that.
    const annualUnit = plan.price_annual_cents * 12;
    annualPriceId = await createOrReusePrice(stripe, {
      productId,
      planKey: plan.key,
      unitAmount: annualUnit,
      interval: "year",
      billingInterval: "annual",
    });
    const { error: upErr } = await raw.from("plan_stripe_prices").upsert(
      {
        plan_id: planId,
        mode,
        billing_interval: "annual",
        stripe_product_id: productId,
        stripe_price_id: annualPriceId,
      },
      { onConflict: "plan_id,mode,billing_interval" }
    );
    if (upErr) throw new Error(`plan_stripe_prices annual upsert: ${upErr.message}`);
    notes.push(`annual→${annualPriceId}`);
  }

  if (!notes.length) {
    return {
      remapped: false,
      ok: true,
      mode,
      message: "No positive catalog prices to map in Stripe.",
      monthlyPriceId: null,
      annualPriceId: null,
    };
  }

  return {
    remapped: true,
    ok: true,
    mode,
    message: `Stripe ${mode} prices remapped (${notes.join(", ")}). Existing subscribers keep prior Prices until they change plans.`,
    monthlyPriceId,
    annualPriceId,
  };
}

function expectedCatalogCents(
  interval: BillingInterval,
  monthly: number | null,
  annualMonthlyEquivalent: number | null
): number | null {
  if (interval === "monthly") {
    return typeof monthly === "number" && monthly > 0 ? monthly : null;
  }
  // Catalog stores annual as monthly-equivalent; Stripe annual Price is 12×.
  return typeof annualMonthlyEquivalent === "number" && annualMonthlyEquivalent > 0
    ? annualMonthlyEquivalent * 12
    : null;
}

/**
 * Compare every catalog plan price to the mapped Stripe Price unit_amount for
 * the active Stripe mode. Silent divergence between advertised and charged
 * amounts must surface here.
 */
export async function checkPlanStripePriceConsistency(
  modeOverride?: StripeMode
): Promise<PlanStripeConsistencyReport> {
  const mode = modeOverride ?? detectMode();
  const raw = await createServiceClient();
  const { data: plans, error } = await raw
    .from("plans")
    .select("id, key, name, price_monthly_cents, price_annual_cents")
    .neq("key", "founding")
    .order("key");
  if (error) throw new Error(error.message);

  const { data: mappings, error: mapErr } = await raw
    .from("plan_stripe_prices")
    .select("plan_id, mode, billing_interval, stripe_price_id")
    .eq("mode", mode);
  if (mapErr) throw new Error(mapErr.message);

  const byPlan = new Map<string, { monthly?: string; annual?: string }>();
  for (const row of mappings ?? []) {
    const planId = row.plan_id as string;
    const cur = byPlan.get(planId) ?? {};
    if (row.billing_interval === "monthly") cur.monthly = row.stripe_price_id as string;
    if (row.billing_interval === "annual") cur.annual = row.stripe_price_id as string;
    byPlan.set(planId, cur);
  }

  const { stripe } = getStripe();
  const mismatches: PlanStripePriceMismatch[] = [];
  let rowsChecked = 0;

  for (const plan of plans ?? []) {
    const map = byPlan.get(plan.id as string) ?? {};
    for (const interval of ["monthly", "annual"] as BillingInterval[]) {
      const catalog = expectedCatalogCents(
        interval,
        plan.price_monthly_cents as number | null,
        plan.price_annual_cents as number | null
      );
      if (catalog == null) continue;
      rowsChecked += 1;
      const priceId = interval === "monthly" ? map.monthly : map.annual;
      if (!priceId) {
        mismatches.push({
          planKey: plan.key as string,
          planName: plan.name as string,
          mode,
          billingInterval: interval,
          catalogCents: catalog,
          stripeUnitAmountCents: null,
          stripePriceId: null,
          reason: "missing_mapping",
        });
        continue;
      }
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (price.deleted || !price.active) {
          mismatches.push({
            planKey: plan.key as string,
            planName: plan.name as string,
            mode,
            billingInterval: interval,
            catalogCents: catalog,
            stripeUnitAmountCents: price.unit_amount,
            stripePriceId: priceId,
            reason: "stripe_inactive",
          });
          continue;
        }
        if (price.unit_amount !== catalog) {
          mismatches.push({
            planKey: plan.key as string,
            planName: plan.name as string,
            mode,
            billingInterval: interval,
            catalogCents: catalog,
            stripeUnitAmountCents: price.unit_amount,
            stripePriceId: priceId,
            reason: "amount_mismatch",
          });
        }
      } catch {
        mismatches.push({
          planKey: plan.key as string,
          planName: plan.name as string,
          mode,
          billingInterval: interval,
          catalogCents: catalog,
          stripeUnitAmountCents: null,
          stripePriceId: priceId,
          reason: "stripe_price_missing",
        });
      }
    }
  }

  return {
    modeChecked: mode,
    checkedAt: new Date().toISOString(),
    mismatches,
    rowsChecked,
  };
}
