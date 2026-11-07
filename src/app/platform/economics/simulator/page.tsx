import { requireSuperAdminPage } from "@/lib/admin-access";
import { listSavedScenarios, loadEconomicsDataset } from "@/lib/platform-economics";
import { GB, formatPct } from "@/lib/economics/assumptions";
import type { SimBaseline } from "@/lib/economics/simulator";
import { Notice } from "@/components/platform/analytics/ui";
import { PricingSimulator, type ActualSnapshot, type CurrentPlan } from "@/components/platform/economics/pricing-simulator";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  await requireSuperAdminPage();
  const [ds, saved] = await Promise.all([loadEconomicsDataset(), listSavedScenarios().catch(() => null)]);
  const p = ds.platform;
  const a = ds.settings.assumptions;

  // Real-world baseline. Only measured values are passed; missing ones fall back to clearly
  // labelled illustrative defaults inside the simulator.
  const hasStorage = p.storageBytes > 0 && p.avgUtilization != null;
  const baseline: SimBaseline = {
    payingCustomers: p.paying,
    avgUtilization: hasStorage ? +p.avgUtilization!.toFixed(4) : null,
    downloadRatio: p.downloadRatio != null && p.egressBytes > 0 ? +p.downloadRatio.toFixed(4) : null,
    proxiedShare: p.proxiedShare != null ? +p.proxiedShare.toFixed(3) : null,
    annualShare: p.paying > 0 ? +(p.annualShare ?? 0).toFixed(3) : null,
  };

  const currentPlans: CurrentPlan[] = ds.plans
    .filter((pl) => pl.isActive && pl.monthlyCents != null)
    .map((pl) => ({
      name: pl.name,
      monthlyPrice: (pl.monthlyCents ?? 0) / 100,
      annualMonthlyPrice: pl.annualMonthlyCents != null ? pl.annualMonthlyCents / 100 : null,
      storageGb: pl.storageGb ?? 0,
    }));

  const totalCost = p.cost.total + p.stripeFees;
  const actual: ActualSnapshot | null =
    p.paying > 0 || p.storageBytes > 0
      ? {
          customers: p.paying,
          mrr: p.mrr,
          storageGb: p.storageBytes / GB,
          downloadGb: p.egressBytes / GB,
          storageCost: p.cost.storage,
          bandwidthCost: p.cost.supabaseEgress + p.cost.vercelTransfer,
          stripeFees: p.stripeFees,
          fixedCost: p.cost.fixed,
          totalCost,
          contribution: p.mrr - totalCost,
          margin: p.mrr > 0 ? (p.mrr - totalCost) / p.mrr : null,
          revenuePerCustomer: p.paying ? p.mrr / p.paying : 0,
          costPerCustomer: p.paying ? totalCost / p.paying : 0,
          costToRevenue: p.mrr > 0 ? totalCost / p.mrr : null,
          allowanceGb: p.allowanceBytes / GB,
        }
      : null;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">
        Baseline from today&apos;s {p.live} live businesses:{" "}
        {baseline.avgUtilization != null ? <>average utilization <strong className="text-heading">{formatPct(baseline.avgUtilization, 1)}</strong></> : "no storage measured yet"}
        {" · "}
        {baseline.downloadRatio != null ? (
          <>
            downloads <strong className="text-heading">{baseline.downloadRatio.toFixed(2)}×</strong> stored per month
          </>
        ) : (
          "no download traffic measured yet"
        )}
        {" · "}
        {baseline.annualShare != null ? <>{formatPct(baseline.annualShare)} on annual billing</> : "no paying customers yet"}.
        {p.live < 20 ? " Small sample — treat the baseline as directional." : ""}
      </div>
      {saved === null ? (
        <Notice tone="warn">Saving scenarios needs migration V112. You can still model; open scenarios are kept in this browser.</Notice>
      ) : null}
      <PricingSimulator baseline={baseline} assumptions={a} actual={actual} currentPlans={currentPlans} saved={saved} />
    </div>
  );
}
