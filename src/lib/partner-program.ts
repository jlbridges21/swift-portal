/**
 * Partner Program console metrics (phase 5).
 * Money figures for a partner always come from computePartnerBalance —
 * the same helper the partner dashboard uses.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getStripeMode } from "@/lib/stripe";
import { computePartnerBalance, type PartnerBalance } from "@/lib/partner-commissions";
import { listPartnerApplications, listPartners, type PartnerRow } from "@/lib/partners";
import {
  loadPartnerCommissionHistory,
  loadPartnerMonthlyEarnings,
  loadPartnerReferrals,
  type MonthlyEarningsBucket,
  type PartnerCommissionHistoryRow,
  type PartnerReferralRow,
} from "@/lib/partner-dashboard";
import { listPartnerPayouts, type PartnerPayoutRow } from "@/lib/partner-payouts";
import { PLAN_CATALOG_SELECT, type PlanRow } from "@/lib/plan-catalog";

export const PARTNER_GENERATED_MRR_DEFINITION =
  "Partner-generated MRR (net): for each actively subscribed partner-referred business, take the most recent ShootPortal subscription payment actually collected (deploy Stripe mode), then normalize to a monthly amount — annual invoices ÷ 12, monthly invoices as-is. Discounted referral periods count at the net collected amount, not list price. Sum across those businesses.";

export type PartnerProgramMetrics = {
  totalPartners: number;
  pendingApplications: number;
  activePartners: number;
  totalCustomersGenerated: number;
  activePartnerReferredCustomers: number;
  revenueGeneratedCents: number;
  totalCommissionsEarnedCents: number;
  pendingCommissionsCents: number;
  totalCommissionsPaidCents: number;
  partnerGeneratedMrrCents: number;
  mrrDefinition: string;
  activeDiscountedReferrals: number;
  totalReferralDiscountGivenCents: number;
};

export type PartnerTableRow = {
  id: string;
  brandName: string;
  name: string;
  email: string;
  status: string;
  commissionRatePct: number;
  referralCode: string;
  referredCustomers: number;
  activeCustomers: number;
  revenueGeneratedCents: number;
  commissionEarnedCents: number;
  amountPaidCents: number;
  currentRecurringCommissionCents: number;
  payableCents: number;
  openNetCents: number;
  pendingCents: number;
};

export type PartnerProgramChartBucket = {
  month: string;
  label: string;
  partnersCreated: number;
  referrals: number;
  revenueGeneratedCents: number;
  commissionsEarnedCents: number;
};

function monthKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    d
  );
}

function emptyBuckets(months: number): Map<string, PartnerProgramChartBucket> {
  const map = new Map<string, PartnerProgramChartBucket>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    map.set(key, {
      month: key,
      label: monthLabel(key),
      partnersCreated: 0,
      referrals: 0,
      revenueGeneratedCents: 0,
      commissionsEarnedCents: 0,
    });
  }
  return map;
}

/** Normalize a subscription payment to monthly MRR contribution. */
function paymentToMonthlyMrr(
  amountPaidCents: number,
  plan: PlanRow | null | undefined
): number {
  if (amountPaidCents <= 0) return 0;
  const annualFull =
    typeof plan?.price_annual_cents === "number" && plan.price_annual_cents > 0
      ? plan.price_annual_cents * 12
      : null;
  const monthly =
    typeof plan?.price_monthly_cents === "number" && plan.price_monthly_cents > 0
      ? plan.price_monthly_cents
      : null;

  if (annualFull != null && Math.abs(amountPaidCents - annualFull) <= 2) {
    return Math.round(amountPaidCents / 12);
  }
  // Coupon / tax drift: clearly annual-sized vs monthly catalog
  if (monthly != null && amountPaidCents >= monthly * 6) {
    return Math.round(amountPaidCents / 12);
  }
  if (annualFull != null && amountPaidCents >= annualFull * 0.7) {
    return Math.round(amountPaidCents / 12);
  }
  return amountPaidCents;
}

/**
 * Partner-generated MRR — see PARTNER_GENERATED_MRR_DEFINITION.
 */
