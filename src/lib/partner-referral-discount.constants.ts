/** Monthly-only annual policy — use when annual referral discount is OFF. Prefer `formatPartnerReferralAnnualBillingPolicy`. */
export const PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY =
  "Partner referral discounts apply to monthly subscriptions only. Annual billing is charged at the full plan price.";

function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Annual vs monthly referral-discount copy — derived from live settings, never a fixed sentence.
 * When annual is on: monthly is recurring for N months; annual is a one-time amount off the first annual invoice.
 */
export function formatPartnerReferralAnnualBillingPolicy(config: {
  annualEnabled: boolean;
  annualAmountOffCents: number;
}): string {
  if (config.annualEnabled && config.annualAmountOffCents > 0) {
    return `Monthly billing gets the recurring monthly referral discount. Annual billing gets ${formatUsdCents(config.annualAmountOffCents)} off the first annual invoice (once), then full annual price.`;
  }
  return PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY;
}

/** Per-partner overrides get their own Stripe coupon row keyed by amount × duration. */
export const PARTNER_REFERRAL_OVERRIDE_COUPON_POLICY =
  "Per-partner discount overrides create or reuse a Stripe coupon for that exact amount and duration. If coupon setup fails, no discount is advertised or applied (fail-safe — never the wrong amount).";

export const PARTNER_COMMISSION_ON_NET_COLLECTED =
  "Partner commissions are calculated on subscription revenue actually collected each period. During a referred customer's discount window, their payments are lower — so your commission is lower too (same rate, smaller base).";

export type PartnerProgramSettingsRow = {
  default_commission_rate_pct?: number;
  /** Instant partner creation on apply when true; pending review queue when false. */
  auto_approve_applications?: boolean;
  referral_discount_enabled: boolean;
  referral_discount_amount_cents: number;
  referral_discount_duration_months: number;
  referral_discount_annual_enabled: boolean;
  referral_discount_annual_amount_cents: number;
  stripe_coupon_sync_ok?: boolean | null;
  stripe_coupon_sync_message?: string | null;
  stripe_coupon_sync_at?: string | null;
  stripe_coupon_sync_mode?: string | null;
};

export type ReferralDiscountStripeCouponRow = {
  mode: "test" | "live";
  billing_interval: "monthly" | "annual";
  stripe_coupon_id: string;
  amount_off_cents: number;
  duration_months: number;
  updated_at?: string;
};

export type ReferralDiscountWindow = {
  inWindow: boolean;
  paidPeriods: number;
  durationMonths: number;
  periodsRemaining: number;
  amountOffCents: number;
  label: string;
};

export type EffectiveReferralDiscount = {
  enabled: boolean;
  amountOffCents: number;
  durationMonths: number;
  annualEnabled: boolean;
  annualAmountOffCents: number;
  source: "program" | "partner_override";
};

/** What checkout and landing both use — includes coupon verification. */
export type AppliedReferralDiscount = {
  eligible: boolean;
  reason?: string;
  couponId?: string;
  config?: EffectiveReferralDiscount;
  /** Monthly-billing offer copy; null when not eligible or disabled. */
  offerText?: string | null;
};

export type PartnerReferralDiscountWarning = {
  partnerId: string;
  brandName: string;
  amountOffCents: number;
  durationMonths: number;
  reason: string;
};
