/**
 * Idempotent Stripe Product/Price setup for ShootPortal SaaS plans.
 * Operates on the PLATFORM account only (no Stripe-Account header).
 *
 * Writes into plan_stripe_prices for the mode derived from STRIPE_SECRET_KEY.
 * Skips the founding plan — founding / comped access is outside Checkout.
 *
 *   npx tsx scripts/setup-stripe-billing.ts              # TEST only
 *   npx tsx scripts/setup-stripe-billing.ts --confirm-live  # required for LIVE
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

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

const SKIP_PLAN_KEYS = new Set(["founding"]);

type StripeMode = "test" | "live";
type BillingInterval = "monthly" | "annual";

type PlanRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly_cents: number | null;
  price_annual_cents: number | null;
};

function detectMode(secret: string): StripeMode {
  if (secret.startsWith("sk_live")) return "live";
  if (secret.startsWith("sk_test")) return "test";
  throw new Error("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_");
}

async function findProductByLookup(
  stripe: Stripe,
  lookupKey: string
): Promise<Stripe.Product | null> {
  const listed = await stripe.products.list({ limit: 100, active: true });
  const hit = listed.data.find((p) => p.metadata?.shootportal_plan_key === lookupKey);
  return hit ?? null;
}

async function loadStoredPrice(
  supabase: ReturnType<typeof createClient>,
  planId: string,
  mode: StripeMode,
  interval: BillingInterval
): Promise<{ stripe_product_id: string; stripe_price_id: string } | null> {
  const { data, error } = await supabase
    .from("plan_stripe_prices")
    .select("stripe_product_id, stripe_price_id")
    .eq("plan_id", planId)
    .eq("mode", mode)
    .eq("billing_interval", interval)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertStoredPrice(
  supabase: ReturnType<typeof createClient>,
  planId: string,
  mode: StripeMode,
  interval: BillingInterval,
  productId: string,
  priceId: string
) {
  const { error } = await supabase.from("plan_stripe_prices").upsert(
    {
      plan_id: planId,
      mode,
      billing_interval: interval,
      stripe_product_id: productId,
      stripe_price_id: priceId,
    },
    { onConflict: "plan_id,mode,billing_interval" }
  );
  if (error) throw error;
}

async function ensureProduct(
  stripe: Stripe,
  plan: PlanRow,
  existingProductId: string | null
): Promise<Stripe.Product> {
  if (existingProductId) {
    try {
      const existing = await stripe.products.retrieve(existingProductId);
      console.log(`  product found (db): ${existing.id} (${plan.key})`);
      return existing;
    } catch {
      console.log(`  product id ${existingProductId} missing in Stripe — recreating`);
    }
  }

  const byMeta = await findProductByLookup(stripe, plan.key);
  if (byMeta) {
    console.log(`  product found (metadata): ${byMeta.id} (${plan.key})`);
    return byMeta;
  }

  const created = await stripe.products.create({
    name: `ShootPortal ${plan.name}`,
    description: plan.description || undefined,
    metadata: {
      shootportal_plan_key: plan.key,
      shootportal_billing: "true",
    },
  });
  console.log(`  product created: ${created.id} (${plan.key})`);
  return created;
}

async function ensureRecurringPrice(
  stripe: Stripe,
  productId: string,
  existingPriceId: string | null,
  unitAmount: number,
  interval: "month" | "year",
  planKey: string
): Promise<string> {
  if (existingPriceId) {
    try {
      const existing = await stripe.prices.retrieve(existingPriceId);
      if (existing.active && existing.unit_amount === unitAmount) {
        console.log(`  price found (db): ${existing.id} ${interval}`);
        return existing.id;
      }
      console.log(`  price ${existingPriceId} stale — creating replacement`);
    } catch {
      console.log(`  price ${existingPriceId} missing — creating`);
    }
  }

  const listed = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = listed.data.find(
    (p) =>
      p.unit_amount === unitAmount &&
      p.recurring?.interval === interval &&
      p.currency === "usd" &&
      p.metadata?.shootportal_plan_key === planKey
  );
  if (match) {
    console.log(`  price found (list): ${match.id} ${interval}`);
    return match.id;
  }

  const created = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: "usd",
    recurring: { interval },
    metadata: {
      shootportal_plan_key: planKey,
      shootportal_billing: "true",
      shootportal_interval: interval,
    },
  });
  console.log(`  price created: ${created.id} ${interval} ${unitAmount}¢`);
  return created.id;
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY missing");

  const mode = detectMode(secret);
  const confirmLive = process.argv.includes("--confirm-live");

  console.log("========================================");
  console.log(mode === "live" ? "Running in LIVE mode" : "Running in TEST mode");
  console.log("========================================");

  if (mode === "live" && !confirmLive) {
    throw new Error(
      "Refusing to create LIVE Stripe products without --confirm-live. Re-run with that flag when intentional."
    );
  }

  const stripe = new Stripe(secret, {
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, key, name, description, price_monthly_cents, price_annual_cents")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  if (!plans?.length) {
    console.log("No active plans.");
    return;
  }

  for (const plan of plans as PlanRow[]) {
    console.log(`\nPlan: ${plan.key}`);

    if (SKIP_PLAN_KEYS.has(plan.key)) {
      console.log("  SKIP — founding/comped handled outside Checkout");
      continue;
    }

    if (plan.price_monthly_cents == null && plan.price_annual_cents == null) {
      console.log("  SKIP — no list prices");
      continue;
    }

    const storedMonthly = await loadStoredPrice(supabase, plan.id, mode, "monthly");
    const storedAnnual = await loadStoredPrice(supabase, plan.id, mode, "annual");
    const existingProductId =
      storedMonthly?.stripe_product_id ?? storedAnnual?.stripe_product_id ?? null;

    const product = await ensureProduct(stripe, plan, existingProductId);

    if (plan.price_monthly_cents != null) {
      const monthlyId = await ensureRecurringPrice(
        stripe,
        product.id,
        storedMonthly?.stripe_price_id ?? null,
        plan.price_monthly_cents,
        "month",
        plan.key
      );
      await upsertStoredPrice(supabase, plan.id, mode, "monthly", product.id, monthlyId);
      // Keep legacy columns mirrored for TEST only (back-compat during transition).
      if (mode === "test") {
        await supabase
          .from("plans")
          .update({
            stripe_product_id: product.id,
            stripe_price_monthly_id: monthlyId,
          })
          .eq("id", plan.id);
      }
    }

    if (plan.price_annual_cents != null) {
      const annualCharge = plan.price_annual_cents * 12;
      const annualId = await ensureRecurringPrice(
        stripe,
        product.id,
        storedAnnual?.stripe_price_id ?? null,
        annualCharge,
        "year",
        plan.key
      );
      await upsertStoredPrice(supabase, plan.id, mode, "annual", product.id, annualId);
      if (mode === "test") {
        await supabase
          .from("plans")
          .update({
            stripe_product_id: product.id,
            stripe_price_annual_id: annualId,
          })
          .eq("id", plan.id);
      }
    }

    console.log(`  db updated (${mode})`);
  }

  console.log(`\nDone (${mode}). Re-run is safe — existing products/prices are reused.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