export async function computePartnerGeneratedMrrCents(
  stripeMode: "test" | "live" = getStripeMode()
): Promise<number> {
  const raw = await createServiceClient();
  const { data: referrals, error: refErr } = await raw
    .from("partner_referrals")
    .select("business_id");
  if (refErr) throw new Error(refErr.message);
  const businessIds = [
    ...new Set((referrals ?? []).map((r) => r.business_id as string).filter(Boolean)),
  ];
  if (!businessIds.length) return 0;

  const { data: businesses, error: bizErr } = await raw
    .from("businesses")
    .select("id, plan, subscription_status, deleted_at")
    .in("id", businessIds);
  if (bizErr) throw new Error(bizErr.message);

  const active = (businesses ?? []).filter(
    (b) => !b.deleted_at && b.subscription_status === "active"
  );
  if (!active.length) return 0;

  const activeIds = active.map((b) => b.id as string);
  const planKeys = [...new Set(active.map((b) => b.plan as string).filter(Boolean))];

  const { data: plans } = planKeys.length
    ? await raw.from("plans").select(PLAN_CATALOG_SELECT).in("key", planKeys)
    : { data: [] as PlanRow[] };
  const planByKey = new Map((plans ?? []).map((p) => [(p as PlanRow).key, p as PlanRow]));

  const { data: payments, error: payErr } = await raw
    .from("platform_subscription_payments")
    .select("business_id, amount_paid_cents, paid_at")
    .in("business_id", activeIds)
    .eq("stripe_mode", stripeMode)
    .order("paid_at", { ascending: false });
  if (payErr) throw new Error(payErr.message);

  const latestByBusiness = new Map<string, number>();
  for (const p of payments ?? []) {
    const bid = p.business_id as string;
    if (latestByBusiness.has(bid)) continue;
    latestByBusiness.set(
      bid,
      typeof p.amount_paid_cents === "number" ? p.amount_paid_cents : 0
    );
  }

  let mrr = 0;
  for (const b of active) {
    const amount = latestByBusiness.get(b.id as string);
    if (amount == null) continue;
    mrr += paymentToMonthlyMrr(amount, planByKey.get(b.plan as string));
  }
  return mrr;
}

export async function loadPartnerProgramMetrics(): Promise<PartnerProgramMetrics> {
  const mode = getStripeMode();
  const raw = await createServiceClient();
  const [partners, applications] = await Promise.all([
    listPartners("all"),
    listPartnerApplications("all"),
  ]);

  const pendingApplications = applications.filter((a) => a.status === "pending").length;
  const activePartners = partners.filter((p) => p.status === "active").length;

  const { data: referrals } = await raw.from("partner_referrals").select("business_id");
  const businessIds = [
    ...new Set((referrals ?? []).map((r) => r.business_id as string).filter(Boolean)),
  ];
  const totalCustomersGenerated = businessIds.length;

  let activePartnerReferredCustomers = 0;
  let revenueGeneratedCents = 0;
  if (businessIds.length) {
    const { data: businesses } = await raw
      .from("businesses")
      .select("id, subscription_status, deleted_at")
      .in("id", businessIds);
    activePartnerReferredCustomers = (businesses ?? []).filter(
      (b) => !b.deleted_at && b.subscription_status === "active"
    ).length;

    const { data: payments } = await raw
      .from("platform_subscription_payments")
      .select("amount_paid_cents")
      .in("business_id", businessIds)
      .eq("stripe_mode", mode);
    revenueGeneratedCents = (payments ?? []).reduce(
      (s, p) => s + (typeof p.amount_paid_cents === "number" ? p.amount_paid_cents : 0),
      0
    );
  }

  let totalCommissionsEarnedCents = 0;
  let pendingCommissionsCents = 0;
  let totalCommissionsPaidCents = 0;
  for (const p of partners) {
    const bal = await computePartnerBalance(p.id, mode);
    totalCommissionsEarnedCents += bal.lifetimeEarnedCents;
    pendingCommissionsCents += bal.pendingCents;
    totalCommissionsPaidCents += bal.paidCents;
  }

  const partnerGeneratedMrrCents = await computePartnerGeneratedMrrCents(mode);

  const { loadPartnerReferralDiscountMetrics } = await import("@/lib/partner-referral-discount");
  const discountMetrics = await loadPartnerReferralDiscountMetrics(mode);

  return {
    totalPartners: partners.length,
    pendingApplications,
    activePartners,
    totalCustomersGenerated,
    activePartnerReferredCustomers,
    revenueGeneratedCents,
    totalCommissionsEarnedCents,
    pendingCommissionsCents,
    totalCommissionsPaidCents,
    partnerGeneratedMrrCents,
    mrrDefinition: PARTNER_GENERATED_MRR_DEFINITION,
    activeDiscountedReferrals: discountMetrics.activeDiscountedReferrals,
    totalReferralDiscountGivenCents: discountMetrics.totalDiscountGivenCents,
  };
}

