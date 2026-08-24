import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getProfile } from "@/lib/auth";
import {
  loadCalculatorPlans,
  loadPartnerCommissionHistory,
  loadPartnerDashboardSummary,
  loadPartnerMonthlyEarnings,
  loadPartnerReferrals,
  resolvePartnerAccess,
} from "@/lib/partner-dashboard";
import {
  loadPartnerProgramSettings,
  PARTNER_COMMISSION_ON_NET_COLLECTED,
  PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY,
} from "@/lib/partner-referral-discount";
import { BrandProvider } from "@/components/brand/brand-provider";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PartnerReferralCopy } from "@/components/partner/partner-referral-copy";
import { PartnerEarningsChart } from "@/components/partner/partner-earnings-chart";
import { PartnerReferralsTable } from "@/components/partner/partner-referrals-table";
import { PartnerCommissionHistory } from "@/components/partner/partner-commission-history";
import { PartnerEarningsCalculator } from "@/components/partner/partner-earnings-calculator";
import { PartnerPayoutHistory } from "@/components/partner/partner-payout-history";
import { listPartnerPayouts } from "@/lib/partner-payouts";

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

export default async function PartnerHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    dir?: string;
    page?: string;
    cpage?: string;
  }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") notFound();

  const brand = getPortalBrandFromSettings(DEFAULT_APP_SETTINGS);
  const isBusinessAdmin = profile.role === "admin" || profile.role === "super_admin";

  if (access.kind === "suspended") {
    return (
      <BrandProvider brand={brand}>
        <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            ShootPortal Partners
          </p>
          <h1 className="mt-2 text-2xl font-bold text-heading">Partner account suspended</h1>
          <p className="mt-3 text-sm text-muted">
            Your partner account for <strong>{access.partner.brand_name}</strong> is suspended.
            Existing commission history is retained, but new referrals will not earn commissions
            until the account is reactivated. Contact ShootPortal support if you have questions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isBusinessAdmin ? (
              <Link href="/admin">
                <Button type="button" variant="accent" className="min-h-11">
                  Go to business admin
                </Button>
              </Link>
            ) : null}
            <form action="/api/auth/signout" method="POST">
              <Button type="submit" variant="outline" className="min-h-11">
                Sign out
              </Button>
            </form>
          </div>
        </main>
      </BrandProvider>
    );
  }

  const params = await searchParams;
  const sort = params.sort || "joinedAt";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.page) || 1);
  const cpage = Math.max(1, Number(params.cpage) || 1);
  const pageSize = 10;
  const historyPageSize = 20;

  const [summary, referrals, history, monthly, plans, payouts, discountProgram] = await Promise.all([
    loadPartnerDashboardSummary(access.partner),
    loadPartnerReferrals(access.partner.id, { sort, dir, page, pageSize }),
    loadPartnerCommissionHistory(access.partner.id, { page: cpage, pageSize: historyPageSize }),
    loadPartnerMonthlyEarnings(access.partner.id, 12),
    loadCalculatorPlans(),
    listPartnerPayouts(access.partner.id),
    loadPartnerProgramSettings(),
  ]);

  const empty = summary.totalReferredCustomers === 0;

  return (
    <BrandProvider brand={brand}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                ShootPortal Partners
              </p>
              <p className="text-sm font-medium text-heading">{summary.partner.brandName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isBusinessAdmin ? (
                <Link href="/admin">
                  <Button type="button" variant="outline" size="sm" className="min-h-11">
                    Business admin
                  </Button>
                </Link>
              ) : null}
              <form action="/api/auth/signout" method="POST">
                <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-heading">Partner dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            I referred {summary.totalReferredCustomers} · they generated{" "}
            {formatCurrency(summary.totalRevenueGeneratedCents)} · I earned{" "}
            {formatCurrency(summary.balance.lifetimeEarnedCents)} ·{" "}
            {formatCurrency(summary.balance.pendingCents)} pending ·{" "}
            {formatCurrency(summary.balance.paidCents)} paid
          </p>

          <section className="mt-6 space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted">Your referral link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <PartnerReferralCopy link={summary.referralLink} />
                <p className="text-xs text-muted">
                  Commission rate <strong>{summary.partner.commissionRatePct}%</strong> of revenue
                  ShootPortal collects from businesses you refer.
                </p>
              </CardContent>
            </Card>
          </section>

          {empty ? (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>No referrals yet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted">
                <p>
                  Share your referral link. When someone signs up for ShootPortal through it, they
                  appear here — and commissions start when they become a paying subscriber.
                </p>
                <p>
                  You will never see their clients, projects, or media. ShootPortal is their
                  product; you earn on their subscription payments only.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Commission rate" value={`${summary.partner.commissionRatePct}%`} />
            <Metric
              label="Referred customers"
              value={String(summary.totalReferredCustomers)}
            />
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
                <CardTitle>Payout history</CardTitle>
                <p className="text-sm text-muted">
                  Manual payouts recorded by ShootPortal. Amounts match the payable balance at the
                  time of each payout.
                </p>
              </CardHeader>
              <CardContent>
                <PartnerPayoutHistory payouts={payouts} />
              </CardContent>
            </Card>
          </section>

          <section className="mt-10">
            <Card>
              <CardHeader>
                <CardTitle>Earnings over time</CardTitle>
                <p className="text-sm text-muted">
                  Monthly from your commission ledger. Reversals (refunds) are shown separately so
                  they are never silent.
                </p>
              </CardHeader>
              <CardContent>
                <PartnerEarningsChart buckets={monthly} />
              </CardContent>
            </Card>
          </section>

          <section id="referrals" className="mt-10">
            <Card>
              <CardHeader>
                <CardTitle>Referred businesses</CardTitle>
                <p className="text-sm text-muted">
                  Business names and subscription status only — no clients, projects, or contacts.
                </p>
                {discountProgram.referral_discount_enabled ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <p>
                      <strong>Referral signup offer:</strong> businesses that join through your link
                      get{" "}
                      {formatCurrency(discountProgram.referral_discount_amount_cents)}/mo off for
                      their first {discountProgram.referral_discount_duration_months} paid months
                      (monthly billing).
                    </p>
                    <p>{PARTNER_COMMISSION_ON_NET_COLLECTED}</p>
                    <p className="text-xs text-amber-900">{PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY}</p>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                <Suspense fallback={null}>
                  <PartnerReferralsTable
                    rows={referrals.rows}
                    total={referrals.total}
                    page={page}
                    pageSize={pageSize}
                    sort={sort}
                    dir={dir}
                  />
                </Suspense>
              </CardContent>
            </Card>
          </section>

          <section id="history" className="mt-10">
            <Card>
              <CardHeader>
                <CardTitle>Commission history</CardTitle>
                <p className="text-sm text-muted">
                  Every ledger row. Rates are snapshotted — older rows keep the rate that applied
                  when they were earned.
                </p>
              </CardHeader>
              <CardContent>
                <Suspense fallback={null}>
                  <PartnerCommissionHistory
                    rows={history.rows}
                    total={history.total}
                    page={cpage}
                    pageSize={historyPageSize}
                  />
                </Suspense>
              </CardContent>
            </Card>
          </section>

          <section className="mt-10 mb-12">
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
        </main>
      </div>
    </BrandProvider>
  );
}
