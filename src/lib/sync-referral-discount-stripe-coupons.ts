/**
 * When referral discount amounts/duration change in partner_program_settings,
 * Stripe Coupons are immutable — create replacements and remap
 * partner_referral_discount_stripe_coupons for the current Stripe mode.
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import type { PartnerProgramSettingsRow } from "@/lib/partner-referral-discount.constants";

type StripeMode = "test" | "live";
type BillingInterval = "monthly" | "annual";

export type ReferralDiscountCouponSyncResult = {
  remapped: boolean;
  ok: boolean;
  mode: StripeMode;
  message: string;
  monthlyCouponId: string | null;
  annualCouponId: string | null;
};

function detectMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_")) return "live";
  return "test";
}

async function loadStoredCoupon(
  raw: Awaited<ReturnType<typeof createServiceClient>>,
  mode: StripeMode,
  interval: BillingInterval
) {
  const { data, error } = await raw
    .from("partner_referral_discount_stripe_coupons")
    .select("stripe_coupon_id, amount_off_cents, duration_months")
    .eq("mode", mode)
    .eq("billing_interval", interval)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function upsertStoredCoupon(
  raw: Awaited<ReturnType<typeof createServiceClient>>,
  mode: StripeMode,
  interval: BillingInterval,
  couponId: string,
  amountOffCents: number,
  durationMonths: number
) {
  const { error } = await raw.from("partner_referral_discount_stripe_coupons").upsert(
    {
      mode,
      billing_interval: interval,
      stripe_coupon_id: couponId,
      amount_off_cents: amountOffCents,
      duration_months: durationMonths,
    },
    { onConflict: "mode,billing_interval" }
  );
  if (error) throw new Error(error.message);
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
        return existing.id;
      }
    } catch {
      /* create below */
    }
  }

  const byMeta = await findCouponByMetadata(stripe, interval, amountOffCents, durationMonths);
  if (byMeta) return byMeta.id;

  const name =
    interval === "annual"
      ? `Partner referral — ${amountOffCents / 100} off first year`
      : `Partner referral — ${amountOffCents / 100}/mo × ${durationMonths} months`;

  const created = await stripe.coupons.create({
    name,
    amount_off: amountOffCents,
    currency: "usd",
    duration: interval === "annual" ? "once" : durationMonths > 1 ? "repeating" : "once",
    duration_in_months:
      interval === "annual" ? undefined : durationMonths > 1 ? durationMonths : undefined,
    metadata: {
      shootportal_referral_discount: "true",
      shootportal_interval: interval,
      shootportal_amount_off_cents: String(amountOffCents),
      shootportal_duration_months: String(durationMonths),
    },
  });
  return created.id;
}

/**
 * Remap Stripe Coupons for the current mode after program discount settings change.
 */
export async function syncReferralDiscountCouponsAfterSettingsChange(
  program: PartnerProgramSettingsRow
): Promise<ReferralDiscountCouponSyncResult> {
  const mode = detectMode();
  const raw = await createServiceClient();

  if (!program.referral_discount_enabled) {
    return {
      remapped: false,
      ok: true,
      mode,
      message: "Referral discount disabled — no Stripe coupon sync required.",
      monthlyCouponId: null,
      annualCouponId: null,
    };
  }

  const { stripe } = getStripe();
  const notes: string[] = [];
  let monthlyCouponId: string | null = null;
  let annualCouponId: string | null = null;

  if (
    program.referral_discount_amount_cents > 0 &&
    program.referral_discount_duration_months > 0
  ) {
    const stored = await loadStoredCoupon(raw, mode, "monthly");
    monthlyCouponId = await ensureCoupon(
      stripe,
      "monthly",
      program.referral_discount_amount_cents,
      program.referral_discount_duration_months,
      stored?.stripe_coupon_id ?? null
    );
    await upsertStoredCoupon(
      raw,
      mode,
      "monthly",
      monthlyCouponId,
      program.referral_discount_amount_cents,
      program.referral_discount_duration_months
    );
    notes.push(`monthly→${monthlyCouponId}`);
  }

  if (program.referral_discount_annual_enabled && program.referral_discount_annual_amount_cents > 0) {
    const stored = await loadStoredCoupon(raw, mode, "annual");
    annualCouponId = await ensureCoupon(
      stripe,
      "annual",
      program.referral_discount_annual_amount_cents,
      1,
      stored?.stripe_coupon_id ?? null
    );
    await upsertStoredCoupon(raw, mode, "annual", annualCouponId, program.referral_discount_annual_amount_cents, 1);
    notes.push(`annual→${annualCouponId}`);
  }

  if (!notes.length) {
    return {
      remapped: false,
      ok: true,
      mode,
      message: "No positive discount amounts to map in Stripe.",
      monthlyCouponId: null,
      annualCouponId: null,
    };
  }

  return {
    remapped: true,
    ok: true,
    mode,
    message: `Stripe ${mode} referral coupons remapped (${notes.join(", ")}). New referred signups use the new coupon; existing subscribers keep coupons already attached.`,
    monthlyCouponId,
    annualCouponId,
  };
}

export function referralDiscountCouponConfigChanged(
  existing: PartnerProgramSettingsRow,
  patch: Partial<PartnerProgramSettingsRow>
): boolean {
  return (
    (patch.referral_discount_amount_cents !== undefined &&
      patch.referral_discount_amount_cents !== existing.referral_discount_amount_cents) ||
    (patch.referral_discount_duration_months !== undefined &&
      patch.referral_discount_duration_months !== existing.referral_discount_duration_months) ||
    (patch.referral_discount_annual_amount_cents !== undefined &&
      patch.referral_discount_annual_amount_cents !== existing.referral_discount_annual_amount_cents) ||
    (patch.referral_discount_annual_enabled !== undefined &&
      patch.referral_discount_annual_enabled !== existing.referral_discount_annual_enabled)
  );
}