export async function loadPartnerProgramCharts(
  months = 12
): Promise<PartnerProgramChartBucket[]> {
  const mode = getStripeMode();
  const raw = await createServiceClient();
  const buckets = emptyBuckets(months);
  const keys = [...buckets.keys()];
  const oldest = keys[0] + "-01T00:00:00.000Z";

  const { data: partners } = await raw
    .from("partners")
    .select("created_at")
    .gte("created_at", oldest);
  for (const p of partners ?? []) {
    const key = monthKey(p.created_at as string);
    const b = buckets.get(key);
    if (b) b.partnersCreated += 1;
  }

  const { data: referrals } = await raw
    .from("partner_referrals")
    .select("attributed_at")
    .gte("attributed_at", oldest);
  for (const r of referrals ?? []) {
    const key = monthKey(r.attributed_at as string);
    const b = buckets.get(key);
    if (b) b.referrals += 1;
  }

  const { data: allRefs } = await raw.from("partner_referrals").select("business_id");
  const businessIds = [
    ...new Set((allRefs ?? []).map((r) => r.business_id as string).filter(Boolean)),
  ];
  if (businessIds.length) {
    const { data: payments } = await raw
      .from("platform_subscription_payments")
      .select("amount_paid_cents, paid_at")
      .in("business_id", businessIds)
      .eq("stripe_mode", mode)
      .gte("paid_at", oldest);
    for (const p of payments ?? []) {
      const key = monthKey(p.paid_at as string);
      const b = buckets.get(key);
      if (b) {
        b.revenueGeneratedCents +=
          typeof p.amount_paid_cents === "number" ? p.amount_paid_cents : 0;
      }
    }
  }

  const { data: commissions } = await raw
    .from("partner_commissions")
    .select("amount_cents, earned_at, kind")
    .eq("stripe_mode", mode)
    .eq("kind", "commission")
    .gte("earned_at", oldest);
  for (const c of commissions ?? []) {
    const key = monthKey(c.earned_at as string);
    const b = buckets.get(key);
    if (b) b.commissionsEarnedCents += c.amount_cents as number;
  }

  return keys.map((k) => buckets.get(k)!);
}

export async function loadPartnerTableRows(): Promise<PartnerTableRow[]> {
  const mode = getStripeMode();
  const raw = await createServiceClient();
  const partners = await listPartners("all");
  if (!partners.length) return [];

  const { data: referrals } = await raw
    .from("partner_referrals")
    .select("partner_id, business_id");
  const byPartner = new Map<string, string[]>();
  for (const r of referrals ?? []) {
    const pid = r.partner_id as string;
    const bid = r.business_id as string;
    if (!byPartner.has(pid)) byPartner.set(pid, []);
    byPartner.get(pid)!.push(bid);
  }

  const allBizIds = [...new Set([...(referrals ?? []).map((r) => r.business_id as string)])];
  const bizMap = new Map<
    string,
    { subscription_status: string | null; deleted_at: string | null }
  >();
  const revenueByBiz = new Map<string, number>();
  if (allBizIds.length) {
    const { data: businesses } = await raw
      .from("businesses")
      .select("id, subscription_status, deleted_at")
      .in("id", allBizIds);
    for (const b of businesses ?? []) {
      bizMap.set(b.id as string, {
        subscription_status: b.subscription_status as string | null,
        deleted_at: b.deleted_at as string | null,
      });
    }
    const { data: payments } = await raw
      .from("platform_subscription_payments")
      .select("business_id, amount_paid_cents")
      .in("business_id", allBizIds)
      .eq("stripe_mode", mode);
    for (const p of payments ?? []) {
      const bid = p.business_id as string;
      revenueByBiz.set(
        bid,
        (revenueByBiz.get(bid) ?? 0) +
          (typeof p.amount_paid_cents === "number" ? p.amount_paid_cents : 0)
      );
    }
  }

  const rows: PartnerTableRow[] = [];
  for (const p of partners) {
    const bal = await computePartnerBalance(p.id, mode);
    const bizIds = byPartner.get(p.id) ?? [];
    let activeCustomers = 0;
    let revenueGeneratedCents = 0;
    for (const bid of bizIds) {
      const biz = bizMap.get(bid);
      if (biz && !biz.deleted_at && biz.subscription_status === "active") activeCustomers += 1;
      revenueGeneratedCents += revenueByBiz.get(bid) ?? 0;
    }
    rows.push({
      id: p.id,
      brandName: p.brand_name,
      name: p.name,
      email: p.email,
      status: p.status,
      commissionRatePct: Number(p.commission_rate_pct),
      referralCode: p.referral_code,
      referredCustomers: bizIds.length,
      activeCustomers,
      revenueGeneratedCents,
      commissionEarnedCents: bal.lifetimeEarnedCents,
      amountPaidCents: bal.paidCents,
      currentRecurringCommissionCents: bal.recurringMonthlyEstimateCents,
      payableCents: bal.payableCents,
      openNetCents: bal.openNetCents,
      pendingCents: bal.pendingCents,
    });
  }
  return rows;
}

