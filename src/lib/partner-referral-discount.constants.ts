export const PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY =
  "Partner referral discounts apply to monthly subscriptions only. Annual billing is charged at the full plan price.";

export const PARTNER_COMMISSION_ON_NET_COLLECTED =
  "Partner commissions are calculated on subscription revenue actually collected each period. During a referred customer's discount window, their payments are lower — so your commission is lower too (same rate, smaller base).";

export type PartnerProgramSettingsRow = {
  referral_discount_enabled: boolean;
  referral_discount_amount_cents: number;
  referral_discount_duration_months: number;
  referral_discount_annual_enabled: boolean;
  referral_discount_annual_amount_cents: number;
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
