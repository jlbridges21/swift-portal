/**
 * Storage Pricing Simulator — pure financial model (client-safe).
 *
 * ANALYSIS ONLY. Nothing here reads or writes plans, prices, subscriptions or Stripe.
 *
 * Model per tier (all money in dollars / month):
 *   customers      = scenario.customers × normalized mix (largest-remainder integer split)
 *   revenue/cust   = annualShare × annualMonthlyPrice + (1 − annualShare) × monthlyPrice
 *   stored GB/cust = allowance × min(1, utilization × usageMultiplier × heavyFactor)
 *   downloads/cust = allowance × utilization × downloadRatio × usageMultiplier × heavyFactor
 *                    (bandwidth is not capped by the allowance)
 *   heavy users    = heavyShare of each tier use heavyMultiplier × the normal pattern
 *
 * Costs: marginal unit rates × costMultiplier. When applyIncluded is on, the provider's
 * included quotas are subtracted ONCE from platform totals, and the saving is spread over the
 * tiers in proportion to their usage of that resource. Fixed costs (if included) are split by
 * customer count. Stripe fees use each invoice's amount. The result is a CONTRIBUTION, never
 * "net profit": payroll, marketing, support, taxes etc. are outside the model.
 */

import { DEFAULT_COST_ASSUMPTIONS, fixedMonthlyTotal, type CostAssumptions } from "@/lib/economics/assumptions";

export type SimTier = {
  id: string;
  name: string;
  /** Price billed monthly ($/month). */
  monthlyPrice: number;
  /** Monthly-equivalent price when billed annually ($/month); null = no annual option. */
  annualMonthlyPrice: number | null;
  /** Share (0–1) of this tier's customers on annual billing. */
  annualShare: number;
  storageGb: number;
  /** Relative weight in the customer mix (normalized across tiers). */
  mix: number;
  /** Average share (0–1) of the allowance actually stored. */
  utilization: number;
  /** Monthly downloads ÷ stored data (1 = every stored byte downloaded once a month). */
  downloadRatio: number;
};

export type SimScenario = {
  id: string;
  name: string;
  customers: number;
  tiers: SimTier[];
  /** Share (0–1) of downloads streamed through ShootPortal (adds Vercel transfer). */
  proxiedShare: number;
  heavyShare: number;
  heavyMultiplier: number;
  usageMultiplier: number;
  costMultiplier: number;
  applyIncluded: boolean;
  includeFixed: boolean;
  includeStripe: boolean;
  /** Overrides of the platform's saved cost assumptions, for this scenario only. */
  assumptions?: Partial<CostAssumptions>;
};

export type TierResult = {
  id: string;
  name: string;
  customers: number;
  revenue: number;
  storageGb: number;
  downloadGb: number;
  storageCost: number;
  bandwidthCost: number;
  stripeFees: number;
  fixedCost: number;
  totalCost: number;
  contribution: number;
  margin: number | null;
  revenuePerCustomer: number;
  costPerCustomer: number;
  /** Max average utilization (0–1+) before an average customer of this tier stops contributing. */
  breakEvenUtilization: number | null;
  /** Max monthly downloads (GB) per customer at the modeled storage before contribution hits 0. */
  breakEvenDownloadGb: number | null;
};

export type ScenarioResult = {
  tiers: TierResult[];
  customers: number;
  mrr: number;
  arr: number;
  storageGb: number;
  downloadGb: number;
  storageCost: number;
  bandwidthCost: number;
  stripeFees: number;
  fixedCost: number;
  totalCost: number;
  contribution: number;
  margin: number | null;
  revenuePerCustomer: number;
  costPerCustomer: number;
  costToRevenue: number | null;
  allowanceGb: number;
  /** Platform-level quota savings applied (dollars), when applyIncluded is on. */
  includedSavings: number;
};

export function resolveAssumptions(s: SimScenario, base: CostAssumptions): CostAssumptions {
  return { ...base, ...(s.assumptions ?? {}) };
}

