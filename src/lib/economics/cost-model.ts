/**
 * Infrastructure cost model (client-safe, pure).
 *
 * Customer level  → MARGINAL rates, no included quota. "What this customer adds to the bill
 *                    once the platform is past its plan quotas." Sums of customer costs are
 *                    therefore an upper bound on the usage part of the invoice.
 * Platform level  → included quotas applied once to the platform totals, plus fixed fees.
 *
 * Neither number is forced to match a provider invoice; recorded invoices are shown next to
 * them for reconciliation.
 */

import { GB, fixedMonthlyTotal, type CostAssumptions } from "@/lib/economics/assumptions";

export type UsageInput = {
  /** Bytes currently stored (point-in-time; treated as GB-months for a month). */
  storageBytes: number;
  /** Bytes streamed through ShootPortal routes in the month (Supabase origin + Vercel). */
  proxiedBytes: number;
  /** Bytes handed to browsers via signed URLs in the month (Supabase direct, estimated). */
  signedBytes: number;
  /** Image transformation renders requested in the month. */
  imageTransforms: number;
};

export type CostBreakdown = {
  storage: number;
  supabaseEgress: number;
  vercelTransfer: number;
  imageTransforms: number;
  /** storage + supabaseEgress + vercelTransfer + imageTransforms (dollars / month). */
  total: number;
};

export function emptyUsage(): UsageInput {
  return { storageBytes: 0, proxiedBytes: 0, signedBytes: 0, imageTransforms: 0 };
}

export function addUsage(a: UsageInput, b: UsageInput): UsageInput {
  return {
    storageBytes: a.storageBytes + b.storageBytes,
    proxiedBytes: a.proxiedBytes + b.proxiedBytes,
    signedBytes: a.signedBytes + b.signedBytes,
    imageTransforms: a.imageTransforms + b.imageTransforms,
  };
}

/** Split metered egress into Supabase uncached / cached GB. Proxied bytes are always origin reads. */
export function egressSplitGb(u: UsageInput, a: CostAssumptions) {
  const signedGb = u.signedBytes / GB;
  const cachedGb = signedGb * a.signedDeliveryCachedShare;
  const uncachedGb = u.proxiedBytes / GB + signedGb - cachedGb;
  return { uncachedGb, cachedGb, totalGb: uncachedGb + cachedGb, proxiedGb: u.proxiedBytes / GB };
}

/** Marginal monthly cost of one customer's usage (no included quotas). */
export function marginalCost(u: UsageInput, a: CostAssumptions): CostBreakdown {
  const { uncachedGb, cachedGb, proxiedGb } = egressSplitGb(u, a);
  const storage = (u.storageBytes / GB) * a.storagePerGbMonth;
  const supabaseEgress = uncachedGb * a.uncachedEgressPerGb + cachedGb * a.cachedEgressPerGb;
  const vercelTransfer = proxiedGb * a.vercelTransferPerGb;
  const imageTransforms = (u.imageTransforms / 1000) * a.imageTransformsPer1000;
  return {
    storage,
    supabaseEgress,
    vercelTransfer,
    imageTransforms,
    total: storage + supabaseEgress + vercelTransfer + imageTransforms,
  };
}

const over = (used: number, included: number) => Math.max(0, used - included);

/** Platform monthly usage cost after included quotas (applied once), plus fixed fees. */
export function platformCost(u: UsageInput, a: CostAssumptions) {
  const { uncachedGb, cachedGb, proxiedGb } = egressSplitGb(u, a);
  const storageGb = u.storageBytes / GB;
  const storage = over(storageGb, a.storageIncludedGb) * a.storagePerGbMonth;
  const supabaseEgress =
    over(uncachedGb, a.uncachedEgressIncludedGb) * a.uncachedEgressPerGb +
    over(cachedGb, a.cachedEgressIncludedGb) * a.cachedEgressPerGb;
  const vercelTransfer = over(proxiedGb, a.vercelTransferIncludedGb) * a.vercelTransferPerGb;
  const imageTransforms = (over(u.imageTransforms, a.imageTransformsIncluded) / 1000) * a.imageTransformsPer1000;
  const usage = storage + supabaseEgress + vercelTransfer + imageTransforms;
  const fixed = fixedMonthlyTotal(a);
  return {
    storage,
    supabaseEgress,
    vercelTransfer,
    imageTransforms,
    usage,
    fixed,
    total: usage + fixed,
    marginal: marginalCost(u, a),
    gb: { storageGb, uncachedGb, cachedGb, proxiedGb },
  };
}

/**
 * Stripe fees for a subscription, as a monthly equivalent.
 * monthlyChargeCents is the amount of ONE invoice; intervalMonths is 1 or 12.
 */
export function stripeFeesMonthly(invoiceCents: number, intervalMonths: number, a: CostAssumptions): number {
  if (invoiceCents <= 0) return 0;
  const perInvoice = (invoiceCents * (a.stripePercent + a.stripeBillingPercent) + a.stripeFixedCents) / 100;
  return perInvoice / Math.max(1, intervalMonths);
}
