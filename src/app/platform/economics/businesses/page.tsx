import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadEconomicsDataset } from "@/lib/platform-economics";
import { formatBytes, formatPct, formatUsd } from "@/lib/economics/assumptions";
import { Panel } from "@/components/platform/analytics/ui";
import { BarList } from "@/components/platform/analytics/charts";
import { DataStatus } from "@/components/platform/economics/data-status";
import { BusinessComparison } from "@/components/platform/economics/business-comparison";
import { SourceTag, marginTone } from "@/components/platform/economics/ui";

export const dynamic = "force-dynamic";

export default async function BusinessEconomicsPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  await requireSuperAdminPage();
  const { focus } = await searchParams;
  const ds = await loadEconomicsDataset();
  const live = ds.rows.filter((r) => r.status === "active" && !r.deleted);

  const byPlan = new Map<string, { name: string; n: number; paying: number; mrr: number; cost: number; stripe: number; storage: number; allowanceGb: number | null }>();
  for (const r of live) {
    const cur = byPlan.get(r.plan) ?? { name: r.planName, n: 0, paying: 0, mrr: 0, cost: 0, stripe: 0, storage: 0, allowanceGb: r.allowanceGb };
    cur.n += 1;
    cur.paying += r.isPaying ? 1 : 0;
    cur.mrr += r.mrr;
    cur.cost += r.cost.total;
    cur.stripe += r.stripeFees;
    cur.storage += r.storageBytes;
    byPlan.set(r.plan, cur);
  }

  const topStorage = [...live].sort((a, b) => b.storageBytes - a.storageBytes).slice(0, 5);
  const topBandwidth = [...live].sort((a, b) => b.monthlyEgressBytes - a.monthlyEgressBytes).filter((r) => r.monthlyEgressBytes > 0).slice(0, 5);

  return (
    <div className="space-y-6">
      <DataStatus
        migrated={ds.settings.migrated}
        source={ds.snapshot.source}
        computedAt={ds.snapshot.computedAt}
        trackingStartedAt={ds.settings.trackingStartedAt}
        meteredDays={ds.egressWindow.meteredDays}
        windowDays={ds.egressWindow.windowDays}
      />

      <Panel
        title="Plan profitability"
        description="Live businesses grouped by their current plan. Revenue counts paying businesses only; costs count everyone on the plan (trials and comps cost money too)."
        actions={<SourceTag kind="estimated" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">Businesses</th>
                <th className="py-2 pr-3 font-medium">Paying</th>
                <th className="py-2 pr-3 font-medium">MRR</th>
                <th className="py-2 pr-3 font-medium">Avg stored</th>
                <th className="py-2 pr-3 font-medium">Infra / mo</th>
                <th className="py-2 pr-3 font-medium">Stripe fees</th>
                <th className="py-2 pr-3 font-medium">Contribution</th>
                <th className="py-2 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {[...byPlan.entries()].map(([key, v]) => {
                const contribution = v.mrr - v.cost - v.stripe;
                const margin = v.mrr > 0 ? contribution / v.mrr : null;
                return (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-medium text-heading">
                      {v.name}
                      <span className="ml-1.5 text-xs text-muted">{v.allowanceGb != null ? `${v.allowanceGb} GB` : "no limit"}</span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{v.n}</td>
                    <td className="py-2 pr-3 tabular-nums">{v.paying}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatUsd(v.mrr)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatBytes(v.n ? v.storage / v.n : 0)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatUsd(v.cost)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatUsd(v.stripe)}</td>
                    <td className={`py-2 pr-3 tabular-nums ${marginTone(margin)}`}>{formatUsd(contribution)}</td>
                    <td className={`py-2 tabular-nums font-medium ${marginTone(margin)}`}>{formatPct(margin, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Highest storage" description="Measured bytes stored.">
          <BarList
            type="decimal"
            metric="GB stored"
            empty="No storage yet."
            rows={topStorage.map((r) => ({ key: r.id, label: r.name, value: +(r.storageBytes / 1024 ** 3).toFixed(2), sub: "GB", color: "#4F46E5" }))}
          />
        </Panel>
        <Panel title="Highest bandwidth" description={`Delivered in the last ${ds.egressWindow.windowDays} days.`}>
          <BarList
            type="decimal"
            metric="GB delivered"
            empty="No download traffic recorded yet."
            rows={topBandwidth.map((r) => ({ key: r.id, label: r.name, value: +(r.monthlyEgressBytes / 1024 ** 3).toFixed(2), sub: "GB", color: "#0EA5E9" }))}
          />
        </Panel>
      </div>

      <Panel title="Compare businesses" description="Search, filter and sort. Click any row for the full breakdown and history.">
        <BusinessComparison rows={ds.rows} windowDays={ds.egressWindow.windowDays} initialFocus={focus ?? null} />
      </Panel>
    </div>
  );
}
