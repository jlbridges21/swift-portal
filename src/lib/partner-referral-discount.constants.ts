export const PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY =
  "Partner referral discounts apply to monthly subscriptions only. Annual billing is charged at the full plan price.";

/** Per-partner amount/duration overrides require a matching Stripe coupon row (one per mode × interval). */
export const PARTNER_REFERRAL_OVERRIDE_COUPON_POLICY =
  "Per-partner discount overrides only apply at checkout when their amount and duration match the program coupon stored in Stripe. Otherwise no discount is applied (fail-safe — never the wrong coupon).";

export const PARTNER_COMMISSION_ON_NET_COLLECTED =
  "Partner commissions are calculated on subscription revenue actually collected each period. During a referred customer's discount window, their payments are lower — so your commission is lower too (same rate, smaller base).";

export type PartnerProgramSettingsRow = {
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
