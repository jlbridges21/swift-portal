import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadEconomicsDataset, loadEconomicsHistory, listExpenseEntries } from "@/lib/platform-economics";
import { bytesToGb, formatBytes, formatPct, formatUsd, fixedMonthlyTotal } from "@/lib/economics/assumptions";
import { KpiCard, Notice, Panel } from "@/components/platform/analytics/ui";
import { BarList, TrendChart } from "@/components/platform/analytics/charts";
import { DataStatus } from "@/components/platform/economics/data-status";
import { SourceTag, StatLine, UtilizationBar, marginTone } from "@/components/platform/economics/ui";

export const dynamic = "force-dynamic";

export default async function EconomicsOverviewPage() {
  await requireSuperAdminPage();
  const ds = await loadEconomicsDataset();
  const [history, expenses] = await Promise.all([loadEconomicsHistory(ds.settings, 12), listExpenseEntries().catch(() => null)]);
  const p = ds.platform;
  const a = ds.settings.assumptions;
  const pts = history.points;
  const thisMonth = pts.at(-1);
  const lastMonth = pts.at(-2);

  const infraCost = p.cost.total;
  const costPct = p.mrr > 0 ? (infraCost + p.stripeFees) / p.mrr : null;
  const storageDelta =
    ds.growthBaseline && ds.growthBaseline.total > 0 ? (p.storageBytes - ds.growthBaseline.total) / ds.growthBaseline.total : undefined;

  const lastInvoiceMonth = expenses?.length ? expenses[0]!.month : null;
  const lastInvoiceTotal = lastInvoiceMonth
    ? expenses!.filter((e) => e.month === lastInvoiceMonth).reduce((s, e) => s + e.amountCents, 0) / 100
    : null;

  const paying = ds.rows.filter((r) => r.isPaying);
  const live = ds.rows.filter((r) => r.status === "active" && !r.deleted);
  const expensive = [...live].sort((x, y) => y.cost.total - x.cost.total).slice(0, 6);
  const lowMargin = [...paying].sort((x, y) => (x.margin ?? 0) - (y.margin ?? 0)).slice(0, 6);

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

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Revenue</h2>
          <SourceTag kind="actual" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            accent
            label="MRR"
            value={formatUsd(p.mrr)}
            hint={`${p.paying} paying business${p.paying === 1 ? "" : "es"}`}
            definition="Monthly recurring revenue: each paying (active / past-due, not comped) subscription's Stripe price, annual plans ÷ 12. List price — intro offers and referral discounts show in Collected."
          />
          <KpiCard label="ARR" value={formatUsd(p.arr, { cents: false })} definition="MRR × 12." />
          <KpiCard
            label="Collected this month"
            value={formatUsd(thisMonth?.revenue ?? 0)}
            hint={lastMonth ? `${formatUsd(lastMonth.revenue)} last month` : undefined}
            definition="ShootPortal subscription invoices actually paid this calendar month (UTC), from the platform ledger. Annual invoices land in the month they were paid."
          />
          <KpiCard label="Avg revenue / paying" value={formatUsd(p.avgRevenuePerPaying)} definition="MRR ÷ paying businesses." />
          <KpiCard
            label="Infra + fees % of MRR"
            value={formatPct(costPct, 1)}
            hint="Estimated"
            definition="(Estimated platform infrastructure cost incl. fixed fees + Stripe fees) ÷ MRR."
          />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Storage &amp; bandwidth</h2>
          <SourceTag kind={ds.snapshot.source === "storage_objects" ? "measured" : "estimated"} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Media stored"
            value={formatBytes(p.storageBytes)}
            delta={storageDelta}
            hint={p.unattributedBytes > 0 ? `${formatBytes(p.unattributedBytes)} not tied to a business` : `${ds.snapshot.objectCount.toLocaleString()} objects`}
            definition="Every object in Supabase Storage (all buckets, incl. thumbnails), measured from storage.objects. Delta vs. the snapshot ~30 days ago."
          />
          <KpiCard
            label="Allowance allocated"
            value={formatBytes(p.allowanceBytes)}
            hint={`${live.length} live businesses`}
            definition="Sum of plan storage limits across live (active, not deleted) businesses. This is what customers are allowed to use — not what is billed."
          />
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Allowance consumed</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">{formatPct(p.allocatedUtilization, 1)}</p>
            <UtilizationBar value={p.allocatedUtilization} className="mt-2" />
            <p className="mt-1.5 text-xs text-muted">
              avg {formatPct(p.avgUtilization, 1)} · median {formatPct(p.medianUtilization, 1)} per business
            </p>
          </div>
          <KpiCard
            label={`Downloads (${ds.egressWindow.windowDays}d)`}
            value={formatBytes(p.egressBytes)}
            hint={`${formatBytes(p.proxiedBytes)} via app · ${formatBytes(p.signedBytes)} direct`}
            definition="Media delivered to viewers in the last 30 days: metered bytes streamed through ShootPortal, plus signed full-size originals (estimated), plus — for days before metering — logged downloads × file size. Gallery thumbnails and CDN-cached playback are not visible to ShootPortal."
          />
          <KpiCard
            accent
            label="Est. infrastructure / mo"
            value={formatUsd(infraCost)}
            hint={`${formatUsd(p.cost.usage)} usage + ${formatUsd(p.cost.fixed)} fixed`}
            definition="Platform-level estimate: usage above the provider's included quotas (applied once to the whole platform) × unit prices, plus fixed plan fees."
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Monthly economics"
          description="Contribution = MRR − infrastructure − Stripe fees. This is not net profit: payroll, marketing, support and taxes are outside the model."
          actions={<SourceTag kind="estimated" />}
        >
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <StatLine label="MRR" value={formatUsd(p.mrr)} />
              <StatLine label="Storage (beyond included)" value={`− ${formatUsd(p.cost.storage)}`} hint={`${bytesToGb(p.storageBytes).toFixed(0)} / ${a.storageIncludedGb} GB incl.`} />
              <StatLine label="Supabase egress" value={`− ${formatUsd(p.cost.supabaseEgress)}`} hint={`${p.cost.gb.uncachedGb.toFixed(0)} GB uncached`} />
              <StatLine label="Vercel transfer" value={`− ${formatUsd(p.cost.vercelTransfer)}`} hint={`${p.cost.gb.proxiedGb.toFixed(0)} / ${a.vercelTransferIncludedGb} GB incl.`} />
              <StatLine label="Image transformations" value={`− ${formatUsd(p.cost.imageTransforms)}`} hint={`${p.imageTransforms} renders`} />
              <StatLine label="Stripe fees" value={`− ${formatUsd(p.stripeFees)}`} />
            </div>
            <div>
              <StatLine
                label={<span className="font-medium text-heading">Contribution before fixed costs</span>}
                value={<span className={marginTone(p.mrr ? p.contributionAfterUsage / p.mrr : null)}>{formatUsd(p.contributionAfterUsage)}</span>}
              />
              <StatLine label="Fixed platform costs" value={`− ${formatUsd(fixedMonthlyTotal(a))}`} hint="shared" />
              <StatLine
                label={<span className="font-medium text-heading">Contribution after fixed costs</span>}
                value={<span className={marginTone(p.mrr ? p.contributionAfterFixed / p.mrr : null)}>{formatUsd(p.contributionAfterFixed)}</span>}
                hint={p.mrr ? formatPct(p.contributionAfterFixed / p.mrr) : undefined}
              />
              <StatLine
                label="Sum of per-business marginal costs"
                value={formatUsd(p.marginalCostTotal)}
                hint="no quotas"
              />
              <StatLine
                label="Avg infrastructure / live business"
                value={formatUsd(p.avgCostPerBusiness)}
                hint="marginal"
              />
              <StatLine
                label="Last recorded invoices"
                value={lastInvoiceTotal != null ? formatUsd(lastInvoiceTotal) : "—"}
                hint={lastInvoiceMonth ? lastInvoiceMonth.slice(0, 7) : <Link className="underline" href="/platform/economics/costs">record one</Link>}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Platform-level quotas (e.g. {a.storageIncludedGb} GB storage, {a.uncachedEgressIncludedGb} GB uncached egress) are applied once, so the
            platform estimate is lower than the sum of per-business marginal costs while usage is inside them. Unit prices: Costs &amp;
            Assumptions (verified {a.pricesVerifiedOn}).
          </p>
        </Panel>

        <Panel className="lg:col-span-2" title="Most expensive to serve" description="Marginal infrastructure cost per month.">
          <BarList
            type="money"
            metric="Est. cost / mo"
            empty="No measurable usage yet."
            rows={expensive.map((r) => ({
              key: r.id,
              label: r.name,
              value: Math.round(r.cost.total * 100),
              sub: formatBytes(r.storageBytes),
              color: "#F59E0B",
              details: [
                { label: "Storage", value: Math.round(r.cost.storage * 100), type: "money" },
                { label: "Bandwidth", value: Math.round((r.cost.supabaseEgress + r.cost.vercelTransfer) * 100), type: "money" },
                { label: "MRR", value: Math.round(r.mrr * 100), type: "money" },
              ],
            }))}
          />
          <Link href="/platform/economics/businesses" className="mt-3 inline-block text-sm text-accent underline">
            Compare all businesses
          </Link>
        </Panel>
      </div>

      {history.available ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Media stored over time"
            description="Snapshot months are measured; earlier months are reconstructed from upload dates of media still stored (deleted files and thumbnails excluded)."
            actions={<SourceTag kind="estimated" title="Reconstructed before daily snapshots began." />}
          >
            <TrendChart
              xMode="month"
              points={pts.map((m) => ({
                day: m.month,
                stored: +bytesToGb(m.snapshotStorageBytes ?? m.reconstructedStorageBytes).toFixed(2),
                added: +bytesToGb(m.uploadedBytes).toFixed(2),
              }))}
              series={[
                { key: "stored", label: "Stored (GB)", color: "#4F46E5", type: "decimal" },
                { key: "added", label: "Added that month (GB)", color: "#14B8A6", type: "decimal" },
              ]}
            />
          </Panel>
          <Panel
            title="Revenue vs estimated infrastructure"
            description="Collected subscription revenue (actual) against the platform cost estimate for each month's storage and downloads."
          >
            <TrendChart
              xMode="month"
              points={pts.map((m) => ({
                day: m.month,
                revenue: Math.round(m.revenue * 100),
                cost: Math.round(m.estimatedInfraCost * 100),
                recorded: Math.round(m.recordedExpenses * 100),
              }))}
              series={[
                { key: "revenue", label: "Collected", color: "#10B981", type: "money" },
                { key: "cost", label: "Est. infrastructure", color: "#F59E0B", type: "money" },
                { key: "recorded", label: "Recorded invoices", color: "#64748B", type: "money" },
              ]}
            />
          </Panel>
        </div>
      ) : (
        <Notice tone="warn">Monthly history needs migration V112 (aggregate functions). Current-state figures above are live.</Notice>
      )}

      <Panel title="Lowest-margin paying businesses" description="Contribution margin after their marginal infrastructure and Stripe fees.">
        {lowMargin.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Business</th>
                  <th className="py-2 pr-3 font-medium">MRR</th>
                  <th className="py-2 pr-3 font-medium">Stored</th>
                  <th className="py-2 pr-3 font-medium">Cost / mo</th>
                  <th className="py-2 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {lowMargin.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">
                      <Link href={`/platform/economics/businesses?focus=${r.id}`} className="font-medium text-heading underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{formatUsd(r.mrr)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatBytes(r.storageBytes)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatUsd(r.cost.total + r.stripeFees)}</td>
                    <td className={`py-2 tabular-nums font-medium ${marginTone(r.margin)}`}>{formatPct(r.margin, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No paying businesses yet.</p>
        )}
        <p className="mt-3 text-xs text-muted">
          One GB stored costs {formatUsd(a.storagePerGbMonth)} a month; one GB downloaded costs {formatUsd(a.uncachedEgressPerGb)}–
          {formatUsd(a.uncachedEgressPerGb + a.vercelTransferPerGb)} depending on route. A full 500 GB allowance costs about{" "}
          {formatUsd(500 * a.storagePerGbMonth)}/mo to store.
        </p>
      </Panel>
    </div>
  );
}
