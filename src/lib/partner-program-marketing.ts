/**
 * Public Partner Program marketing data (phase 6).
 * Commission rate and plan prices come from the database — never hardcoded on /partners.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { listPublicPlans } from "@/lib/entitlements";
import { formatPlanPrice } from "@/lib/plan-catalog";
import { PARTNER_COMMISSION_HOLD_DAYS } from "@/lib/partner-commissions";
import { loadCalculatorPlans } from "@/lib/partner-dashboard";

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

export type PartnerProgramMarketingData = {
  commissionRatePct: number;
  holdDays: number;
  plans: Awaited<ReturnType<typeof loadCalculatorPlans>>;
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
  const [commissionRatePct, plans, publicPlans] = await Promise.all([
    getPartnerProgramDefaultCommissionRatePct(),
    loadCalculatorPlans(),
    listPublicPlans(),
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

  return {
    commissionRatePct,
    holdDays: PARTNER_COMMISSION_HOLD_DAYS,
    plans,
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
