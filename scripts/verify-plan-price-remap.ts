/**
 * Verify catalog price → Stripe Price remap end to end.
 * Run: npx tsx scripts/verify-plan-price-remap.ts
 *
 * Bumps Solo monthly by 1¢, remaps, confirms plan_stripe_prices + Stripe Price
 * unit_amount, confirms loadPlanPriceForMode for checkout, then restores.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

import { createServiceClient } from "../src/lib/supabase/server";
import { syncPlanStripePricesAfterCatalogChange } from "../src/lib/sync-plan-stripe-prices";
import { getStripe } from "../src/lib/stripe";
import { loadPlanPriceForMode } from "../src/lib/stripe-billing";

async function main() {
  const raw = await createServiceClient();
  const { data: plan, error } = await raw
    .from("plans")
    .select("id, key, name, price_monthly_cents, price_annual_cents")
    .eq("key", "solo")
    .maybeSingle();
  if (error || !plan) throw new Error(error?.message || "Solo plan not found");

  const originalMonthly = plan.price_monthly_cents as number;
  const bumped = originalMonthly + 1;
  console.log(`Solo monthly was ${originalMonthly}¢ → bump to ${bumped}¢ for remap test`);

  const { error: upErr } = await raw
    .from("plans")
    .update({ price_monthly_cents: bumped })
    .eq("id", plan.id);
  if (upErr) throw new Error(upErr.message);

  try {
    const result = await syncPlanStripePricesAfterCatalogChange(plan.id);
    console.log("remap result:", JSON.stringify(result, null, 2));
    if (!result.ok || !result.monthlyPriceId) {
      throw new Error("Remap did not return a monthly Price id");
    }

    const { data: row } = await raw
      .from("plan_stripe_prices")
      .select("stripe_price_id, mode, billing_interval")
      .eq("plan_id", plan.id)
      .eq("mode", result.mode)
      .eq("billing_interval", "monthly")
      .maybeSingle();
    if (!row || row.stripe_price_id !== result.monthlyPriceId) {
      throw new Error(
        `plan_stripe_prices mismatch: db=${row?.stripe_price_id} result=${result.monthlyPriceId}`
      );
    }
    console.log(`plan_stripe_prices[${result.mode}/monthly]=${row.stripe_price_id}`);

    const { stripe } = getStripe();
    const price = await stripe.prices.retrieve(result.monthlyPriceId);
    if (price.unit_amount !== bumped) {
      throw new Error(`Stripe Price unit_amount ${price.unit_amount} !== catalog ${bumped}`);
    }
    console.log(`Stripe Price ${price.id} unit_amount=${price.unit_amount} (ok)`);

    const loaded = await loadPlanPriceForMode("solo", result.mode);
    if (loaded?.stripe_price_monthly_id !== result.monthlyPriceId) {
      throw new Error(
        `loadPlanPriceForMode monthly ${loaded?.stripe_price_monthly_id} !== ${result.monthlyPriceId}`
      );
    }
    console.log("loadPlanPriceForMode monthly matches remap (fresh checkout uses this Price id)");
    console.log("VERIFY_OK");
  } finally {
    await raw.from("plans").update({ price_monthly_cents: originalMonthly }).eq("id", plan.id);
    const restore = await syncPlanStripePricesAfterCatalogChange(plan.id);
    console.log("restored Solo monthly + remap:", restore.monthlyPriceId, restore.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
