/**
 * Idempotent Stripe Product/Price setup for ShootPortal SaaS plans.
 * Operates on the PLATFORM account only (no Stripe-Account header).
 *
 * Skips the founding plan — founding / comped access is outside Checkout.
 *
 * Run (TEST mode keys only):
 *   npx tsx scripts/setup-stripe-billing.ts
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

type PlanRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly_cents: number | null;
  price_annual_cents: number | null;
  stripe_product_id: string | null;
  stripe_price_monthly_id: string | null;
  stripe_price_annual_id: string | null;
};

async function findProductByLookup(
  stripe: Stripe,
  lookupKey: string
): Promise<Stripe.Product | null> {
  const listed = await stripe.products.list({ limit: 100, active: true });
  const hit = listed.data.find((p) => p.metadata?.shootportal_plan_key === lookupKey);
  return hit ?? null;
}

async function ensureProduct(stripe: Stripe, plan: PlanRow): Promise<Stripe.Product> {
  if (plan.stripe_product_id) {
    try {
      const existing = await stripe.products.retrieve(plan.stripe_product_id);
      console.log(`  product found (db): ${existing.id} (${plan.key})`);
      return existing;
    } catch {
      console.log(`  product id ${plan.stripe_product_id} missing in Stripe — recreating`);
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
  if (secret.startsWith("sk_live")) {
    throw new Error("Refusing to run against live keys — use TEST mode only.");
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
    .select(
      "id, key, name, description, price_monthly_cents, price_annual_cents, stripe_product_id, stripe_price_monthly_id, stripe_price_annual_id"
    )
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

    const product = await ensureProduct(stripe, plan);
    let monthlyId = plan.stripe_price_monthly_id;
    let annualId = plan.stripe_price_annual_id;

    if (plan.price_monthly_cents != null) {
      monthlyId = await ensureRecurringPrice(
        stripe,
        product.id,
        plan.stripe_price_monthly_id,
        plan.price_monthly_cents,
        "month",
        plan.key
      );
    }

    if (plan.price_annual_cents != null) {
      // Annual catalog stores monthly-equivalent cents (display); charge 12×.
      const annualCharge = plan.price_annual_cents * 12;
      annualId = await ensureRecurringPrice(
        stripe,
        product.id,
        plan.stripe_price_annual_id,
        annualCharge,
        "year",
        plan.key
      );
    }

    const { error: upErr } = await supabase
      .from("plans")
      .update({
        stripe_product_id: product.id,
        stripe_price_monthly_id: monthlyId,
        stripe_price_annual_id: annualId,
      })
      .eq("id", plan.id);

    if (upErr) throw upErr;
    console.log("  db updated");
  }

  console.log("\nDone. Re-run is safe — existing products/prices are reused.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
