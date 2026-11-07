/**
 * Platform Economics math checks. Run: npm run test:platform-economics
 * Pure functions only — no network, no database.
 */
import assert from "node:assert/strict";
import { DEFAULT_COST_ASSUMPTIONS as A, GB, parseCostAssumptions } from "../src/lib/economics/assumptions";
import { marginalCost, platformCost, stripeFeesMonthly } from "../src/lib/economics/cost-model";
import {
  computeScenario,
  parseScenario,
  presetScenarios,
  splitCustomers,
  stressTests,
  type SimScenario,
} from "../src/lib/economics/simulator";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

console.log("cost model");
check("marginal storage = GB × rate", () => {
  const c = marginalCost({ storageBytes: 100 * GB, proxiedBytes: 0, signedBytes: 0, imageTransforms: 0 }, A);
  close(c.storage, 100 * A.storagePerGbMonth);
  close(c.total, c.storage);
});
check("proxied bytes pay Supabase uncached + Vercel", () => {
  const c = marginalCost({ storageBytes: 0, proxiedBytes: 10 * GB, signedBytes: 0, imageTransforms: 0 }, A);
  close(c.supabaseEgress, 10 * A.uncachedEgressPerGb);
  close(c.vercelTransfer, 10 * A.vercelTransferPerGb);
});
check("signed bytes split by cache-hit share", () => {
  const a = { ...A, signedDeliveryCachedShare: 0.5 };
  const c = marginalCost({ storageBytes: 0, proxiedBytes: 0, signedBytes: 10 * GB, imageTransforms: 0 }, a);
  close(c.supabaseEgress, 5 * a.uncachedEgressPerGb + 5 * a.cachedEgressPerGb);
  close(c.vercelTransfer, 0);
});
check("platform quotas applied once", () => {
  const p = platformCost({ storageBytes: 150 * GB, proxiedBytes: 0, signedBytes: 0, imageTransforms: 0 }, A);
  close(p.storage, 50 * A.storagePerGbMonth);
  close(p.fixed, A.supabaseBaseMonthly + A.supabaseComputeMonthly + A.vercelBaseMonthly + A.otherFixedMonthly);
  const under = platformCost({ storageBytes: 50 * GB, proxiedBytes: 0, signedBytes: 0, imageTransforms: 0 }, A);
  close(under.storage, 0);
});
check("stripe fees normalized for annual", () => {
  const monthly = stripeFeesMonthly(2900, 1, A);
  close(monthly, (2900 * (A.stripePercent + A.stripeBillingPercent) + A.stripeFixedCents) / 100);
  const annual = stripeFeesMonthly(28800, 12, A);
  close(annual, (28800 * (A.stripePercent + A.stripeBillingPercent) + A.stripeFixedCents) / 100 / 12);
});
check("assumptions parser rejects junk", () => {
  const a = parseCostAssumptions({ storagePerGbMonth: -1, uncachedEgressPerGb: "x", signedDeliveryCachedShare: 5, cachedEgressPerGb: 0.04 });
  close(a.storagePerGbMonth, A.storagePerGbMonth);
  close(a.uncachedEgressPerGb, A.uncachedEgressPerGb);
  close(a.signedDeliveryCachedShare, 1);
  close(a.cachedEgressPerGb, 0.04);
});

console.log("simulator");
check("customer split sums exactly", () => {
  for (const [n, w] of [[100, [75, 20, 5]], [7, [1, 1, 1]], [1000, [33, 33, 34]], [3, [0, 0]]] as [number, number[]][]) {
    assert.equal(splitCustomers(n, w).reduce((a, b) => a + b, 0), n);
  }
  assert.deepEqual(splitCustomers(100, [75, 20, 5]), [75, 20, 5]);
});

