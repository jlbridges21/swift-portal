import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadPlatformPartnerDetail } from "@/lib/partner-program";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PartnerPayoutAdjustForms } from "@/components/platform/partner-payout-adjust-forms";
import { PartnerPayoutHistory } from "@/components/partner/partner-payout-history";
import { PartnerReferralsTable } from "@/components/partner/partner-referrals-table";
import { PartnerCommissionHistory } from "@/components/partner/partner-commission-history";
import { PartnerEarningsChart } from "@/components/partner/partner-earnings-chart";
import { PartnerLandingEditor } from "@/components/platform/partner-landing-editor";
import {
  buildPartnerLandingDefaultsWithOffer,
  getPartnerLandingByPartnerId,
  getPartnerLandingUpdatedByLabel,
} from "@/lib/partner-landing";

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

export default async function PlatformPartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const detail = await loadPlatformPartnerDetail(id);
  if (!detail) notFound();

  const landing = await getPartnerLandingByPartnerId(id);
  const landingDefaults = await buildPartnerLandingDefaultsWithOffer(id, detail.partner.brand_name);
  const landingUpdatedByLabel = landing?.updated_by
    ? await getPartnerLandingUpdatedByLabel(landing.updated_by)
    : null;
  const { partner, balance } = detail;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/platform/partners" className="text-sm text-muted hover:text-heading">
            ← Partners
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-heading">{partner.brand_name}</h1>
          <p className="text-sm text-muted">
            {partner.name} · {partner.email} ·{" "}
            <span className="font-mono">{partner.referral_code}</span> ·{" "}
            {partner.commission_rate_pct}% · {partner.status}
          </p>
        </div>
        <Link href="/platform/partners">
          <Button type="button" variant="outline" className="min-h-11">
            Back to list
          </Button>
        </Link>
      </div>

      <p className="mb-6 text-sm text-muted">
        All money figures use the same <code className="text-xs">computePartnerBalance</code>{" "}
        helper as the partner dashboard — the two views must agree exactly.
      </p>

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

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-heading">Earnings over time</h2>
        <Card>
          <CardContent className="pt-6">
            <PartnerEarningsChart buckets={detail.monthly} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-heading">Custom landing page</h2>
        <PartnerLandingEditor
          partnerId={partner.id}
          brandName={partner.brand_name}
          initial={landing}
          defaults={landingDefaults}
          suggestedSlug={partner.referral_code}
          updatedAt={landing?.updated_at ?? null}
          updatedByLabel={landingUpdatedByLabel}
        />
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-heading">Record payout / adjustment</h2>
        <PartnerPayoutAdjustForms
          partnerId={partner.id}
          payableCents={balance.payableCents}
          openNetCents={balance.openNetCents}
          currency={balance.currency}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-heading">Payout history</h2>
        <Card>
          <CardContent className="pt-6">
            <PartnerPayoutHistory payouts={detail.payouts} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-8" id="referrals">
        <h2 className="mb-3 text-lg font-semibold text-heading">Referrals</h2>
        <Card>
          <CardContent className="pt-6">
            <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
              <PartnerReferralsTable
                rows={detail.referrals}
                total={detail.referrals.length}
                page={1}
                pageSize={100}
                sort="joinedAt"
                dir="desc"
              />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8" id="history">
        <h2 className="mb-3 text-lg font-semibold text-heading">Commission history</h2>
        <Card>
          <CardContent className="pt-6">
            <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
              <PartnerCommissionHistory
                rows={detail.commissions.rows}
                total={detail.commissions.total}
                page={1}
                pageSize={100}
              />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      <p className="mt-10 text-sm text-muted">
        Edit commission rate, referral code, and status from the{" "}
        <Link href="/platform/partners" className="underline underline-offset-2">
          partners list
        </Link>
        .
      </p>
    </main>
  );
}
