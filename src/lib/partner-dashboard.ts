/**
 * Partner dashboard data (phase 4) — read-only views over the phase-3 ledger.
 * Every money figure comes from computePartnerBalance / partner_commissions rows.
 * Never accept partner_id from the client; always resolve from the signed-in user.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getStripeMode } from "@/lib/stripe";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import {
  computePartnerBalance,
  PARTNER_COMMISSION_HOLD_DAYS,
  type PartnerBalance,
  type PartnerCommissionRow,
} from "@/lib/partner-commissions";
import {
  getActivePartnerByUserId,
  getPartnerByUserId,
  type PartnerRow,
} from "@/lib/partners";
import { listActivePlans, type PlanRow } from "@/lib/entitlements";

export { PARTNER_COMMISSION_HOLD_DAYS };

export type PartnerAccess =
  | { kind: "none" }
  | { kind: "suspended"; partner: PartnerRow }
  | { kind: "active"; partner: PartnerRow };

/** Resolve partner for the signed-in user. Never takes a client partner_id. */
export async function resolvePartnerAccess(userId: string): Promise<PartnerAccess> {
  const active = await getActivePartnerByUserId(userId);
  if (active) return { kind: "active", partner: active };
  const any = await getPartnerByUserId(userId);
  if (any?.status === "suspended") return { kind: "suspended", partner: any };
  return { kind: "none" };
}

export function partnerReferralLink(referralCode: string): string {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  return `${apex}/?ref=${encodeURIComponent(referralCode)}`;
}

export type PartnerReferralRow = {
  businessId: string;
  displayName: string;
  joinedAt: string;
  status: string;
  plan: string;
  revenueGeneratedCents: number;
  commissionEarnedCents: number;
  isGeneratingRecurring: boolean;
};

export type PartnerCommissionHistoryRow = {
  id: string;
  earnedAt: string;
  kind: string;
  businessId: string | null;
  businessName: string | null;
  sourceAmountCents: number;
  commissionRatePct: number;
  amountCents: number;
  status: "pending" | "payable" | "paid" | "reversal" | "adjustment";
  reversesCommissionId: string | null;
  payableAt: string | null;
};

export type MonthlyEarningsBucket = {
  month: string; // YYYY-MM
  label: string;
  earnedCents: number;
  reversedCents: number;
  netCents: number;
};

export type PartnerDashboardSummary = {
  partner: {
    id: string;
    name: string;
    brandName: string;
    referralCode: string;
    commissionRatePct: number;
    status: string;
  };
  referralLink: string;
  holdDays: number;
  balance: PartnerBalance;
  /** Count of partner_referrals rows. */
  totalReferredCustomers: number;
  /** Referred businesses with subscription_status = active. */
  activePayingReferrals: number;
  /** Sum of platform_subscription_payments.amount_paid for referred businesses (deploy mode). */
  totalRevenueGeneratedCents: number;
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

export async function loadPartnerDashboardSummary(
  partner: PartnerRow
): Promise<PartnerDashboardSummary> {
  const mode = getStripeMode();
  const balance = await computePartnerBalance(partner.id, mode);
  const raw = await createServiceClient();

  const { data: referrals } = await raw
    .from("partner_referrals")
    .select("business_id")
    .eq("partner_id", partner.id);
  const businessIds = (referrals ?? []).map((r) => r.business_id as string).filter(Boolean);
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

  return {
    partner: {
      id: partner.id,
      name: partner.name,
      brandName: partner.brand_name,
      referralCode: partner.referral_code,
      commissionRatePct: Number(partner.commission_rate_pct),
      status: partner.status,
    },
    referralLink: partnerReferralLink(partner.referral_code),
    holdDays: PARTNER_COMMISSION_HOLD_DAYS,
    balance,
    totalReferredCustomers,
    activePayingReferrals,
    totalRevenueGeneratedCents,
  };
}

export async function loadPartnerReferrals(
  partnerId: string,
  options?: {
    sort?: string;
    dir?: "asc" | "desc";
    page?: number;
    pageSize?: number;
  }
): Promise<{ rows: PartnerReferralRow[]; total: number }> {
  const mode = getStripeMode();
  const raw = await createServiceClient();
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 10));

  const { data: referrals } = await raw
    .from("partner_referrals")
    .select("business_id, attributed_at")
    .eq("partner_id", partnerId)
    .order("attributed_at", { ascending: false });

  const list = referrals ?? [];
  if (!list.length) return { rows: [], total: 0 };

  const businessIds = list.map((r) => r.business_id as string);
  const { data: businesses } = await raw
    .from("businesses")
    .select("id, name, plan, subscription_status, deleted_at")
    .in("id", businessIds);
  const bizMap = new Map((businesses ?? []).map((b) => [b.id as string, b]));

  const { data: payments } = await raw
    .from("platform_subscription_payments")
    .select("business_id, amount_paid_cents")
    .in("business_id", businessIds)
    .eq("stripe_mode", mode);
  const revenueByBiz = new Map<string, number>();
  for (const p of payments ?? []) {
    const id = p.business_id as string;
    revenueByBiz.set(
      id,
      (revenueByBiz.get(id) ?? 0) +
        (typeof p.amount_paid_cents === "number" ? p.amount_paid_cents : 0)
    );
  }

  const { data: commissions } = await raw
    .from("partner_commissions")
    .select("business_id, kind, amount_cents, earned_at")
    .eq("partner_id", partnerId)
    .eq("stripe_mode", mode)
    .in("business_id", businessIds);

  const commissionByBiz = new Map<string, number>();
  const latestCommissionByBiz = new Map<string, string>();
  for (const c of commissions ?? []) {
    if (!c.business_id) continue;
    const id = c.business_id as string;
    commissionByBiz.set(
      id,
      (commissionByBiz.get(id) ?? 0) + (typeof c.amount_cents === "number" ? c.amount_cents : 0)
    );
    if (c.kind === "commission") {
      const prev = latestCommissionByBiz.get(id);
      if (!prev || new Date(c.earned_at as string) > new Date(prev)) {
        latestCommissionByBiz.set(id, c.earned_at as string);
      }
    }
  }

  let rows: PartnerReferralRow[] = list.map((r) => {
    const bid = r.business_id as string;
    const biz = bizMap.get(bid);
    const status = biz?.deleted_at
      ? "canceled"
      : ((biz?.subscription_status as string) ?? "unknown");
    const isGeneratingRecurring =
      !biz?.deleted_at && biz?.subscription_status === "active" && latestCommissionByBiz.has(bid);
    return {
      businessId: bid,
      displayName: (biz?.name as string) || "Unknown business",
      joinedAt: r.attributed_at as string,
      status,
      plan: (biz?.plan as string) || "—",
      revenueGeneratedCents: revenueByBiz.get(bid) ?? 0,
      commissionEarnedCents: commissionByBiz.get(bid) ?? 0,
      isGeneratingRecurring,
    };
  });

  const sort = options?.sort ?? "joinedAt";
  const dir = options?.dir === "asc" ? 1 : -1;
  rows = [...rows].sort((a, b) => {
    const av = a[sort as keyof PartnerReferralRow];
    const bv = b[sort as keyof PartnerReferralRow];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total };
}

