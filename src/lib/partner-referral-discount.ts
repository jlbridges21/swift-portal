/**
 * Partner referral signup discount — program defaults, per-partner overrides,
 * and mode-aware Stripe coupon resolution.
 *
 * Commissions are on revenue COLLECTED: a discounted invoice yields a lower
 * partner commission for that period. Partners see this explicitly in the dashboard.
 *
 * Annual billing: monthly repeating coupons do not map cleanly to annual invoices
 * (Stripe applies duration_in_months across subscription billing periods; an annual
 * invoice counts as one period). Default: monthly plans only — no annual discount.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode, type StripeMode } from "@/lib/stripe";
import type { BillingInterval } from "@/lib/stripe-billing";
import {
  PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY,
  formatPartnerReferralAnnualBillingPolicy,
  PARTNER_REFERRAL_OVERRIDE_COUPON_POLICY,
  PARTNER_COMMISSION_ON_NET_COLLECTED,
  type PartnerProgramSettingsRow,
  type ReferralDiscountStripeCouponRow,
  type ReferralDiscountWindow,
  type EffectiveReferralDiscount,
  type AppliedReferralDiscount,
  type PartnerReferralDiscountWarning,
} from "@/lib/partner-referral-discount.constants";

export {
  PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY,
  formatPartnerReferralAnnualBillingPolicy,
  PARTNER_REFERRAL_OVERRIDE_COUPON_POLICY,
  PARTNER_COMMISSION_ON_NET_COLLECTED,
  type PartnerProgramSettingsRow,
  type ReferralDiscountStripeCouponRow,
  type ReferralDiscountWindow,
  type EffectiveReferralDiscount,
  type AppliedReferralDiscount,
  type PartnerReferralDiscountWarning,
};

const DEFAULT_PROGRAM: PartnerProgramSettingsRow = {
  default_commission_rate_pct: 30,
  auto_approve_applications: true,
  referral_discount_enabled: true,
  referral_discount_amount_cents: 500,
  referral_discount_duration_months: 3,
  referral_discount_annual_enabled: false,
  referral_discount_annual_amount_cents: 1500,
};

const PROGRAM_SETTINGS_SELECT =
  "default_commission_rate_pct, auto_approve_applications, referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months, referral_discount_annual_enabled, referral_discount_annual_amount_cents, stripe_coupon_sync_ok, stripe_coupon_sync_message, stripe_coupon_sync_at, stripe_coupon_sync_mode";

export async function loadPartnerProgramSettings(): Promise<PartnerProgramSettingsRow> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_program_settings")
    .select(PROGRAM_SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PartnerProgramSettingsRow | null) ?? DEFAULT_PROGRAM;
}

export async function loadReferralDiscountStripeCoupons(): Promise<ReferralDiscountStripeCouponRow[]> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_referral_discount_stripe_coupons")
    .select("mode, billing_interval, stripe_coupon_id, amount_off_cents, duration_months, updated_at")
    .order("mode")
    .order("billing_interval")
    .order("amount_off_cents")
    .order("duration_months");
  if (error) throw new Error(error.message);
  return (data ?? []) as ReferralDiscountStripeCouponRow[];
}

export async function updatePartnerProgramSettings(
  patch: Partial<PartnerProgramSettingsRow>
): Promise<PartnerProgramSettingsRow> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_program_settings")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select(PROGRAM_SETTINGS_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as PartnerProgramSettingsRow;
}

export type PartnerProgramSettingsUpdateResult = PartnerProgramSettingsRow & {
  stripeCouponSyncMessage?: string | null;
  stripeCouponSyncOk?: boolean | null;
  stripeCouponSyncMonthlyCouponId?: string | null;
  stripeCouponSyncAnnualCouponId?: string | null;
  stripeCouponSyncMode?: string | null;
};

/** Save program settings; remap Stripe coupons when amount/duration change. */
export async function updatePartnerProgramSettingsWithStripeSync(
  patch: Partial<PartnerProgramSettingsRow>
): Promise<PartnerProgramSettingsUpdateResult> {
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("partner_program_settings")
    .select(PROGRAM_SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();
  if (!existing) throw new Error("Partner program settings not found.");

  const prior = existing as PartnerProgramSettingsRow;
  const { referralDiscountCouponConfigChanged, syncReferralDiscountCouponsAfterSettingsChange } =
    await import("@/lib/sync-referral-discount-stripe-coupons");

  const couponConfigChanged = referralDiscountCouponConfigChanged(prior, patch);

  const settings = await updatePartnerProgramSettings(patch);

  const shouldSyncCoupons =
    settings.referral_discount_enabled &&
    (couponConfigChanged ||
      (prior.referral_discount_enabled === false && patch.referral_discount_enabled === true));

  let stripeCouponSyncMessage: string | null = null;
  let stripeCouponSyncOk: boolean | null = null;
  let stripeCouponSyncMonthlyCouponId: string | null = null;
  let stripeCouponSyncAnnualCouponId: string | null = null;
  let stripeCouponSyncMode: string | null = null;

  if (shouldSyncCoupons) {
    try {
      const result = await syncReferralDiscountCouponsAfterSettingsChange(settings);
      stripeCouponSyncMessage = result.message;
      stripeCouponSyncOk = result.ok;
      stripeCouponSyncMonthlyCouponId = result.monthlyCouponId;
      stripeCouponSyncAnnualCouponId = result.annualCouponId;
      stripeCouponSyncMode = result.mode;
      await raw
        .from("partner_program_settings")
        .update({
          stripe_coupon_sync_ok: result.ok,
          stripe_coupon_sync_message: result.message,
          stripe_coupon_sync_at: new Date().toISOString(),
          stripe_coupon_sync_mode: result.mode,
        })
        .eq("id", 1);
    } catch (err) {
      console.error("[partner-referral-discount] Stripe coupon remap failed", err);
      stripeCouponSyncOk = false;
      stripeCouponSyncMessage =
        err instanceof Error
          ? `Settings saved, but Stripe Coupon remap failed: ${err.message}`
          : "Settings saved, but Stripe Coupon remap failed — run npx tsx scripts/setup-stripe-partner-referral-discount.ts for the current mode.";
      await raw
        .from("partner_program_settings")
        .update({
          stripe_coupon_sync_ok: false,
          stripe_coupon_sync_message: stripeCouponSyncMessage,
          stripe_coupon_sync_at: new Date().toISOString(),
          stripe_coupon_sync_mode: null,
        })
        .eq("id", 1);
    }
  }

  const { data: refreshed } = await raw
    .from("partner_program_settings")
    .select(PROGRAM_SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();

  return {
    ...((refreshed ?? settings) as PartnerProgramSettingsRow),
    stripeCouponSyncMessage,
    stripeCouponSyncOk,
    stripeCouponSyncMonthlyCouponId,
    stripeCouponSyncAnnualCouponId,
    stripeCouponSyncMode,
  };
}

type PartnerDiscountOverride = {
  referral_discount_enabled: boolean | null;
  referral_discount_amount_cents: number | null;
  referral_discount_duration_months: number | null;
};

export function resolveEffectiveReferralDiscount(
  program: PartnerProgramSettingsRow,
  partner?: PartnerDiscountOverride | null
): EffectiveReferralDiscount {
  const hasOverride =
    partner &&
    (partner.referral_discount_enabled != null ||
      partner.referral_discount_amount_cents != null ||
      partner.referral_discount_duration_months != null);

  if (!hasOverride) {
    return {
      enabled: program.referral_discount_enabled,
      amountOffCents: program.referral_discount_amount_cents,
      durationMonths: program.referral_discount_duration_months,
      annualEnabled: program.referral_discount_annual_enabled,
      annualAmountOffCents: program.referral_discount_annual_amount_cents,
      source: "program",
    };
  }

  const enabled =
    partner!.referral_discount_enabled ?? program.referral_discount_enabled;
  return {
    enabled,
    amountOffCents:
      partner!.referral_discount_amount_cents ?? program.referral_discount_amount_cents,
    durationMonths:
      partner!.referral_discount_duration_months ?? program.referral_discount_duration_months,
    annualEnabled: program.referral_discount_annual_enabled,
    annualAmountOffCents: program.referral_discount_annual_amount_cents,
    source: "partner_override",
  };
}

/** Offer copy for co-branded landing pages — null when discount is off or invalid. */
export function formatPartnerReferralLandingOffer(config: EffectiveReferralDiscount): string | null {
  if (!config.enabled) return null;
  const parts: string[] = [];
  if (config.amountOffCents > 0 && config.durationMonths > 0) {
    const amt = formatCents(config.amountOffCents);
    const months = config.durationMonths;
    parts.push(
      `${amt}/month off your first ${months} paid month${months === 1 ? "" : "s"} on monthly billing`
    );
  }
  if (config.annualEnabled && config.annualAmountOffCents > 0) {
    parts.push(
      `${formatCents(config.annualAmountOffCents)} off your first annual invoice (once) on annual billing`
    );
  }
  if (parts.length === 0) return null;
  return `Get ${parts.join("; ")} when you subscribe through this page.`;
}

/**
 * Display copy for /billing plan cards — uses the same AppliedReferralDiscount
 * resolver as checkout so shown price and charged price cannot diverge.
 * Returns null when the discount is not eligible for this interval (show list price).
 */
export function formatReferralPlanPriceDisplay(args: {
  listPriceCents: number;
  discount: AppliedReferralDiscount;
  interval: BillingInterval;
}): {
  listPriceCents: number;
  discountedPriceCents: number;
  amountOffCents: number;
  durationMonths: number;
  /** e.g. "$24/mo for your first 3 months, then $29/mo" */
  headline: string;
} | null {
  const { listPriceCents, discount, interval } = args;
  if (!discount.eligible || !discount.config) return null;

  if (interval === "monthly") {
    const amountOff = discount.config.amountOffCents;
    if (amountOff <= 0 || listPriceCents <= 0) return null;
    const discounted = Math.max(0, listPriceCents - amountOff);
    const months = discount.config.durationMonths;
    if (months <= 0) return null;
    return {
      listPriceCents,
      discountedPriceCents: discounted,
      amountOffCents: amountOff,
      durationMonths: months,
      headline: `${formatCents(discounted)}/mo for your first ${months} month${months === 1 ? "" : "s"}, then ${formatCents(listPriceCents)}/mo`,
    };
  }

  // Annual: Stripe applies annualAmountOffCents once against the yearly invoice
  // (price_annual_cents × 12). listPriceCents here is the monthly-equivalent shown
  // elsewhere on /billing ("$24/mo billed annually").
  if (!discount.config.annualEnabled) return null;
  const amountOff = discount.config.annualAmountOffCents;
  if (amountOff <= 0 || listPriceCents <= 0) return null;
  const yearlyList = listPriceCents * 12;
  const yearlyDiscounted = Math.max(0, yearlyList - amountOff);
  const discountedMonthlyEquiv = Math.round(yearlyDiscounted / 12);
  return {
    listPriceCents,
    discountedPriceCents: discountedMonthlyEquiv,
    amountOffCents: amountOff,
    durationMonths: 1,
    headline: `${formatCents(discountedMonthlyEquiv)}/mo billed annually for the first year (${formatCents(amountOff)} off the annual bill), then ${formatCents(listPriceCents)}/mo billed annually`,
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Single resolver for "what discount will actually be applied" — used by checkout,
 * landing pages, partner dashboard, and platform warnings. Includes Stripe coupon lookup.
 */
export async function resolveAppliedReferralDiscount(args: {
  program: PartnerProgramSettingsRow;
  partner?: PartnerDiscountOverride | null;
  partnerStatus?: "active" | "suspended" | null;
  interval: BillingInterval;
  mode?: StripeMode;
  /** When true, create the Stripe coupon row if missing (override/program save paths). */
  ensureCoupon?: boolean;
}): Promise<AppliedReferralDiscount> {
  if (process.env.PARTNER_REFERRAL_DISCOUNT_FORCE_FAIL === "1") {
    return { eligible: false, reason: "forced_fail" };
  }

  if (args.partnerStatus != null && args.partnerStatus !== "active") {
    return { eligible: false, reason: "partner_inactive" };
  }

  const config = resolveEffectiveReferralDiscount(args.program, args.partner);
  if (!config.enabled || config.durationMonths <= 0 || config.amountOffCents <= 0) {
    return { eligible: false, reason: "discount_disabled", config };
  }

  const mode = args.mode ?? getStripeMode();
  const { ensureReferralDiscountStripeCoupon, loadStoredReferralDiscountCouponId } =
    await import("@/lib/sync-referral-discount-stripe-coupons");

  if (args.interval === "annual") {
    if (!config.annualEnabled) {
      return { eligible: false, reason: "annual_not_eligible", config };
    }
    const amountOffCents = config.annualAmountOffCents;
    const durationMonths = 1;
    let couponId: string | null = null;

    if (args.ensureCoupon) {
      const ensured = await ensureReferralDiscountStripeCoupon({
        mode,
        interval: "annual",
        amountOffCents,
        durationMonths,
      });
      couponId = ensured.couponId;
      if (!ensured.ok || !couponId) {
        console.error("[partner-referral-discount] FAILED to ensure annual coupon", {
          mode,
          amountOffCents,
          durationMonths,
          message: ensured.message,
        });
        return { eligible: false, reason: "no_annual_coupon", config };
      }
    } else {
      couponId = await loadStoredReferralDiscountCouponId({
        mode,
        interval: "annual",
        amountOffCents,
        durationMonths,
      });
      if (!couponId) {
        console.warn("[partner-referral-discount] no Stripe coupon for annual config — checkout at full price", {
          mode,
          amountOffCents,
          durationMonths,
          source: config.source,
        });
        return { eligible: false, reason: "no_annual_coupon", config };
      }
    }

    return { eligible: true, couponId, config };
  }

  const amountOffCents = config.amountOffCents;
  const durationMonths = config.durationMonths;
  let couponId: string | null = null;

  if (args.ensureCoupon) {
    const ensured = await ensureReferralDiscountStripeCoupon({
      mode,
      interval: "monthly",
      amountOffCents,
      durationMonths,
    });
    couponId = ensured.couponId;
    if (!ensured.ok || !couponId) {
      console.error("[partner-referral-discount] FAILED to ensure monthly coupon", {
        mode,
        amountOffCents,
        durationMonths,
        source: config.source,
        message: ensured.message,
      });
      return { eligible: false, reason: "no_monthly_coupon", config };
    }
  } else {
    couponId = await loadStoredReferralDiscountCouponId({
      mode,
      interval: "monthly",
      amountOffCents,
      durationMonths,
    });
    if (!couponId) {
      console.warn("[partner-referral-discount] no Stripe coupon for monthly config — checkout at full price", {
        mode,
        amountOffCents,
        durationMonths,
        source: config.source,
      });
      return { eligible: false, reason: "no_monthly_coupon", config };
    }
  }

  const offerText = formatPartnerReferralLandingOffer(config);
  return { eligible: true, couponId, config, offerText };
}

/** Landing, partner dashboard, platform preview — monthly billing, coupon required. */
export async function resolveReferralDiscountForPartner(
  partnerId: string
): Promise<AppliedReferralDiscount> {
  const raw = await createServiceClient();
  const [program, { data: partner }] = await Promise.all([
    loadPartnerProgramSettings(),
    raw
      .from("partners")
      .select(
        "status, referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months"
      )
      .eq("id", partnerId)
      .maybeSingle(),
  ]);

  if (!partner) {
    return { eligible: false, reason: "partner_inactive" };
  }

  return resolveAppliedReferralDiscount({
    program,
    partner,
    partnerStatus: partner.status as "active" | "suspended",
    interval: "monthly",
  });
}

export async function loadStripeCouponIdForReferralDiscount(args: {
  mode?: StripeMode;
  interval: BillingInterval;
  amountOffCents: number;
  durationMonths: number;
}): Promise<string | null> {
  const { loadStoredReferralDiscountCouponId } = await import(
    "@/lib/sync-referral-discount-stripe-coupons"
  );
  return loadStoredReferralDiscountCouponId({
    mode: args.mode,
    interval: args.interval,
    amountOffCents: args.amountOffCents,
    durationMonths: args.durationMonths,
  });
}

export async function resolveReferralDiscountForBusiness(args: {
  businessId: string;
  interval: BillingInterval;
}): Promise<AppliedReferralDiscount> {
  const raw = await createServiceClient();
  const { data: referral } = await raw
    .from("partner_referrals")
    .select("partner_id")
    .eq("business_id", args.businessId)
    .maybeSingle();
  if (!referral?.partner_id) {
    return { eligible: false, reason: "no_referral" };
  }

  const [{ data: partner }, program] = await Promise.all([
    raw
      .from("partners")
      .select(
        "id, status, referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months"
      )
      .eq("id", referral.partner_id)
      .maybeSingle(),
    loadPartnerProgramSettings(),
  ]);

  if (!partner || partner.status !== "active") {
    return { eligible: false, reason: "partner_inactive" };
  }

  return resolveAppliedReferralDiscount({
    program,
    partner,
    partnerStatus: partner.status as "active" | "suspended",
    interval: args.interval,
  });
}

/** After saving a partner override, ensure Stripe coupon exists for that configuration. */
export async function ensurePartnerReferralDiscountCoupon(partnerId: string): Promise<{
  ok: boolean;
  couponId: string | null;
  message?: string;
}> {
  const raw = await createServiceClient();
  const [{ data: partner }, program] = await Promise.all([
    raw
      .from("partners")
      .select(
        "status, referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months"
      )
      .eq("id", partnerId)
      .maybeSingle(),
    loadPartnerProgramSettings(),
  ]);

  if (!partner || partner.status !== "active") {
    return { ok: true, couponId: null, message: "Partner inactive — no coupon needed." };
  }

  const resolved = await resolveAppliedReferralDiscount({
    program,
    partner,
    partnerStatus: "active",
    interval: "monthly",
    ensureCoupon: true,
  });

  if (!resolved.config?.enabled) {
    return { ok: true, couponId: null, message: "Discount disabled for partner." };
  }

  if (!resolved.eligible || !resolved.couponId) {
    return {
      ok: false,
      couponId: null,
      message: `Could not create Stripe coupon for $${(resolved.config.amountOffCents / 100).toFixed(2)}/mo × ${resolved.config.durationMonths} months.`,
    };
  }

  return { ok: true, couponId: resolved.couponId };
}

/** Partners whose effective discount has no mapped Stripe coupon (platform console warnings). */
export async function listPartnerReferralDiscountWarnings(): Promise<PartnerReferralDiscountWarning[]> {
  const raw = await createServiceClient();
  const [program, { data: partners }] = await Promise.all([
    loadPartnerProgramSettings(),
    raw
      .from("partners")
      .select(
        "id, brand_name, status, referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months"
      )
      .eq("status", "active"),
  ]);

  const warnings: PartnerReferralDiscountWarning[] = [];
  for (const partner of partners ?? []) {
    const resolved = await resolveAppliedReferralDiscount({
      program,
      partner,
      partnerStatus: "active",
      interval: "monthly",
    });

    const config = resolved.config;
    if (!config?.enabled) continue;

    if (!resolved.eligible) {
      warnings.push({
        partnerId: partner.id as string,
        brandName: (partner.brand_name as string) || "Unknown",
        amountOffCents: config.amountOffCents,
        durationMonths: config.durationMonths,
        reason: resolved.reason ?? "no_monthly_coupon",
      });
    }
  }

  return warnings;
}

/**
 * Apply coupon to subscription. Used when checkout cannot pre-apply (trial handoff)
 * or as webhook safety net. Never throws — logs and returns false on failure.
 */
export async function applyReferralDiscountToSubscription(args: {
  subscriptionId: string;
  businessId: string;
  interval: BillingInterval;
  source: string;
}): Promise<{ applied: boolean; reason?: string }> {
  try {
    const resolved = await resolveReferralDiscountForBusiness({
      businessId: args.businessId,
      interval: args.interval,
    });
    if (!resolved.eligible || !resolved.couponId) {
      return { applied: false, reason: resolved.reason ?? "not_eligible" };
    }

    const { stripe } = getStripe();
    const sub = await stripe.subscriptions.retrieve(args.subscriptionId);
    const existing = sub.discounts ?? [];
    if (existing.length > 0) {
      return { applied: false, reason: "subscription_already_discounted" };
    }

    await stripe.subscriptions.update(args.subscriptionId, {
      discounts: [{ coupon: resolved.couponId }],
      metadata: {
        ...sub.metadata,
        // Clear legacy deferred flag so expiry cannot trigger a re-apply.
        shootportal_referral_discount_pending: "",
        shootportal_referral_discount_applied: "true",
      },
    });

    console.info("[partner-referral-discount] coupon applied to subscription", {
      source: args.source,
      businessId: args.businessId,
      subscriptionId: args.subscriptionId,
      couponId: resolved.couponId,
    });
    return { applied: true };
  } catch (err) {
    console.error("[partner-referral-discount] FAILED to apply coupon (non-fatal)", {
      source: args.source,
      businessId: args.businessId,
      subscriptionId: args.subscriptionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { applied: false, reason: "stripe_error" };
  }
}

function inferIntervalFromSubscriptionPrice(
  unitAmount: number | null | undefined,
  planMonthlyCents: number | null,
  planAnnualChargeCents: number | null
): BillingInterval {
  if (unitAmount != null && planAnnualChargeCents != null && unitAmount === planAnnualChargeCents) {
    return "annual";
  }
  if (unitAmount != null && planMonthlyCents != null && unitAmount >= planMonthlyCents * 6) {
    return "annual";
  }
  return "monthly";
}

/** Count paid subscription periods for discount window display. */
export async function computeReferralDiscountWindow(args: {
  businessId: string;
  partnerId: string;
  stripeMode?: StripeMode;
}): Promise<ReferralDiscountWindow | null> {
  const mode = args.stripeMode ?? getStripeMode();
  const raw = await createServiceClient();

  const [{ data: partner }, program, { data: payments }] = await Promise.all([
    raw
      .from("partners")
      .select(
        "referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months"
      )
      .eq("id", args.partnerId)
      .maybeSingle(),
    loadPartnerProgramSettings(),
    raw
      .from("platform_subscription_payments")
      .select("id, amount_paid_cents, paid_at")
      .eq("business_id", args.businessId)
      .eq("stripe_mode", mode)
      .order("paid_at", { ascending: true }),
  ]);

  if (!partner) return null;
  const config = resolveEffectiveReferralDiscount(program, partner);
  if (!config.enabled || config.durationMonths <= 0) return null;

  const paidPeriods = (payments ?? []).length;
  if (paidPeriods === 0) {
    return {
      inWindow: false,
      paidPeriods: 0,
      durationMonths: config.durationMonths,
      periodsRemaining: config.durationMonths,
      amountOffCents: config.amountOffCents,
      label: `Discount pending — starts on first paid month (${config.durationMonths} months at ${formatCents(config.amountOffCents)}/mo off)`,
    };
  }

  const inWindow = paidPeriods <= config.durationMonths;
  const periodsRemaining = Math.max(0, config.durationMonths - paidPeriods);
  return {
    inWindow,
    paidPeriods,
    durationMonths: config.durationMonths,
    periodsRemaining,
    amountOffCents: config.amountOffCents,
    label: inWindow
      ? `${paidPeriods} of ${config.durationMonths} discount months used · ${formatCents(config.amountOffCents)}/mo off`
      : `Discount ended after ${config.durationMonths} months`,
  };
}

export async function loadPartnerReferralDiscountMetrics(stripeMode?: StripeMode): Promise<{
  activeDiscountedReferrals: number;
  totalDiscountGivenCents: number;
  program: PartnerProgramSettingsRow;
}> {
  const mode = stripeMode ?? getStripeMode();
  const program = await loadPartnerProgramSettings();
  const raw = await createServiceClient();

  const { data: referrals } = await raw.from("partner_referrals").select("business_id, partner_id");
  if (!referrals?.length) {
    return { activeDiscountedReferrals: 0, totalDiscountGivenCents: 0, program };
  }

  const businessIds = referrals.map((r) => r.business_id as string);
  const { data: payments } = await raw
    .from("platform_subscription_payments")
    .select("business_id, amount_paid_cents")
    .in("business_id", businessIds)
    .eq("stripe_mode", mode);

  const { data: businesses } = await raw
    .from("businesses")
    .select("id, plan")
    .in("id", businessIds);
  const planByBiz = new Map((businesses ?? []).map((b) => [b.id as string, b.plan as string]));

  const { data: plans } = await raw.from("plans").select("key, price_monthly_cents");
  const priceByPlan = new Map(
    (plans ?? []).map((p) => [p.key as string, p.price_monthly_cents as number | null])
  );

  const partnerByBiz = new Map(referrals.map((r) => [r.business_id as string, r.partner_id as string]));
  const partnerIds = [...new Set(referrals.map((r) => r.partner_id as string))];
  const { data: partnerRows } = await raw
    .from("partners")
    .select(
      "id, referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months"
    )
    .in("id", partnerIds);
  const partnerMap = new Map((partnerRows ?? []).map((p) => [p.id as string, p]));

  let totalDiscountGivenCents = 0;
  const activeBiz = new Set<string>();

  for (const p of payments ?? []) {
    const bizId = p.business_id as string;
    const partnerId = partnerByBiz.get(bizId);
    if (!partnerId) continue;
    const partner = partnerMap.get(partnerId);
    const config = resolveEffectiveReferralDiscount(program, partner);
    if (!config.enabled) continue;

    const planKey = planByBiz.get(bizId);
    const catalog = planKey ? priceByPlan.get(planKey) : null;
    const paid = typeof p.amount_paid_cents === "number" ? p.amount_paid_cents : 0;
    if (catalog != null && paid > 0 && paid < catalog) {
      totalDiscountGivenCents += catalog - paid;
      activeBiz.add(bizId);
    }
  }

  // Referrals currently in discount window (paid periods < duration)
  let activeDiscountedReferrals = 0;
  for (const r of referrals) {
    const window = await computeReferralDiscountWindow({
      businessId: r.business_id as string,
      partnerId: r.partner_id as string,
      stripeMode: mode,
    });
    if (window?.inWindow) activeDiscountedReferrals += 1;
  }

  return { activeDiscountedReferrals, totalDiscountGivenCents, program };
}

export { inferIntervalFromSubscriptionPrice };

/** Apply deferred partner referral discount (webhook safety net).
 *
 * New checkouts attach the coupon at Session create. This path remains for
 * in-flight subscriptions that still have shootportal_referral_discount_pending
 * metadata from the old deferred flow. It applies while trialing so the first
 * paid invoice is covered — never re-applies after a coupon naturally expires.
 */
export async function maybeApplyPendingReferralDiscountFromSubscription(
  subscription: import("stripe").Stripe.Subscription,
  source: string
): Promise<{ applied: boolean; reason?: string }> {
  const businessId = subscription.metadata?.business_id?.trim();
  if (!businessId) return { applied: false, reason: "no_business_id" };

  const pending = subscription.metadata?.shootportal_referral_discount_pending === "true";
  if (!pending) {
    return { applied: false, reason: "not_pending" };
  }

  const hasDiscount = (subscription.discounts?.length ?? 0) > 0;
  if (hasDiscount) {
    return { applied: false, reason: "already_discounted" };
  }

  const intervalMeta = subscription.metadata?.shootportal_referral_discount_interval;
  const interval: BillingInterval = intervalMeta === "annual" ? "annual" : "monthly";

  const resolved = await resolveReferralDiscountForBusiness({ businessId, interval });
  if (!resolved.eligible || !resolved.couponId) {
    return { applied: false, reason: resolved.reason ?? "not_eligible" };
  }

  return applyReferralDiscountToSubscription({
    subscriptionId: subscription.id,
    businessId,
    interval,
    source,
  });
}
