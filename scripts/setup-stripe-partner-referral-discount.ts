/**
 * Idempotent Stripe Coupon setup for partner referral signup discounts.
 * Operates on the PLATFORM account only.
 *
 * Writes into partner_referral_discount_stripe_coupons for the mode derived
 * from STRIPE_SECRET_KEY. Creates monthly coupon from program settings; optional
 * annual coupon when referral_discount_annual_enabled is true.
 *
 *   npx tsx scripts/setup-stripe-partner-referral-discount.ts
 *   npx tsx scripts/setup-stripe-partner-referral-discount.ts --confirm-live
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

type StripeMode = "test" | "live";
type BillingInterval = "monthly" | "annual";

type ProgramSettings = {
  referral_discount_enabled: boolean;
  referral_discount_amount_cents: number;
  referral_discount_duration_months: number;
  referral_discount_annual_enabled: boolean;
  referral_discount_annual_amount_cents: number;
};

function detectMode(secret: string): StripeMode {
  if (secret.startsWith("sk_live")) return "live";
  if (secret.startsWith("sk_test")) return "test";
  throw new Error("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_");
}

async function loadProgramSettings(
  supabase: ReturnType<typeof createClient>
): Promise<ProgramSettings> {
  const { data, error } = await supabase
    .from("partner_program_settings")
    .select(
      "referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months, referral_discount_annual_enabled, referral_discount_annual_amount_cents"
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (
    (data as ProgramSettings | null) ?? {
      referral_discount_enabled: true,
      referral_discount_amount_cents: 500,
      referral_discount_duration_months: 3,
      referral_discount_annual_enabled: false,
      referral_discount_annual_amount_cents: 1500,
    }
  );
}

async function loadStoredCoupon(
  supabase: ReturnType<typeof createClient>,
  mode: StripeMode,
  interval: BillingInterval
) {
  const { data, error } = await supabase
    .from("partner_referral_discount_stripe_coupons")
    .select("stripe_coupon_id, amount_off_cents, duration_months")
    .eq("mode", mode)
    .eq("billing_interval", interval)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertStoredCoupon(
  supabase: ReturnType<typeof createClient>,
  mode: StripeMode,
  interval: BillingInterval,
  couponId: string,
  amountOffCents: number,
  durationMonths: number
) {
  const { error } = await supabase.from("partner_referral_discount_stripe_coupons").upsert(
    {
      mode,
      billing_interval: interval,
      stripe_coupon_id: couponId,
      amount_off_cents: amountOffCents,
      duration_months: durationMonths,
    },
    { onConflict: "mode,billing_interval" }
  );
  if (error) throw error;
}

async function findCouponByMetadata(
  stripe: Stripe,
  interval: BillingInterval,
  amountOffCents: number,
  durationMonths: number
): Promise<Stripe.Coupon | null> {
  const listed = await stripe.coupons.list({ limit: 100 });
  const hit = listed.data.find(
    (c) =>
      c.metadata?.shootportal_referral_discount === "true" &&
      c.metadata?.shootportal_interval === interval &&
      c.amount_off === amountOffCents &&
      String(c.duration_in_months ?? "") === String(durationMonths) &&
      c.duration === (durationMonths > 1 ? "repeating" : "once")
  );
  return hit ?? null;
}

async function ensureCoupon(
  stripe: Stripe,
  interval: BillingInterval,
  amountOffCents: number,
  durationMonths: number,
  storedId: string | null
): Promise<string> {
  if (storedId) {
    try {
      const existing = await stripe.coupons.retrieve(storedId);
      if (
        existing.valid &&
        existing.amount_off === amountOffCents &&
        (interval === "annual"
          ? existing.duration === "once"
          : existing.duration === "repeating" &&
            existing.duration_in_months === durationMonths)
      ) {
        console.log(`  coupon found (db): ${existing.id} ${interval}`);
        return existing.id;
      }
      console.log(`  coupon ${storedId} stale — creating replacement`);
    } catch {
      console.log(`  coupon ${storedId} missing — creating`);
    }
  }

  const byMeta = await findCouponByMetadata(stripe, interval, amountOffCents, durationMonths);
  if (byMeta) {
    console.log(`  coupon found (metadata): ${byMeta.id} ${interval}`);
    return byMeta.id;
  }

  const name =
    interval === "annual"
      ? `Partner referral — ${amountOffCents / 100} off first year`
      : `Partner referral — ${amountOffCents / 100}/mo × ${durationMonths} months`;

  const created = await stripe.coupons.create({
    name,
    amount_off: amountOffCents,
    currency: "usd",
    duration: interval === "annual" ? "once" : durationMonths > 1 ? "repeating" : "once",
    duration_in_months: interval === "annual" ? undefined : durationMonths > 1 ? durationMonths : undefined,
    metadata: {
      shootportal_referral_discount: "true",
      shootportal_interval: interval,
      shootportal_amount_off_cents: String(amountOffCents),
      shootportal_duration_months: String(durationMonths),
    },
  });
  console.log(`  coupon created: ${created.id} ${interval} ${amountOffCents}¢`);
  return created.id;
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY missing");

  const mode = detectMode(secret);
  const confirmLive = process.argv.includes("--confirm-live");

  console.log("========================================");
  console.log(mode === "live" ? "Running in LIVE mode" : "Running in TEST mode");
  console.log("Partner referral discount coupons");
  console.log("========================================");

  if (mode === "live" && !confirmLive) {
    throw new Error(
      "Refusing to create LIVE Stripe coupons without --confirm-live. Re-run with that flag when intentional."
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

  const program = await loadProgramSettings(supabase);
  console.log("\nProgram settings:", program);

  if (!program.referral_discount_enabled) {
    console.log("\nReferral discount disabled in program settings — skipping coupon creation.");
    return;
  }

  // Monthly coupon (repeating)
  if (program.referral_discount_amount_cents > 0 && program.referral_discount_duration_months > 0) {
    console.log("\nMonthly coupon:");
    const stored = await loadStoredCoupon(supabase, mode, "monthly");
    const id = await ensureCoupon(
      stripe,
      "monthly",
      program.referral_discount_amount_cents,
      program.referral_discount_duration_months,
      stored?.stripe_coupon_id ?? null
    );
    await upsertStoredCoupon(
      supabase,
      mode,
      "monthly",
      id,
      program.referral_discount_amount_cents,
      program.referral_discount_duration_months
    );
  }

  // Annual coupon (once — flat amount off first annual invoice)
  if (program.referral_discount_annual_enabled && program.referral_discount_annual_amount_cents > 0) {
    console.log("\nAnnual coupon:");
    const stored = await loadStoredCoupon(supabase, mode, "annual");
    const id = await ensureCoupon(
      stripe,
      "annual",
      program.referral_discount_annual_amount_cents,
      1,
      stored?.stripe_coupon_id ?? null
    );
    await upsertStoredCoupon(
      supabase,
      mode,
      "annual",
      id,
      program.referral_discount_annual_amount_cents,
      1
    );
  } else {
    console.log("\nAnnual coupon: skipped (referral_discount_annual_enabled = false)");
  }

  console.log(`\nDone (${mode}). Re-run is safe — existing coupons are reused when config matches.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