const base: SimScenario = {
  id: "s",
  name: "Test",
  customers: 100,
  proxiedShare: 0,
  heavyShare: 0,
  heavyMultiplier: 3,
  usageMultiplier: 1,
  costMultiplier: 1,
  applyIncluded: false,
  includeFixed: false,
  includeStripe: false,
  tiers: [{ id: "a", name: "Pro", monthlyPrice: 29, annualMonthlyPrice: null, annualShare: 0, storageGb: 500, mix: 1, utilization: 0.2, downloadRatio: 1 }],
};

check("single tier hand calculation", () => {
  const r = computeScenario(base, A);
  // 100 customers × 100 GB stored, 100 GB downloaded each, all uncached signed delivery.
  close(r.mrr, 2900);
  close(r.storageGb, 10_000);
  close(r.downloadGb, 10_000);
  close(r.storageCost, 10_000 * A.storagePerGbMonth);
  close(r.bandwidthCost, 10_000 * A.uncachedEgressPerGb);
  close(r.contribution, r.mrr - r.storageCost - r.bandwidthCost);
});
check("tier totals reconcile to scenario totals", () => {
  for (const s of presetScenarios({ payingCustomers: 0, avgUtilization: 0.3, downloadRatio: 2, proxiedShare: 0.4, annualShare: 0.25 }, 250)) {
    const r = computeScenario(s, A);
    const sum = (k: "revenue" | "totalCost" | "contribution" | "storageCost" | "bandwidthCost") => r.tiers.reduce((a, t) => a + t[k], 0);
    close(sum("revenue"), r.mrr, 1e-6);
    close(sum("totalCost"), r.totalCost, 1e-6);
    close(sum("contribution"), r.contribution, 1e-6);
    close(r.contribution, r.mrr - r.totalCost, 1e-6);
    assert.equal(r.tiers.reduce((a, t) => a + t.customers, 0), 250);
  }
});
check("annual share blends price", () => {
  const s = { ...base, tiers: [{ ...base.tiers[0]!, annualMonthlyPrice: 24, annualShare: 0.5 }] };
  close(computeScenario(s, A).mrr, 100 * (0.5 * 24 + 0.5 * 29));
});
check("storage capped at allowance, downloads not", () => {
  const s = { ...base, usageMultiplier: 10 };
  const r = computeScenario(s, A);
  close(r.storageGb, 100 * 500);
  close(r.downloadGb, 100 * 500 * 0.2 * 10);
});
check("break-even utilization makes contribution zero", () => {
  const r = computeScenario(base, A);
  const be = r.tiers[0]!.breakEvenUtilization!;
  const atBe = computeScenario({ ...base, tiers: [{ ...base.tiers[0]!, utilization: Math.min(1, be) }] }, A);
  if (be <= 1) close(atBe.contribution, 0, 1e-6);
  else assert.ok(atBe.contribution > 0);
});
check("included quotas only ever reduce cost", () => {
  const without = computeScenario({ ...base, customers: 3 }, A);
  const withQ = computeScenario({ ...base, customers: 3, applyIncluded: true }, A);
  assert.ok(withQ.totalCost <= without.totalCost + 1e-9);
  assert.ok(withQ.includedSavings >= 0);
});
check("fixed costs counted once", () => {
  const r = computeScenario({ ...base, includeFixed: true }, A);
  close(r.tiers.reduce((a, t) => a + t.fixedCost, 0), r.fixedCost);
});
check("stress tests: usage ×2 and worst case cost more", () => {
  const cases = stressTests(base, A);
  const get = (k: string) => cases.find((c) => c.key === k)!.result;
  assert.ok(get("usage2x").totalCost > get("base").totalCost);
  assert.ok(get("worst").totalCost >= get("full").totalCost);
});
check("parseScenario clamps and survives junk", () => {
  assert.equal(parseScenario(null), null);
  assert.equal(parseScenario({ tiers: [] }), null);
  const s = parseScenario({ name: "x", customers: -5, tiers: [{ utilization: 9, monthlyPrice: "a" }] })!;
  assert.equal(s.customers, 0);
  close(s.tiers[0]!.utilization, 1);
  close(s.tiers[0]!.monthlyPrice, 29);
});

console.log(`\n${passed} checks passed`);
