/**
 * Idempotent Stripe Coupon setup for partner referral signup discounts.
 * Operates on the PLATFORM account only.
 *
 * Delegates to syncReferralDiscountCouponsAfterSettingsChange — same path as the platform UI.
 *
 *   npx tsx scripts/setup-stripe-partner-referral-discount.ts
 *   npx tsx scripts/setup-stripe-partner-referral-discount.ts --confirm-live
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { syncReferralDiscountCouponsAfterSettingsChange } from "../src/lib/sync-referral-discount-stripe-coupons";
import type { PartnerProgramSettingsRow } from "../src/lib/partner-referral-discount.constants";

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

function detectMode(secret: string): StripeMode {
  if (secret.startsWith("sk_live")) return "live";
  if (secret.startsWith("sk_test")) return "test";
  throw new Error("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_");
}

async function loadProgramSettings(
  supabase: ReturnType<typeof createClient>
): Promise<PartnerProgramSettingsRow> {
  const { data, error } = await supabase
    .from("partner_program_settings")
    .select(
      "referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months, referral_discount_annual_enabled, referral_discount_annual_amount_cents"
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (
    (data as PartnerProgramSettingsRow | null) ?? {
      referral_discount_enabled: true,
      referral_discount_amount_cents: 500,
      referral_discount_duration_months: 3,
      referral_discount_annual_enabled: false,
      referral_discount_annual_amount_cents: 1500,
    }
  );
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

  const result = await syncReferralDiscountCouponsAfterSettingsChange(program);
  console.log("\nResult:", result.message);
  if (result.monthlyCouponId) console.log("  monthly:", result.monthlyCouponId);
  if (result.annualCouponId) console.log("  annual:", result.annualCouponId);

  await supabase
    .from("partner_program_settings")
    .update({
      stripe_coupon_sync_ok: result.ok,
      stripe_coupon_sync_message: result.message,
      stripe_coupon_sync_at: new Date().toISOString(),
      stripe_coupon_sync_mode: result.mode,
    })
    .eq("id", 1);

  console.log(`\nDone (${mode}). Re-run is safe — existing coupons are reused when config matches.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
