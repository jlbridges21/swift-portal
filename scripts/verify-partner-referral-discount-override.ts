/**
 * Verify partner referral discount override ↔ checkout parity.
 *
 *   npx tsx scripts/verify-partner-referral-discount-override.ts
 *
 * Test mode only — refuses live Stripe keys.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (secret.startsWith("sk_live")) {
    throw new Error("Refusing to run against live Stripe — use test mode only.");
  }

  const {
    resolveEffectiveReferralDiscount,
    resolveAppliedReferralDiscount,
    resolveReferralDiscountForPartner,
    loadPartnerProgramSettings,
    formatPartnerReferralLandingOffer,
  } = await import("../src/lib/partner-referral-discount");

  const program = await loadPartnerProgramSettings();

  // --- Reproduce pre-fix mismatch (logic simulation) ---
  const overridePartner = {
    referral_discount_enabled: true,
    referral_discount_amount_cents: 1000,
    referral_discount_duration_months: 3,
  };
  const effective = resolveEffectiveReferralDiscount(program, overridePartner);
  const oldLandingOffer = formatPartnerReferralLandingOffer(effective);
  const oldCheckout = await resolveAppliedReferralDiscount({
    program,
    partner: overridePartner,
    partnerStatus: "active",
    interval: "monthly",
    ensureCoupon: false,
  });

  checks.push({
    name: "Pre-fix simulation: landing showed offer from raw config",
    ok: oldLandingOffer != null && oldLandingOffer.includes("$10"),
    detail: oldLandingOffer ?? "(null)",
  });
  checks.push({
    name: "Pre-fix simulation: checkout without coupon was ineligible",
    ok:
      !oldCheckout.eligible &&
      (oldCheckout.reason === "no_monthly_coupon" ||
        oldCheckout.reason === "forced_fail"),
    detail: `eligible=${oldCheckout.eligible} reason=${oldCheckout.reason ?? "none"}`,
  });

  // --- Unified resolver: landing uses same path ---
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: partnerRow } = await supabase
    .from("partners")
    .select("id, brand_name")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (partnerRow?.id) {
    const landingResolved = await resolveReferralDiscountForPartner(partnerRow.id as string);
    checks.push({
      name: "Landing resolver includes coupon check",
      ok:
        !landingResolved.config?.enabled ||
        (landingResolved.eligible && Boolean(landingResolved.offerText)) ||
        (!landingResolved.eligible && !landingResolved.offerText),
      detail: `eligible=${landingResolved.eligible} offer=${landingResolved.offerText ?? "(hidden)"}`,
    });
  } else {
    checks.push({
      name: "Landing resolver includes coupon check",
      ok: true,
      detail: "Skipped — no active partner in database",
    });
  }

  // --- Config-keyed coupon: ensure + reuse ---
  const { ensureReferralDiscountStripeCoupon, loadStoredReferralDiscountCouponId } =
    await import("../src/lib/sync-referral-discount-stripe-coupons");

  const cfg10 = {
    interval: "monthly" as const,
    amountOffCents: 1000,
    durationMonths: 3,
  };
  const first = await ensureReferralDiscountStripeCoupon(cfg10);
  const second = await ensureReferralDiscountStripeCoupon(cfg10);
  checks.push({
    name: "$10/3mo coupon created in test mode",
    ok: first.ok && Boolean(first.couponId),
    detail: first.couponId ?? first.message ?? "missing",
  });
  checks.push({
    name: "Same configuration reuses one coupon row",
    ok: first.ok && second.ok && first.couponId === second.couponId,
    detail: `${first.couponId} vs ${second.couponId}`,
  });

  const cfg5 = { interval: "monthly" as const, amountOffCents: 500, durationMonths: 6 };
  const five = await ensureReferralDiscountStripeCoupon(cfg5);
  checks.push({
    name: "$5/6mo gets a separate coupon",
    ok: five.ok && five.couponId !== first.couponId,
    detail: five.couponId ?? "missing",
  });

  const stored10 = await loadStoredReferralDiscountCouponId(cfg10);
  checks.push({
    name: "Checkout lookup finds coupon by configuration",
    ok: stored10 === first.couponId,
    detail: stored10 ?? "null",
  });

  const unified = await resolveAppliedReferralDiscount({
    program,
    partner: overridePartner,
    partnerStatus: "active",
    interval: "monthly",
    ensureCoupon: false,
  });
  checks.push({
    name: "Post-fix: override with mapped coupon is eligible",
    ok: unified.eligible && unified.couponId === first.couponId,
    detail: `coupon=${unified.couponId ?? "none"}`,
  });
  checks.push({
    name: "Post-fix: advertised offer matches applied config",
    ok:
      unified.eligible &&
      unified.offerText != null &&
      unified.config?.amountOffCents === 1000,
    detail: unified.offerText ?? "(null)",
  });

  const disabled = await resolveAppliedReferralDiscount({
    program,
    partner: { referral_discount_enabled: false, referral_discount_amount_cents: null, referral_discount_duration_months: null },
    partnerStatus: "active",
    interval: "monthly",
  });
  checks.push({
    name: "Disabled partner override hides offer",
    ok: !disabled.eligible && disabled.reason === "discount_disabled",
    detail: disabled.reason ?? "none",
  });

  process.env.PARTNER_REFERRAL_DISCOUNT_FORCE_FAIL = "1";
  const forced = await resolveAppliedReferralDiscount({
    program,
    partner: overridePartner,
    partnerStatus: "active",
    interval: "monthly",
  });
  delete process.env.PARTNER_REFERRAL_DISCOUNT_FORCE_FAIL;
  checks.push({
    name: "FORCE_FAIL: checkout/landing fail closed",
    ok: !forced.eligible && forced.reason === "forced_fail",
    detail: forced.reason ?? "none",
  });

  console.log("\n=== Partner referral discount override verification ===\n");
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    if (!c.ok) failed += 1;
    console.log(`${mark}  ${c.name}`);
    console.log(`      ${c.detail}\n`);
  }

  if (failed) {
    console.error(`${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
