import { requireSuperAdminPage } from "@/lib/admin-access";
import { listPartnerApplications, listPartners } from "@/lib/partners";
import { PARTNER_COMMISSION_HOLD_DAYS } from "@/lib/partner-commissions";
import {
  loadPartnerProgramCharts,
  loadPartnerProgramMetrics,
  loadPartnerTableRows,
} from "@/lib/partner-program";
import {
  loadPartnerProgramSettings,
  loadReferralDiscountStripeCoupons,
  listPartnerReferralDiscountWarnings,
} from "@/lib/partner-referral-discount";
import { loadPartnerPayoutAutomationSettings } from "@/lib/partner-payout-automation";
import { PartnerPayoutAutomationPanel } from "@/components/platform/partner-payout-automation-panel";
import { getStripeMode } from "@/lib/stripe";
import { listActivePlans } from "@/lib/entitlements";
import { PartnersManager } from "@/components/platform/partners-manager";
import { PartnersPerformanceTable } from "@/components/platform/partners-performance-table";
import { PartnerProgramCharts } from "@/components/platform/partner-program-charts";
import { PartnerReferralDiscountSettings } from "@/components/platform/partner-referral-discount-settings";
import { PartnerProgramCommissionSettings } from "@/components/platform/partner-program-commission-settings";
import { PartnerReferralDiscountOverrideWarnings } from "@/components/platform/partner-referral-discount-override-warnings";
import { PlatformPartnersProgramShell } from "@/components/platform/platform-partners-program-shell";
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
  const [
    applications,
    partners,
    metrics,
    charts,
    tableRows,
    discountSettings,
    discountCoupons,
    discountWarnings,
    plans,
    payoutAutomation,
  ] = await Promise.all([
    listPartnerApplications("all"),
    listPartners("all"),
    loadPartnerProgramMetrics(),
    loadPartnerProgramCharts(12),
    loadPartnerTableRows(),
    loadPartnerProgramSettings(),
    loadReferralDiscountStripeCoupons(),
    listPartnerReferralDiscountWarnings(),
    listActivePlans(),
    loadPartnerPayoutAutomationSettings(),
  ]);
  const deployMode = getStripeMode();
  const primaryPlan = plans[0];
  const planTrialDays = primaryPlan?.trial_days ?? 14;
  const planTrialName = primaryPlan?.name;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-heading">Partners</h1>
      <p className="mb-8 text-sm text-muted">
        Program metrics, partner performance, applications, manual payouts, and automated payout
        runs (OFF by default).
      </p>

      <PlatformPartnersProgramShell
        overview={
          <div className="space-y-8">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Metric label="Total partners" value={String(metrics.totalPartners)} />
              <Metric label="Pending applications" value={String(metrics.pendingApplications)} />
              <Metric label="Active partners" value={String(metrics.activePartners)} />
              <Metric
                label="Customers generated"
                value={String(metrics.totalCustomersGenerated)}
              />
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
                hint={`Still in the ${PARTNER_COMMISSION_HOLD_DAYS}-day hold`}
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
              <Metric
                label="Active referral discounts"
                value={String(metrics.activeDiscountedReferrals)}
                hint="Referred businesses still in their configured discount window"
              />
              <Metric
                label="Referral discount given"
                value={formatCurrency(metrics.totalReferralDiscountGivenCents)}
                hint="Estimated list price minus collected on discounted invoices (deploy mode)"
              />
            </section>
            <section>
              <h3 className="mb-3 text-base font-semibold text-heading">Trends</h3>
              <PartnerProgramCharts buckets={charts} />
            </section>
          </div>
        }
        performance={
          <Card>
            <CardContent className="pt-6">
              <PartnersPerformanceTable rows={tableRows} />
            </CardContent>
          </Card>
        }
        applications={
          <PartnersManager
            initialApplications={applications}
            initialPartners={partners}
            defaultCommissionRatePct={Number(discountSettings.default_commission_rate_pct ?? 30)}
          />
        }
        payouts={
          <Card>
            <CardContent className="pt-6">
              <PartnerPayoutAutomationPanel
                initial={payoutAutomation}
                deployMode={deployMode}
              />
            </CardContent>
          </Card>
        }
        referralDiscount={
          <div className="space-y-4">
            <PartnerReferralDiscountOverrideWarnings warnings={discountWarnings} />
            <Card>
              <CardContent className="pt-6">
                <PartnerReferralDiscountSettings
                  initial={discountSettings}
                  initialCoupons={discountCoupons}
                  deployMode={deployMode}
                  planTrialDays={planTrialDays}
                  planTrialName={planTrialName}
                />
              </CardContent>
            </Card>
          </div>
        }
        programSettings={
          <Card>
            <CardContent className="pt-6">
              <PartnerProgramCommissionSettings initial={discountSettings} />
            </CardContent>
          </Card>
        }
      />
    </main>
  );
}
