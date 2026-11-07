import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadEconomicsDataset, loadEconomicsHistory } from "@/lib/platform-economics";
import { bytesToGb, formatBytes, formatPct, formatUsd } from "@/lib/economics/assumptions";
import { egressSplitGb } from "@/lib/economics/cost-model";
import { KpiCard, Notice, Panel } from "@/components/platform/analytics/ui";
import { BarList, ColumnChart, TrendChart } from "@/components/platform/analytics/charts";
import { DataStatus } from "@/components/platform/economics/data-status";
import { SourceTag, StatLine, StorageCell } from "@/components/platform/economics/ui";

export const dynamic = "force-dynamic";

const BUCKETS: { key: string; label: string; min: number; max: number; color: string }[] = [
  { key: "0-10", label: "Under 10%", min: 0, max: 0.1, color: "#A5B4FC" },
  { key: "10-25", label: "10–25%", min: 0.1, max: 0.25, color: "#818CF8" },
  { key: "25-50", label: "25–50%", min: 0.25, max: 0.5, color: "#6366F1" },
  { key: "50-75", label: "50–75%", min: 0.5, max: 0.75, color: "#4F46E5" },
  { key: "75-90", label: "75–90%", min: 0.75, max: 0.9, color: "#F59E0B" },
  { key: "90+", label: "90% or more", min: 0.9, max: Infinity, color: "#E11D48" },
];

const BUCKET_LABELS: Record<string, string> = {
  "project-media": "Project media",
  "project-documents": "Documents",
  avatars: "Avatars",
  "business-logos": "Logos & landing images",
};

