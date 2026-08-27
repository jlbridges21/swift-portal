/**
 * Public Partner Program marketing data (phase 6).
 * Commission rate and plan prices come from the database — never hardcoded on /partners.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { listPublicPlans } from "@/lib/entitlements";
import { formatPlanPrice } from "@/lib/plan-catalog";
import { PARTNER_COMMISSION_HOLD_DAYS } from "@/lib/partner-commissions";
import { loadCalculatorPlans } from "@/lib/partner-dashboard";
import { loadPartnerProgramSettings } from "@/lib/partner-referral-discount";
import { loadPartnerPayoutAutomationSettings } from "@/lib/partner-payout-automation";
import { PARTNER_PAYOUT_MINIMUM_CENTS, PARTNER_PAYOUT_SCHEDULE_LABEL } from "@/lib/partner-stripe-connect";

export async function getPartnerProgramDefaultCommissionRatePct(): Promise<number> {
  const raw = await createServiceClient();
  const { data, error } = await raw.rpc("partner_program_default_commission_rate_pct");
  if (error) throw new Error(error.message);
  const n = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error("Invalid partner program default commission rate from database.");
  }
  return n;
}

export type PartnerReferralDiscountPitch = {
  enabled: boolean;
  amountCents: number;
  durationMonths: number;
  amountLabel: string;
  annualEnabled: boolean;
  annualAmountCents: number;
  annualAmountLabel: string;
};

export type PartnerProgramMarketingData = {
  commissionRatePct: number;
  holdDays: number;
  /** From partner_program_settings — drives apply UX copy. */
  autoApproveApplications: boolean;
  /** Live payout automation master switch — marketing copy must follow TODAY's state. */
  automatedPayoutsEnabled: boolean;
  payoutMinimumCents: number;
  payoutScheduleLabel: string;
  plans: Awaited<ReturnType<typeof loadCalculatorPlans>>;
  referralDiscount: PartnerReferralDiscountPitch;
  /** Primary public plan used for example arithmetic (usually studio). */
  examplePlan: {
    key: string;
    name: string;
    priceMonthlyCents: number;
    priceMonthlyLabel: string;
  } | null;
  exampleReferrals: number;
  exampleMonthlyCommissionCents: number;
  exampleMonthlyCommissionLabel: string;
};

export async function loadPartnerProgramMarketingData(): Promise<PartnerProgramMarketingData> {
  const [commissionRatePct, plans, publicPlans, programSettings, payoutAutomation] =
    await Promise.all([
      getPartnerProgramDefaultCommissionRatePct(),
      loadCalculatorPlans(),
      listPublicPlans(),
      loadPartnerProgramSettings(),
      loadPartnerPayoutAutomationSettings(),
    ]);

  const studio =
    publicPlans.find((p) => p.key === "studio") ??
    publicPlans.find((p) => p.key !== "founding") ??
    publicPlans[0] ??
    null;

  const priceMonthlyCents =
    studio && typeof studio.price_monthly_cents === "number" && studio.price_monthly_cents > 0
      ? studio.price_monthly_cents
      : 0;

  const exampleReferrals = 100;
  const exampleMonthlyCommissionCents = Math.round(
    (priceMonthlyCents * commissionRatePct) / 100
  ) * exampleReferrals;

  const referralDiscount: PartnerReferralDiscountPitch = {
    enabled: programSettings.referral_discount_enabled,
    amountCents: programSettings.referral_discount_amount_cents,
    durationMonths: programSettings.referral_discount_duration_months,
    amountLabel: formatPlanPrice(programSettings.referral_discount_amount_cents),
    annualEnabled: programSettings.referral_discount_annual_enabled,
    annualAmountCents: programSettings.referral_discount_annual_amount_cents,
    annualAmountLabel: formatPlanPrice(programSettings.referral_discount_annual_amount_cents),
  };

  return {
    commissionRatePct,
    holdDays: PARTNER_COMMISSION_HOLD_DAYS,
    autoApproveApplications: programSettings.auto_approve_applications !== false,
    automatedPayoutsEnabled: payoutAutomation.automated_payouts_enabled,
    payoutMinimumCents:
      payoutAutomation.automated_payouts_minimum_cents || PARTNER_PAYOUT_MINIMUM_CENTS,
    payoutScheduleLabel: PARTNER_PAYOUT_SCHEDULE_LABEL,
    plans,
    referralDiscount,
    examplePlan: studio
      ? {
          key: studio.key,
          name: studio.name,
          priceMonthlyCents,
          priceMonthlyLabel: formatPlanPrice(priceMonthlyCents),
        }
      : null,
    exampleReferrals,
    exampleMonthlyCommissionCents,
    exampleMonthlyCommissionLabel: formatPlanPrice(exampleMonthlyCommissionCents),
  };
}