/** Largest-remainder split of `total` customers by weights (sums exactly to total). */
export function splitCustomers(total: number, weights: number[]): number[] {
  const n = Math.max(0, Math.round(total));
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (!weights.length) return [];
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? n : 0));
  const exact = weights.map((w) => (Math.max(0, w) / sum) * n);
  const floors = exact.map(Math.floor);
  let left = n - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left -= 1;
  }
  return floors;
}

/** $/GB of downloads, blended over cache hits and proxied delivery. */
export function blendedEgressRate(s: SimScenario, a: CostAssumptions): number {
  const direct = (1 - a.signedDeliveryCachedShare) * a.uncachedEgressPerGb + a.signedDeliveryCachedShare * a.cachedEgressPerGb;
  const proxied = a.uncachedEgressPerGb + a.vercelTransferPerGb;
  return s.costMultiplier * ((1 - s.proxiedShare) * direct + s.proxiedShare * proxied);
}

function tierRevenuePerCustomer(t: SimTier) {
  const annual = t.annualMonthlyPrice ?? t.monthlyPrice;
  const share = t.annualMonthlyPrice == null ? 0 : clamp01(t.annualShare);
  return share * annual + (1 - share) * t.monthlyPrice;
}

function tierStripePerCustomer(t: SimTier, a: CostAssumptions) {
  const pct = a.stripePercent + a.stripeBillingPercent;
  const fixed = a.stripeFixedCents / 100;
  const monthlyFee = t.monthlyPrice > 0 ? t.monthlyPrice * pct + fixed : 0;
  const annual = t.annualMonthlyPrice ?? t.monthlyPrice;
  const annualFee = annual > 0 ? (annual * 12 * pct + fixed) / 12 : 0;
  const share = t.annualMonthlyPrice == null ? 0 : clamp01(t.annualShare);
  return share * annualFee + (1 - share) * monthlyFee;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

function perCustomerUsage(t: SimTier, s: SimScenario) {
  const heavy = clamp01(s.heavyShare);
  const hm = Math.max(0, s.heavyMultiplier);
  const um = Math.max(0, s.usageMultiplier);
  const normalUtil = Math.min(1, t.utilization * um);
  const heavyUtil = Math.min(1, t.utilization * um * hm);
  const storageGb = t.storageGb * ((1 - heavy) * normalUtil + heavy * heavyUtil);
  const downloadGb = t.storageGb * t.utilization * t.downloadRatio * um * ((1 - heavy) + heavy * hm);
  return { storageGb, downloadGb };
}

export function computeScenario(s: SimScenario, base: CostAssumptions = DEFAULT_COST_ASSUMPTIONS): ScenarioResult {
  const a = resolveAssumptions(s, base);
  const cm = Math.max(0, s.costMultiplier);
  const counts = splitCustomers(s.customers, s.tiers.map((t) => t.mix));
  const egressRate = blendedEgressRate(s, a);

  const raw = s.tiers.map((t, i) => {
    const n = counts[i] ?? 0;
    const u = perCustomerUsage(t, s);
    const storageGb = u.storageGb * n;
    const downloadGb = u.downloadGb * n;
    return {
      t,
      n,
      revenue: tierRevenuePerCustomer(t) * n,
      storageGb,
      downloadGb,
      storageCost: storageGb * a.storagePerGbMonth * cm,
      bandwidthCost: downloadGb * egressRate,
      stripeFees: s.includeStripe ? tierStripePerCustomer(t, a) * n : 0,
    };
  });

  const totStorageGb = sum(raw.map((r) => r.storageGb));
  const totDownloadGb = sum(raw.map((r) => r.downloadGb));
  const marginalStorage = sum(raw.map((r) => r.storageCost));
  const marginalBandwidth = sum(raw.map((r) => r.bandwidthCost));

  // Included quotas: applied once to platform totals, spread back by usage.
  let storageFactor = 1;
  let bandwidthFactor = 1;
  if (s.applyIncluded) {
    const billableStorage = Math.max(0, totStorageGb - a.storageIncludedGb) * a.storagePerGbMonth * cm;
    storageFactor = marginalStorage > 0 ? billableStorage / marginalStorage : 1;
    const proxiedGb = totDownloadGb * clamp01(s.proxiedShare);
    const directGb = totDownloadGb - proxiedGb;
    const cachedGb = directGb * a.signedDeliveryCachedShare;
    const uncachedGb = directGb - cachedGb + proxiedGb;
    const billableBandwidth =
      cm *
      (Math.max(0, uncachedGb - a.uncachedEgressIncludedGb) * a.uncachedEgressPerGb +
        Math.max(0, cachedGb - a.cachedEgressIncludedGb) * a.cachedEgressPerGb +
        Math.max(0, proxiedGb - a.vercelTransferIncludedGb) * a.vercelTransferPerGb);
    bandwidthFactor = marginalBandwidth > 0 ? billableBandwidth / marginalBandwidth : 1;
  }

  const fixedTotal = s.includeFixed ? fixedMonthlyTotal(a) : 0;
  const totalCustomers = sum(raw.map((r) => r.n));

  const tiers: TierResult[] = raw.map((r) => {
    const storageCost = r.storageCost * storageFactor;
    const bandwidthCost = r.bandwidthCost * bandwidthFactor;
    const fixedCost = totalCustomers > 0 ? (fixedTotal * r.n) / totalCustomers : 0;
    const totalCost = storageCost + bandwidthCost + r.stripeFees + fixedCost;
    const contribution = r.revenue - totalCost;

    // Break-even for an average (non-heavy) customer at marginal rates, no quotas, no fixed share.
    const price = tierRevenuePerCustomer(r.t);
    const net = price - (s.includeStripe ? tierStripePerCustomer(r.t, a) : 0);
    const perStoredGb = a.storagePerGbMonth * cm + r.t.downloadRatio * egressRate;
    const breakEvenGb = perStoredGb > 0 ? net / perStoredGb : null;
    const usage = perCustomerUsage(r.t, { ...s, heavyShare: 0 });
    const breakEvenDownloadGb =
      egressRate > 0 ? Math.max(0, (net - usage.storageGb * a.storagePerGbMonth * cm) / egressRate) : null;

    return {
      id: r.t.id,
      name: r.t.name,
      customers: r.n,
      revenue: r.revenue,
      storageGb: r.storageGb,
      downloadGb: r.downloadGb,
      storageCost,
      bandwidthCost,
      stripeFees: r.stripeFees,
      fixedCost,
      totalCost,
      contribution,
      margin: r.revenue > 0 ? contribution / r.revenue : null,
      revenuePerCustomer: r.n ? r.revenue / r.n : price,
      costPerCustomer: r.n ? totalCost / r.n : 0,
      breakEvenUtilization: breakEvenGb != null && r.t.storageGb > 0 ? breakEvenGb / r.t.storageGb : null,
      breakEvenDownloadGb,
    };
  });

  const mrr = sum(tiers.map((t) => t.revenue));
  const storageCost = sum(tiers.map((t) => t.storageCost));
  const bandwidthCost = sum(tiers.map((t) => t.bandwidthCost));
  const stripeFees = sum(tiers.map((t) => t.stripeFees));
  const totalCost = storageCost + bandwidthCost + stripeFees + fixedTotal * (totalCustomers > 0 ? 1 : 0);
  const contribution = mrr - totalCost;

  return {
    tiers,
    customers: totalCustomers,
    mrr,
    arr: mrr * 12,
    storageGb: totStorageGb,
    downloadGb: totDownloadGb,
    storageCost,
    bandwidthCost,
    stripeFees,
    fixedCost: totalCustomers > 0 ? fixedTotal : 0,
    totalCost,
    contribution,
    margin: mrr > 0 ? contribution / mrr : null,
    revenuePerCustomer: totalCustomers ? mrr / totalCustomers : 0,
    costPerCustomer: totalCustomers ? totalCost / totalCustomers : 0,
    costToRevenue: mrr > 0 ? totalCost / mrr : null,
    allowanceGb: sum(tiers.map((t, i) => t.customers * (s.tiers[i]?.storageGb ?? 0))),
    includedSavings: marginalStorage + marginalBandwidth - storageCost - bandwidthCost,
  };
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Stress tests and sweeps
// ---------------------------------------------------------------------------

export type StressCase = { key: string; label: string; detail: string; result: ScenarioResult };

export function stressTests(s: SimScenario, base: CostAssumptions): StressCase[] {
  const run = (patch: Partial<SimScenario>, tierPatch?: Partial<SimTier>) =>
    computeScenario({ ...s, ...patch, tiers: s.tiers.map((t) => ({ ...t, ...(tierPatch ?? {}) })) }, base);
  return [
    { key: "base", label: "As modeled", detail: "Your current inputs", result: computeScenario(s, base) },
    { key: "usage2x", label: "Usage doubles", detail: "Storage (capped at allowance) and downloads ×2", result: run({ usageMultiplier: s.usageMultiplier * 2 }) },
    { key: "full", label: "Everyone fills their allowance", detail: "100% utilization on every tier", result: run({}, { utilization: 1 }) },
    {
      key: "downloads5x",
      label: "Download surge",
      detail: "Downloads ×5 at the same storage",
      result: computeScenario({ ...s, tiers: s.tiers.map((t) => ({ ...t, downloadRatio: t.downloadRatio * 5 })) }, base),
    },
    { key: "costs50", label: "Provider prices +50%", detail: "Every unit rate ×1.5", result: run({ costMultiplier: s.costMultiplier * 1.5 }) },
    { key: "heavy", label: "Heavy-user cohort", detail: "10% of customers at 5× usage", result: run({ heavyShare: 0.1, heavyMultiplier: 5 }) },
    {
      key: "worst",
      label: "Worst case",
      detail: "100% utilization, downloads ×3, prices +50%, no quotas",
      result: computeScenario(
        {
          ...s,
          costMultiplier: s.costMultiplier * 1.5,
          applyIncluded: false,
          tiers: s.tiers.map((t) => ({ ...t, utilization: 1, downloadRatio: t.downloadRatio * 3 })),
        },
        base
      ),
    },
  ];
}

/** Contribution margin as the customer count grows. */
export function growthSweep(s: SimScenario, base: CostAssumptions, counts: number[]) {
  return counts.map((n) => ({ customers: n, result: computeScenario({ ...s, customers: n }, base) }));
}

/** Contribution as every tier's utilization moves from 0% to 100%. */
export function utilizationSweep(s: SimScenario, base: CostAssumptions, steps = 10) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const util = i / steps;
    return {
      utilization: util,
      result: computeScenario({ ...s, tiers: s.tiers.map((t) => ({ ...t, utilization: util })) }, base),
    };
  });
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export type SimBaseline = {
  /** Paying businesses today (active / past_due, not comped). */
  payingCustomers: number;
  /** Mean storage utilization of live businesses with an allowance (0–1), or null. */
  avgUtilization: number | null;
  /** Trailing-30-day downloads ÷ stored bytes, or null when not measurable yet. */
  downloadRatio: number | null;
  /** Share of measured egress that was streamed through ShootPortal routes, or null. */
  proxiedShare: number | null;
  /** Share of paying businesses billed annually, or null. */
  annualShare: number | null;
};

