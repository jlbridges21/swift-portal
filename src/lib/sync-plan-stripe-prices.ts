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
 * Returns a human-readable summary for the platform UI.
 */
export async function syncPlanStripePricesAfterCatalogChange(planId: string): Promise<{
  remapped: boolean;
  mode: StripeMode;
  message: string;
}> {
  const mode = detectMode();
  if (planId === "founding") {
    return { remapped: false, mode, message: "Founding plan is outside Checkout." };
  }

  const raw = await createServiceClient();
  const { data: plan, error } = await raw
    .from("plans")
    .select("id, key, name, description, price_monthly_cents, price_annual_cents")
    .eq("id", planId)
    .maybeSingle();
  if (error || !plan) {
    return { remapped: false, mode, message: "Plan not found for Stripe remap." };
  }
  if (plan.key === "founding") {
    return { remapped: false, mode, message: "Founding plan is outside Checkout." };
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

  if (typeof plan.price_monthly_cents === "number" && plan.price_monthly_cents > 0) {
    const prior = byInterval.get("monthly");
    const productId = await ensureProduct(stripe, plan, prior?.stripe_product_id ?? null);
    const priceId = await createOrReusePrice(stripe, {
      productId,
      planKey: plan.key,
      unitAmount: plan.price_monthly_cents,
      interval: "month",
      billingInterval: "monthly",
    });
    await raw.from("plan_stripe_prices").upsert(
      {
        plan_id: planId,
        mode,
        billing_interval: "monthly",
        stripe_product_id: productId,
        stripe_price_id: priceId,
      },
      { onConflict: "plan_id,mode,billing_interval" }
    );
    notes.push(`monthly→${priceId}`);
  }

  if (typeof plan.price_annual_cents === "number" && plan.price_annual_cents > 0) {
    const prior = byInterval.get("annual");
    const productId = await ensureProduct(stripe, plan, prior?.stripe_product_id ?? null);
    // Catalog stores "annual monthly equivalent"; Checkout annual is 12× that.
    const annualUnit = plan.price_annual_cents * 12;
    const priceId = await createOrReusePrice(stripe, {
      productId,
      planKey: plan.key,
      unitAmount: annualUnit,
      interval: "year",
      billingInterval: "annual",
    });
    await raw.from("plan_stripe_prices").upsert(
      {
        plan_id: planId,
        mode,
        billing_interval: "annual",
        stripe_product_id: productId,
        stripe_price_id: priceId,
      },
      { onConflict: "plan_id,mode,billing_interval" }
    );
    notes.push(`annual→${priceId}`);
  }

  if (!notes.length) {
    return {
      remapped: false,
      mode,
      message: "No positive catalog prices to map in Stripe.",
    };
  }

  return {
    remapped: true,
    mode,
    message: `Stripe ${mode} prices remapped (${notes.join(", ")}). Existing subscribers keep prior Prices until they change plans.`,
  };
}
