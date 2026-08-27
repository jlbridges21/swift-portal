import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadPlatformPartnerDetail } from "@/lib/partner-program";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PartnerEarningsChart } from "@/components/partner/partner-earnings-chart";

export const dynamic = "force-dynamic";

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-heading">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function PlatformPartnerOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const detail = await loadPlatformPartnerDetail(id);
  if (!detail) notFound();

  const { balance } = detail;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-heading">Overview</h2>
        <p className="mt-1 text-sm text-muted">
          All money figures use the same <code className="text-xs">computePartnerBalance</code>{" "}
          helper as the partner dashboard — the two views must agree exactly.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Referred customers" value={String(detail.totalReferredCustomers)} />
        <Metric label="Active paying" value={String(detail.activePayingReferrals)} />
        <Metric
          label="Revenue generated"
          value={formatCurrency(detail.totalRevenueGeneratedCents)}
        />
        <Metric
          label="Commissions earned"
          value={formatCurrency(balance.lifetimeEarnedCents)}
          hint={
            balance.reversedCents > 0
              ? `${formatCurrency(balance.reversedCents)} reversed`
              : undefined
          }
        />
        <Metric label="Pending hold" value={formatCurrency(balance.pendingCents)} />
        <Metric
          label="Payable (open net)"
          value={formatCurrency(balance.openNetCents)}
          hint={
            balance.openNetCents < 0
              ? "Negative — carries forward; payout blocked"
              : `Payout amount: ${formatCurrency(balance.payableCents)}`
          }
        />
        <Metric label="Total paid" value={formatCurrency(balance.paidCents)} />
        <Metric
          label="Recurring commission"
          value={formatCurrency(balance.recurringMonthlyEstimateCents)}
          hint="Latest commission per active paying referral"
        />
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-heading">Earnings over time</h3>
        <Card>
          <CardContent className="pt-6">
            <PartnerEarningsChart buckets={detail.monthly} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