export const ILLUSTRATIVE = {
  utilization: 0.2,
  downloadRatio: 1,
  proxiedShare: 0.5,
  annualShare: 0.2,
} as const;

export function uid(prefix = "t"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function baseScenario(name: string, b: SimBaseline, tiers: Omit<SimTier, "id" | "utilization" | "downloadRatio" | "annualShare">[], customers: number): SimScenario {
  return {
    id: uid("s"),
    name,
    customers,
    proxiedShare: b.proxiedShare ?? ILLUSTRATIVE.proxiedShare,
    heavyShare: 0,
    heavyMultiplier: 3,
    usageMultiplier: 1,
    costMultiplier: 1,
    applyIncluded: true,
    includeFixed: true,
    includeStripe: true,
    tiers: tiers.map((t) => ({
      ...t,
      id: uid(),
      utilization: b.avgUtilization ?? ILLUSTRATIVE.utilization,
      downloadRatio: b.downloadRatio ?? ILLUSTRATIVE.downloadRatio,
      annualShare: b.annualShare ?? ILLUSTRATIVE.annualShare,
    })),
  };
}

export function presetScenarios(b: SimBaseline, customers = 100): SimScenario[] {
  return [
    baseScenario(
      "Two tiers",
      b,
      [
        { name: "Pro", monthlyPrice: 29, annualMonthlyPrice: 24, storageGb: 500, mix: 85 },
        { name: "Pro Plus", monthlyPrice: 99, annualMonthlyPrice: 82, storageGb: 2048, mix: 15 },
      ],
      customers
    ),
    baseScenario(
      "Three tiers",
      b,
      [
        { name: "Pro", monthlyPrice: 29, annualMonthlyPrice: 24, storageGb: 500, mix: 75 },
        { name: "Growth", monthlyPrice: 59, annualMonthlyPrice: 49, storageGb: 1024, mix: 20 },
        { name: "Pro Plus", monthlyPrice: 99, annualMonthlyPrice: 82, storageGb: 2048, mix: 5 },
      ],
      customers
    ),
  ];
}

/** Sanitize a scenario loaded from JSON (saved scenarios, URL, etc.). */
export function parseScenario(raw: unknown): SimScenario | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown, d: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
  const tiersRaw = Array.isArray(o.tiers) ? o.tiers : [];
  const tiers: SimTier[] = tiersRaw.slice(0, 8).flatMap((t) => {
    if (!t || typeof t !== "object") return [];
    const x = t as Record<string, unknown>;
    return [
      {
        id: typeof x.id === "string" ? x.id.slice(0, 40) : uid(),
        name: typeof x.name === "string" && x.name.trim() ? x.name.trim().slice(0, 40) : "Tier",
        monthlyPrice: num(x.monthlyPrice, 29, 0, 100000),
        annualMonthlyPrice: x.annualMonthlyPrice === null ? null : num(x.annualMonthlyPrice, 24, 0, 100000),
        annualShare: num(x.annualShare, 0.2, 0, 1),
        storageGb: num(x.storageGb, 500, 0, 1_000_000),
        mix: num(x.mix, 1, 0, 1_000_000),
        utilization: num(x.utilization, 0.2, 0, 1),
        downloadRatio: num(x.downloadRatio, 1, 0, 1000),
      },
    ];
  });
  if (!tiers.length) return null;
  const assumptions: Partial<CostAssumptions> = {};
  if (o.assumptions && typeof o.assumptions === "object") {
    for (const [k, v] of Object.entries(o.assumptions as Record<string, unknown>)) {
      if (k in DEFAULT_COST_ASSUMPTIONS && k !== "pricesVerifiedOn" && typeof v === "number" && Number.isFinite(v) && v >= 0) {
        (assumptions as Record<string, number>)[k] = v;
      }
    }
  }
  return {
    id: typeof o.id === "string" ? o.id.slice(0, 60) : uid("s"),
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 120) : "Scenario",
    customers: Math.round(num(o.customers, 100, 0, 1_000_000)),
    tiers,
    proxiedShare: num(o.proxiedShare, 0.5, 0, 1),
    heavyShare: num(o.heavyShare, 0, 0, 1),
    heavyMultiplier: num(o.heavyMultiplier, 3, 0, 100),
    usageMultiplier: num(o.usageMultiplier, 1, 0, 100),
    costMultiplier: num(o.costMultiplier, 1, 0, 100),
    applyIncluded: o.applyIncluded !== false,
    includeFixed: o.includeFixed !== false,
    includeStripe: o.includeStripe !== false,
    assumptions,
  };
}
