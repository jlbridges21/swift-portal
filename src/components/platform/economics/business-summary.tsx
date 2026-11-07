import type { BusinessEconomicsRow } from "@/lib/platform-economics";
import { formatBytes, formatPct, formatUsd } from "@/lib/economics/assumptions";
import { SourceTag, StatLine, StorageCell, marginTone } from "@/components/platform/economics/ui";

const BUCKET_LABELS: Record<string, string> = {
  "project-media": "Project media",
  "project-documents": "Documents",
  avatars: "Avatars",
  "business-logos": "Logos",
};

/**
 * One business's subscription, infrastructure and contribution. Pure (no hooks) so it renders
 * in the comparison drawer and on the business detail page alike.
 */
export function BusinessEconomicsSummary({ row, windowDays }: { row: BusinessEconomicsRow; windowDays: number }) {
  const bandwidth = row.cost.supabaseEgress + row.cost.vercelTransfer;
  const costToServe = row.cost.total + row.stripeFees;
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Subscription</h3>
          <SourceTag kind="actual" />
        </div>
        <StatLine label="Plan" value={row.planName} />
        <StatLine label="Status" value={row.isComped ? "comped" : row.subscriptionStatus} />
        <StatLine label="Billing" value={row.interval ?? "—"} />
        <StatLine label="MRR (list, monthly equiv.)" value={formatUsd(row.mrr)} />
        <StatLine
          label="Last invoice (monthly equiv.)"
          value={row.lastInvoiceMonthly != null ? formatUsd(row.lastInvoiceMonthly) : "—"}
          hint={row.lastPaidAt ? new Date(row.lastPaidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined}
        />
        <StatLine label="Collected lifetime" value={formatUsd(row.collectedLifetime)} />
        {(row.introOfferRedeemed || row.referredByPartner) && (
          <p className="mt-2 text-xs text-muted">
            {row.introOfferRedeemed ? "Intro offer redeemed. " : ""}
            {row.referredByPartner ? "Partner-referred — a referral discount may apply to early invoices." : ""}
          </p>
        )}
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Storage &amp; delivery</h3>
          <SourceTag kind="measured" />
        </div>
        <div className="py-1.5">
          <StorageCell bytes={row.storageBytes} allowanceGb={row.allowanceGb} utilization={row.utilization} />
        </div>
        <StatLine label="Utilization" value={formatPct(row.utilization, 1)} />
        <StatLine
          label="30-day change"
          value={row.storageGrowthBytes != null ? `${row.storageGrowthBytes >= 0 ? "+" : ""}${formatBytes(row.storageGrowthBytes)}` : "—"}
        />
        <StatLine label={`Delivered (${windowDays}d)`} value={formatBytes(row.monthlyEgressBytes)} />
        <StatLine label="Downloads ÷ stored" value={row.storageBytes > 0 ? `${(row.monthlyEgressBytes / row.storageBytes).toFixed(2)}×` : "—"} />
        {Object.entries(row.storageByBucket)
          .filter(([, b]) => b > 0)
          .map(([bucket, bytes]) => (
            <StatLine key={bucket} label={<span className="pl-2">{BUCKET_LABELS[bucket] ?? bucket}</span>} value={formatBytes(bytes)} />
          ))}
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Cost to serve / month</h3>
          <SourceTag kind="estimated" />
        </div>
        <StatLine label="Storage" value={formatUsd(row.cost.storage)} />
        <StatLine label="Bandwidth" value={formatUsd(bandwidth)} hint={row.cost.vercelTransfer ? `incl. ${formatUsd(row.cost.vercelTransfer)} Vercel` : undefined} />
        <StatLine label="Image transformations" value={formatUsd(row.cost.imageTransforms)} />
        <StatLine label="Stripe fees" value={formatUsd(row.stripeFees)} />
        <StatLine label={<span className="font-medium text-heading">Total cost to serve</span>} value={<span className="font-medium">{formatUsd(costToServe)}</span>} />
        <StatLine
          label={<span className="font-medium text-heading">Contribution</span>}
          value={<span className={`font-semibold ${marginTone(row.margin)}`}>{formatUsd(row.contribution)}</span>}
          hint={formatPct(row.margin, 1)}
        />
        <p className="mt-2 text-xs text-muted">
          Marginal rates, no share of included quotas or fixed platform fees. Shared costs are shown at platform level only.
        </p>
      </div>
    </div>
  );
}
