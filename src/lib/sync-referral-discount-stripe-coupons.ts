/**
 * Stripe Coupons for partner referral discounts — keyed by configuration
 * (mode × interval × amount × duration). Created on demand and reused when the
 * same configuration appears again (program default or partner override).
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import type { PartnerProgramSettingsRow } from "@/lib/partner-referral-discount.constants";

type StripeMode = "test" | "live";
type BillingInterval = "monthly" | "annual";

export type ReferralDiscountCouponConfig = {
  mode?: StripeMode;
  interval: BillingInterval;
  amountOffCents: number;
  durationMonths: number;
};

export type ReferralDiscountCouponEnsureResult = {
  ok: boolean;
  couponId: string | null;
  mode: StripeMode;
  message?: string;
};

export type ReferralDiscountCouponSyncResult = {
  remapped: boolean;
  ok: boolean;
  mode: StripeMode;
  message: string;
  monthlyCouponId: string | null;
  annualCouponId: string | null;
};

const CONFIG_CONFLICT_KEY = "mode,billing_interval,amount_off_cents,duration_months";

function detectMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_")) return "live";
  return "test";
}

async function loadStoredCouponByConfig(
  raw: Awaited<ReturnType<typeof createServiceClient>>,
  mode: StripeMode,
  interval: BillingInterval,
  amountOffCents: number,
  durationMonths: number
) {
  const { data, error } = await raw
    .from("partner_referral_discount_stripe_coupons")
    .select("stripe_coupon_id, amount_off_cents, duration_months")
    .eq("mode", mode)
    .eq("billing_interval", interval)
    .eq("amount_off_cents", amountOffCents)
    .eq("duration_months", durationMonths)
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
    { onConflict: CONFIG_CONFLICT_KEY }
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
 * Ensure a Stripe coupon row exists for an exact discount configuration.
 * Reuses existing coupons when config matches; creates in Stripe only when needed.
 */
export async function ensureReferralDiscountStripeCoupon(
  config: ReferralDiscountCouponConfig
): Promise<ReferralDiscountCouponEnsureResult> {
  const mode = config.mode ?? detectMode();
  const { interval, amountOffCents, durationMonths } = config;

  if (amountOffCents <= 0 || durationMonths <= 0) {
    return {
      ok: false,
      couponId: null,
      mode,
      message: "Invalid discount configuration (amount and duration must be positive).",
    };
  }

  const raw = await createServiceClient();
  const stored = await loadStoredCouponByConfig(
    raw,
    mode,
    interval,
    amountOffCents,
    durationMonths
  );

  if (stored?.stripe_coupon_id) {
    return { ok: true, couponId: stored.stripe_coupon_id as string, mode };
  }

  const { stripe } = getStripe();
  const couponId = await ensureCoupon(
    stripe,
    interval,
    amountOffCents,
    durationMonths,
    stored?.stripe_coupon_id ?? null
  );
  await upsertStoredCoupon(raw, mode, interval, couponId, amountOffCents, durationMonths);
  return { ok: true, couponId, mode };
}

/**
 * Remap Stripe Coupons for the current mode after program discount settings change.
 */
export async function syncReferralDiscountCouponsAfterSettingsChange(
  program: PartnerProgramSettingsRow
): Promise<ReferralDiscountCouponSyncResult> {
  const mode = detectMode();

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

  const notes: string[] = [];
  let monthlyCouponId: string | null = null;
  let annualCouponId: string | null = null;

  if (
    program.referral_discount_amount_cents > 0 &&
    program.referral_discount_duration_months > 0
  ) {
    const result = await ensureReferralDiscountStripeCoupon({
      mode,
      interval: "monthly",
      amountOffCents: program.referral_discount_amount_cents,
      durationMonths: program.referral_discount_duration_months,
    });
    if (!result.ok || !result.couponId) {
      return {
        remapped: false,
        ok: false,
        mode,
        message: result.message ?? "Failed to ensure monthly referral discount coupon.",
        monthlyCouponId: null,
        annualCouponId: null,
      };
    }
    monthlyCouponId = result.couponId;
    notes.push(`monthly→${monthlyCouponId}`);
  }

  if (program.referral_discount_annual_enabled && program.referral_discount_annual_amount_cents > 0) {
    const result = await ensureReferralDiscountStripeCoupon({
      mode,
      interval: "annual",
      amountOffCents: program.referral_discount_annual_amount_cents,
      durationMonths: 1,
    });
    if (!result.ok || !result.couponId) {
      return {
        remapped: notes.length > 0,
        ok: false,
        mode,
        message: result.message ?? "Failed to ensure annual referral discount coupon.",
        monthlyCouponId,
        annualCouponId: null,
      };
    }
    annualCouponId = result.couponId;
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

/** Look up a stored coupon id for an exact configuration (no Stripe API call). */
export async function loadStoredReferralDiscountCouponId(
  config: ReferralDiscountCouponConfig
): Promise<string | null> {
  const mode = config.mode ?? detectMode();
  const raw = await createServiceClient();
  const stored = await loadStoredCouponByConfig(
    raw,
    mode,
    config.interval,
    config.amountOffCents,
    config.durationMonths
  );
  return stored?.stripe_coupon_id ?? null;
}
