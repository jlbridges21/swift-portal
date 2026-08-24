import { requireSuperAdminPage } from "@/lib/admin-access";
import { listPartnerApplications, listPartners } from "@/lib/partners";
import {
  loadPartnerProgramCharts,
  loadPartnerProgramMetrics,
  loadPartnerTableRows,
} from "@/lib/partner-program";
import { PartnersManager } from "@/components/platform/partners-manager";
import { PartnersPerformanceTable } from "@/components/platform/partners-performance-table";
import { PartnerProgramCharts } from "@/components/platform/partner-program-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

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

export default async function PlatformPartnersPage() {
  await requireSuperAdminPage();
  const [applications, partners, metrics, charts, tableRows] = await Promise.all([
    listPartnerApplications("all"),
    listPartners("all"),
    loadPartnerProgramMetrics(),
    loadPartnerProgramCharts(12),
    loadPartnerTableRows(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-heading">Partners</h1>
      <p className="mb-8 text-sm text-muted">
        Program metrics, partner performance, applications, and manual payouts. Automated payouts
        and Stripe Connect for partners are out of scope.
      </p>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Metric label="Total partners" value={String(metrics.totalPartners)} />
        <Metric label="Pending applications" value={String(metrics.pendingApplications)} />
        <Metric label="Active partners" value={String(metrics.activePartners)} />
        <Metric label="Customers generated" value={String(metrics.totalCustomersGenerated)} />
        <Metric
          label="Active referred customers"
          value={String(metrics.activePartnerReferredCustomers)}
        />
        <Metric
          label="Revenue generated"
          value={formatCurrency(metrics.revenueGeneratedCents)}
          hint="ShootPortal subscription payments from partner-referred businesses"
        />
        <Metric
          label="Commissions earned"
          value={formatCurrency(metrics.totalCommissionsEarnedCents)}
        />
        <Metric
          label="Pending commissions"
          value={formatCurrency(metrics.pendingCommissionsCents)}
          hint="Still in the 30-day hold"
        />
        <Metric
          label="Commissions paid"
          value={formatCurrency(metrics.totalCommissionsPaidCents)}
        />
        <Metric
          label="Partner-generated MRR"
          value={formatCurrency(metrics.partnerGeneratedMrrCents)}
          hint={metrics.mrrDefinition}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-heading">Trends</h2>
        <PartnerProgramCharts buckets={charts} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-heading">Partner performance</h2>
        <Card>
          <CardContent className="pt-6">
            <PartnersPerformanceTable rows={tableRows} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-heading">Applications & accounts</h2>
        <PartnersManager initialApplications={applications} initialPartners={partners} />
      </section>
    </main>
  );
}