export default async function StoragePage() {
  await requireSuperAdminPage();
  const ds = await loadEconomicsDataset();
  const history = await loadEconomicsHistory(ds.settings, 12);
  const p = ds.platform;
  const a = ds.settings.assumptions;
  const live = ds.rows.filter((r) => r.status === "active" && !r.deleted);
  const withLimit = live.filter((r) => r.utilization != null);

  const dist = BUCKETS.map((b) => ({
    ...b,
    count: withLimit.filter((r) => r.utilization! >= b.min && r.utilization! < b.max).length,
  }));
  const approaching = [...withLimit].filter((r) => r.utilization! >= 0.75).sort((x, y) => y.utilization! - x.utilization!);
  const median = p.medianStorageBytes;
  const heavy = live
    .filter((r) => r.storageBytes > 0 && (median > 0 ? r.storageBytes >= median * 3 : true))
    .sort((x, y) => y.storageBytes - x.storageBytes)
    .slice(0, 8);
  const growing = live
    .filter((r) => (r.storageGrowthBytes ?? 0) > 0)
    .sort((x, y) => (y.storageGrowthBytes ?? 0) - (x.storageGrowthBytes ?? 0))
    .slice(0, 8);

  const byPlan = new Map<string, { name: string; bytes: number; n: number }>();
  for (const r of live) {
    const cur = byPlan.get(r.plan) ?? { name: r.planName, bytes: 0, n: 0 };
    cur.bytes += r.storageBytes;
    cur.n += 1;
    byPlan.set(r.plan, cur);
  }

  // Growth: average monthly additions over the last three complete months of history.
  const pts = history.points;
  const recent = pts.slice(-4, -1);
  const avgMonthlyAdd = recent.length ? recent.reduce((s, m) => s + m.uploadedBytes, 0) / recent.length : null;
  const projected12 = avgMonthlyAdd != null ? p.storageBytes + avgMonthlyAdd * 12 : null;

  const split = egressSplitGb({ storageBytes: 0, proxiedBytes: p.proxiedBytes, signedBytes: p.signedBytes, imageTransforms: 0 }, a);
  const topBandwidth = [...live].filter((r) => r.monthlyEgressBytes > 0).sort((x, y) => y.monthlyEgressBytes - x.monthlyEgressBytes).slice(0, 8);
  const channelTotals = ds.rows.reduce(
    (acc, r) => {
      acc.proxied += r.egress.proxiedBytes;
      acc.zip += r.egress.zipBytes;
      acc.signed += r.egress.signedBytes;
      acc.backfill += r.egress.backfillBytes;
      return acc;
    },
    { proxied: 0, zip: 0, signed: 0, backfill: 0 }
  );

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total stored" value={formatBytes(p.storageBytes)} hint={`${formatUsd(bytesToGb(p.storageBytes) * a.storagePerGbMonth)}/mo at list rate`} />
        <KpiCard label="Average / business" value={formatBytes(p.avgStorageBytes)} hint={`median ${formatBytes(p.medianStorageBytes)}`} definition="Across live businesses (active, not deleted)." />
        <KpiCard
          label="Allowance consumed"
          value={formatPct(p.allocatedUtilization, 1)}
          hint={`${formatBytes(p.attributedBytes)} of ${formatBytes(p.allowanceBytes)}`}
          definition="Attributed storage ÷ sum of plan allowances for live businesses."
        />
        <KpiCard label="At ≥ 75% of allowance" value={approaching.length.toLocaleString()} hint={`of ${withLimit.length} with a limit`} />
        <KpiCard
          label="Projected in 12 months"
          value={projected12 != null ? formatBytes(projected12) : "—"}
          hint={avgMonthlyAdd != null ? `at ${formatBytes(avgMonthlyAdd)}/mo added (3-mo avg)` : "needs history"}
          definition="Today's storage + 12 × the average bytes added per month over the last three complete months, at today's customer count. Linear; not a forecast."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="How full are allowances?"
          description="Businesses by share of their plan's storage allowance in use."
          actions={<SourceTag kind="measured" />}
        >
          <BarList
            metric="Businesses"
            empty="No businesses with a storage limit yet."
            rows={dist.map((b) => ({ key: b.key, label: b.label, value: b.count, color: b.color }))}
          />
          <p className="mt-3 text-xs text-muted">
            Mean utilization {formatPct(p.avgUtilization, 1)} · median {formatPct(p.medianUtilization, 1)}. The simulator can use this as its
            baseline.
          </p>
        </Panel>
        <Panel title="Average storage by plan" description="Mean stored per live business on each plan.">
          <BarList
            type="decimal"
            metric="Avg GB"
            empty="No storage measured yet."
            rows={[...byPlan.entries()].map(([key, v]) => ({
              key,
              label: `${v.name} (${v.n})`,
              value: v.n ? bytesToGb(v.bytes / v.n) : 0,
              sub: "GB",
            }))}
          />
          {Object.keys(ds.snapshot.byBucket).length ? (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">By bucket</p>
              {Object.entries(ds.snapshot.byBucket)
                .sort((x, y) => y[1] - x[1])
                .map(([bucket, bytes]) => (
                  <StatLine key={bucket} label={BUCKET_LABELS[bucket] ?? bucket} value={formatBytes(bytes)} />
                ))}
              {p.unattributedBytes > 0 ? (
                <StatLine label="Not attributable to a business" value={formatBytes(p.unattributedBytes)} hint="platform / orphaned" />
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>

      {history.available ? (
        <Panel
          title="Storage growth"
          description="Measured snapshots where available; earlier months reconstructed from upload dates of media still stored."
          actions={<SourceTag kind="estimated" title="Reconstruction excludes deleted files and derivatives (thumbnails)." />}
        >
          <TrendChart
            xMode="month"
            points={pts.map((m) => ({
              day: m.month,
              stored: +bytesToGb(m.snapshotStorageBytes ?? m.reconstructedStorageBytes).toFixed(2),
              perBiz: live.length ? +bytesToGb((m.snapshotStorageBytes ?? m.reconstructedStorageBytes) / live.length).toFixed(2) : 0,
            }))}
            series={[
              { key: "stored", label: "Total stored (GB)", color: "#4F46E5", type: "decimal" },
              { key: "perBiz", label: "Per live business today (GB)", color: "#A855F7", type: "decimal" },
            ]}
          />
          <div className="mt-4">
            <ColumnChart
              xMode="month"
              label="GB added"
              type="decimal"
              color="#14B8A6"
              points={pts.map((m) => ({ day: m.month, added: +bytesToGb(m.uploadedBytes).toFixed(2) }))}
              valueKey="added"
            />
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Approaching their limit" description="≥ 75% of allowance. Candidates for a larger storage tier.">
          {approaching.length ? (
            <ul className="space-y-2">
              {approaching.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <Link href={`/platform/economics/businesses?focus=${r.id}`} className="truncate text-sm font-medium text-heading underline">
                    {r.name}
                  </Link>
                  <StorageCell bytes={r.storageBytes} allowanceGb={r.allowanceGb} utilization={r.utilization} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No business is above 75% of its allowance.</p>
          )}
        </Panel>
        <Panel
          title="Unusually high storage"
          description={median > 0 ? `At least 3× the median (${formatBytes(median)}).` : "Largest accounts."}
        >
          <BarList
            type="decimal"
            metric="GB stored"
            empty="Nothing stands out."
            rows={heavy.map((r) => ({ key: r.id, label: r.name, value: +bytesToGb(r.storageBytes).toFixed(2), sub: "GB", color: "#6366F1" }))}
          />
          {growing.length ? (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Fastest growing since {ds.growthBaseline?.day}
              </p>
              {growing.map((r) => (
                <StatLine key={r.id} label={r.name} value={`+${formatBytes(r.storageGrowthBytes!)}`} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">Growth per business appears once a snapshot ~30 days old exists.</p>
          )}
        </Panel>
      </div>

      <h2 className="pt-2 text-lg font-semibold text-heading">Bandwidth &amp; egress</h2>
      <Notice>
        <strong>What is and isn&apos;t measured.</strong> Supabase does not report egress per file or per customer, so ShootPortal meters what
        it can see: bytes it streams to viewers (single downloads, MLS downloads, ZIPs — exact) and full-size signed URLs it hands to browsers
        (estimated at one file size each). Gallery thumbnails and CDN-cached playback go straight from Supabase to the viewer and appear only
        on the Supabase invoice — record it under Costs &amp; Assumptions to reconcile.
      </Notice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={`Delivered (${ds.egressWindow.windowDays}d)`} value={formatBytes(p.egressBytes)} hint={p.downloadRatio != null ? `${p.downloadRatio.toFixed(2)}× stored` : undefined} definition="Downloads ÷ stored = how many times the stored library was downloaded this month." />
        <KpiCard label="Uncached (origin)" value={`${split.uncachedGb.toFixed(1)} GB`} hint={`${formatUsd(split.uncachedGb * a.uncachedEgressPerGb)} at list`} definition="App-streamed bytes are always origin reads. Signed deliveries are split by the cache-hit assumption." />
        <KpiCard label="Cached (CDN)" value={`${split.cachedGb.toFixed(1)} GB`} hint={`assumes ${formatPct(a.signedDeliveryCachedShare)} of direct hits cache`} />
        <KpiCard label="Through Vercel" value={`${split.proxiedGb.toFixed(1)} GB`} hint={`${formatUsd(split.proxiedGb * a.vercelTransferPerGb)} at list`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Highest bandwidth" description="Last 30 days, with downloads ÷ stored.">
          <BarList
            type="decimal"
            metric="GB delivered"
            empty="No download traffic recorded yet."
            rows={topBandwidth.map((r) => ({
              key: r.id,
              label: r.name,
              value: +bytesToGb(r.monthlyEgressBytes).toFixed(2),
              sub: r.storageBytes > 0 ? `${(r.monthlyEgressBytes / r.storageBytes).toFixed(1)}× stored` : "GB",
              color: "#0EA5E9",
              details: [
                { label: "Est. bandwidth cost", value: Math.round((r.cost.supabaseEgress + r.cost.vercelTransfer) * 100), type: "money" },
                { label: "Stored GB", value: +bytesToGb(r.storageBytes).toFixed(1), type: "decimal" },
              ],
            }))}
          />
        </Panel>
        <Panel title="Delivery channels" description="Where the 30-day figure comes from.">
          <StatLine label={<>App-streamed single files <SourceTag kind="measured" /></>} value={formatBytes(channelTotals.proxied)} />
          <StatLine label={<>ZIP downloads <SourceTag kind="measured" /></>} value={formatBytes(channelTotals.zip)} />
          <StatLine label={<>Signed full-size originals <SourceTag kind="estimated" /></>} value={formatBytes(channelTotals.signed)} />
          <StatLine label={<>Before metering: download log × size <SourceTag kind="estimated" /></>} value={formatBytes(channelTotals.backfill)} />
          {history.available ? (
            <div className="mt-4">
              <ColumnChart
                xMode="month"
                label="GB downloaded"
                type="decimal"
                color="#0EA5E9"
                points={pts.map((m) => ({ day: m.month, gb: +bytesToGb(m.downloadBytes).toFixed(2) }))}
                valueKey="gb"
              />
              <p className="mt-1 text-xs text-muted">Months before metering use logged single-file downloads × file size (ZIPs not logged).</p>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-muted">Stored vs. downloaded: {formatBytes(p.storageBytes)} stored, {formatBytes(p.egressBytes)} delivered in 30 days ({formatPct(p.downloadRatio)} of stored).</p>
        </Panel>
      </div>
    </div>
  );
}