export type PlatformPartnerDetail = {
  partner: PartnerRow;
  balance: PartnerBalance;
  totalRevenueGeneratedCents: number;
  totalReferredCustomers: number;
  activePayingReferrals: number;
  referrals: PartnerReferralRow[];
  commissions: { rows: PartnerCommissionHistoryRow[]; total: number };
  payouts: PartnerPayoutRow[];
  monthly: MonthlyEarningsBucket[];
};

export async function loadPlatformPartnerDetail(
  partnerId: string
): Promise<PlatformPartnerDetail | null> {
  const mode = getStripeMode();
  const partners = await listPartners("all");
  const partner = partners.find((p) => p.id === partnerId) ?? null;
  if (!partner) {
    const raw = await createServiceClient();
    const { data } = await raw.from("partners").select("*").eq("id", partnerId).maybeSingle();
    if (!data) return null;
    return loadPlatformPartnerDetailFromRow(data as PartnerRow, mode);
  }
  return loadPlatformPartnerDetailFromRow(partner, mode);
}

async function loadPlatformPartnerDetailFromRow(
  partner: PartnerRow,
  mode: "test" | "live"
): Promise<PlatformPartnerDetail> {
  const raw = await createServiceClient();
  const balance = await computePartnerBalance(partner.id, mode);

  const { data: refs } = await raw
    .from("partner_referrals")
    .select("business_id")
    .eq("partner_id", partner.id);
  const businessIds = (refs ?? []).map((r) => r.business_id as string).filter(Boolean);
  const totalReferredCustomers = businessIds.length;

  let activePayingReferrals = 0;
  let totalRevenueGeneratedCents = 0;
  if (businessIds.length) {
    const { data: businesses } = await raw
      .from("businesses")
      .select("id, subscription_status, deleted_at")
      .in("id", businessIds);
    activePayingReferrals = (businesses ?? []).filter(
      (b) => !b.deleted_at && b.subscription_status === "active"
    ).length;
    const { data: payments } = await raw
      .from("platform_subscription_payments")
      .select("amount_paid_cents")
      .in("business_id", businessIds)
      .eq("stripe_mode", mode);
    totalRevenueGeneratedCents = (payments ?? []).reduce(
      (s, p) => s + (typeof p.amount_paid_cents === "number" ? p.amount_paid_cents : 0),
      0
    );
  }

  const [referrals, commissions, payouts, monthly] = await Promise.all([
    loadPartnerReferrals(partner.id, { page: 1, pageSize: 100 }),
    loadPartnerCommissionHistory(partner.id, { page: 1, pageSize: 100 }),
    listPartnerPayouts(partner.id),
    loadPartnerMonthlyEarnings(partner.id, 12),
  ]);

  return {
    partner,
    balance,
    totalRevenueGeneratedCents,
    totalReferredCustomers,
    activePayingReferrals,
    referrals: referrals.rows,
    commissions,
    payouts,
    monthly,
  };
}
