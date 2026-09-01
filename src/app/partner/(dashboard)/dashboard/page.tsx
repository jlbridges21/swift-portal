import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile } from "@/lib/auth";
import {
  loadCalculatorPlans,
  loadPartnerDashboardSummary,
  loadPartnerMonthlyEarnings,
  partnerLandingPublicUrl,
  resolvePartnerAccess,
} from "@/lib/partner-dashboard";
import { getPartnerLandingForAccess } from "@/lib/partner-landing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PartnerEarningsChart } from "@/components/partner/partner-earnings-chart";
import { PartnerEarningsCalculator } from "@/components/partner/partner-earnings-calculator";
import { PartnerShareLinks } from "@/components/partner/partner-share-links";

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

export default async function PartnerOverviewPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner/dashboard");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") return null;

  const [summary, monthly, plans, landing] = await Promise.all([
    loadPartnerDashboardSummary(access),
    loadPartnerMonthlyEarnings(access, 12),
    loadCalculatorPlans(),
    getPartnerLandingForAccess(access),
  ]);

  const landingUrl =
    landing?.slug && landing.is_active ? partnerLandingPublicUrl(landing.slug) : null;

  const empty = summary.totalReferredCustomers === 0;

  return (
    <>
      <h1 className="text-2xl font-bold text-heading">Overview</h1>
      <p className="mt-1 text-sm text-muted">
        I referred {summary.totalReferredCustomers} · they generated{" "}
        {formatCurrency(summary.totalRevenueGeneratedCents)} · I earned{" "}
        {formatCurrency(summary.balance.lifetimeEarnedCents)} ·{" "}
        {formatCurrency(summary.balance.pendingCents)} pending ·{" "}
        {formatCurrency(summary.balance.paidCents)} paid
      </p>

      <section className="mt-6">
        <PartnerShareLinks
          referralLink={summary.referralLink}
          landingUrl={landingUrl}
          referralCode={summary.partner.referralCode}
          promoCode={summary.partner.promoCode}
        />
      </section>

      <p className="mt-3 text-xs text-muted">
        Commission rate <strong>{summary.partner.commissionRatePct}%</strong> of revenue
        ShootPortal collects from businesses you refer.
      </p>

      {empty ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>No referrals yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            <p>
              Share your referral link. When someone signs up for ShootPortal through it, they
              appear under Referrals — and commissions start when they become a paying subscriber.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Commission rate" value={`${summary.partner.commissionRatePct}%`} />
        <Metric label="Referred customers" value={String(summary.totalReferredCustomers)} />
        <Metric
          label="Active paying referrals"
          value={String(summary.activePayingReferrals)}
        />
        <Metric
          label="Revenue generated"
          value={formatCurrency(summary.totalRevenueGeneratedCents)}
          hint="Subscription payments from your referrals (not your cut)"
        />
        <Metric
          label="Commissions earned"
          value={formatCurrency(summary.balance.lifetimeEarnedCents)}
          hint={
            summary.balance.reversedCents > 0
              ? `${formatCurrency(summary.balance.reversedCents)} reversed (refunds)`
              : undefined
          }
        />
        <Metric
          label="Recurring monthly"
          value={formatCurrency(summary.balance.recurringMonthlyEstimateCents)}
          hint="Latest commission per active paying referral"
        />
        <Metric
          label="Pending"
          value={formatCurrency(summary.balance.pendingCents)}
          hint={`Earned but still in the ${summary.holdDays}-day hold before it becomes payable`}
        />
        <Metric
          label="Payable"
          value={formatCurrency(summary.balance.payableCents)}
          hint={`Past the ${summary.holdDays}-day hold, not yet paid out`}
        />
        <Metric
          label="Total paid"
          value={formatCurrency(summary.balance.paidCents)}
          hint="Sum of ledger rows included in recorded payouts"
        />
      </section>

      <p className="mt-4 rounded-lg border border-border bg-subtle/50 px-4 py-3 text-sm text-muted">
        <strong className="text-heading">Pending vs payable:</strong> commissions enter a{" "}
        {summary.holdDays}-day hold after each payment (refunds / chargebacks). Pending means
        earned but not yet past that hold. Payable means past the hold and waiting for the next
        payout.
      </p>

      <section className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Earnings over time</CardTitle>
            <p className="text-sm text-muted">
              Monthly from your commission ledger. Reversals (refunds) are shown separately.
            </p>
          </CardHeader>
          <CardContent>
            <PartnerEarningsChart buckets={monthly} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Earnings calculator</CardTitle>
            <p className="text-sm text-muted">
              Estimate only — separate from your real ledger totals above.
            </p>
          </CardHeader>
          <CardContent>
            <PartnerEarningsCalculator
              commissionRatePct={summary.partner.commissionRatePct}
              plans={plans}
            />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