export async function loadPartnerCommissionHistory(
  partnerId: string,
  options?: { page?: number; pageSize?: number }
): Promise<{ rows: PartnerCommissionHistoryRow[]; total: number }> {
  const mode = getStripeMode();
  const raw = await createServiceClient();
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 20));
  const now = Date.now();

  const { data: all, error, count } = await raw
    .from("partner_commissions")
    .select("*", { count: "exact" })
    .eq("partner_id", partnerId)
    .eq("stripe_mode", mode)
    .order("earned_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);

  const list = (all ?? []) as PartnerCommissionRow[];
  const businessIds = [
    ...new Set(list.map((r) => r.business_id).filter((id): id is string => Boolean(id))),
  ];
  const { data: businesses } = businessIds.length
    ? await raw.from("businesses").select("id, name").in("id", businessIds)
    : { data: [] as { id: string; name: string }[] };
  const nameMap = new Map((businesses ?? []).map((b) => [b.id, b.name]));

  const rows: PartnerCommissionHistoryRow[] = list.map((row) => {
    let status: PartnerCommissionHistoryRow["status"] = "pending";
    if (row.kind === "reversal") status = "reversal";
    else if (row.kind === "adjustment") status = "adjustment";
    else if (row.payout_id) status = "paid";
    else if (row.payable_at && new Date(row.payable_at).getTime() <= now) status = "payable";
    else status = "pending";

    return {
      id: row.id,
      earnedAt: row.earned_at,
      kind: row.kind,
      businessId: row.business_id,
      businessName: row.business_id ? nameMap.get(row.business_id) ?? "Unknown" : null,
      sourceAmountCents: row.source_amount_cents,
      commissionRatePct: Number(row.commission_rate_pct),
      amountCents: row.amount_cents,
      status,
      reversesCommissionId: row.reverses_commission_id,
      payableAt: row.payable_at,
    };
  });

  return { rows, total: count ?? rows.length };
}

/** Monthly buckets from the ledger — commissions and reversals both visible. */
export async function loadPartnerMonthlyEarnings(
  partnerId: string,
  months = 12
): Promise<MonthlyEarningsBucket[]> {
  const mode = getStripeMode();
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_commissions")
    .select("kind, amount_cents, earned_at")
    .eq("partner_id", partnerId)
    .eq("stripe_mode", mode)
    .order("earned_at", { ascending: true });
  if (error) throw new Error(error.message);

  const map = new Map<string, MonthlyEarningsBucket>();
  for (const row of data ?? []) {
    const key = monthKey(row.earned_at as string);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        month: key,
        label: monthLabel(key),
        earnedCents: 0,
        reversedCents: 0,
        netCents: 0,
      };
      map.set(key, bucket);
    }
    const amt = typeof row.amount_cents === "number" ? row.amount_cents : 0;
    if (row.kind === "commission") bucket.earnedCents += amt;
    else if (row.kind === "reversal") bucket.reversedCents += Math.abs(amt);
    bucket.netCents += amt;
  }

  // Ensure last N months exist (zeros) for a stable chart.
  const out: MonthlyEarningsBucket[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push(
      map.get(key) ?? {
        month: key,
        label: monthLabel(key),
        earnedCents: 0,
        reversedCents: 0,
        netCents: 0,
      }
    );
  }
  return out;
}

export async function loadCalculatorPlans(): Promise<
  Array<Pick<PlanRow, "key" | "name" | "price_monthly_cents" | "price_annual_cents">>
> {
  const plans = await listActivePlans();
  return plans
    .filter((p) => p.is_public)
    .map((p) => ({
      key: p.key,
      name: p.name,
      price_monthly_cents: p.price_monthly_cents,
      price_annual_cents: p.price_annual_cents,
    }));
}
